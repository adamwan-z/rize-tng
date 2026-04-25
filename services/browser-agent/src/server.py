"""FastAPI entry. Streams browser-step events as JSON-lines back to callers.

JSON-lines (newline-delimited JSON) is chosen instead of SSE because the
orchestrator parses line-by-line. SSE would add a `data:` prefix the orchestrator
already strips upstream, so we avoid the double-encoding.

Lotus procurement is two-phase: `POST /run/lotus_procurement` fills the cart
and pauses with the browser open; `POST /run/lotus_procurement/{runId}/confirm`
clicks Place Order on that same live browser. A reaper closes any pending
run that has been idle longer than `PENDING_TTL_SECONDS`.

This module is a thin shell on top of `src.flows.*`. The flow functions are
the real implementation and can be imported directly or run via CLI.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .flows.grant_application import run_grant_application
from .flows.lotus_procurement import (
    close_lotus_run,
    complete_lotus_checkout,
    run_lotus_procurement,
)
from .flows.types import GrantApplicationRequest, LotusProcurementRequest
from .lib.catalog import CatalogUnavailable

app = FastAPI(title="tng-rise browser agent")

# Serve local screenshots in dev. Container falls back to OSS in prod.
if os.path.isdir("./screenshots"):
    app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")


PENDING_TTL_SECONDS = int(os.environ.get("LOTUS_PENDING_TTL_SECONDS", "300"))


@dataclass
class PendingLotusRun:
    state: dict[str, Any]
    last_step: int
    expires_at: float = field(default_factory=lambda: time.time() + PENDING_TTL_SECONDS)


PENDING_LOTUS_RUNS: dict[str, PendingLotusRun] = {}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "browser-agent", "pendingLotus": len(PENDING_LOTUS_RUNS)}


@app.exception_handler(CatalogUnavailable)
async def _catalog_unavailable(_req, exc: CatalogUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.post("/run/grant_application")
async def run_grant(req: GrantApplicationRequest) -> StreamingResponse:
    run_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream(
            run_grant_application(
                run_id=run_id,
                profile=req.profile,
                application_url=req.application_url,
                grant_id=req.grant_id,
                mode=req.mode,
            )
        ),
        media_type="application/x-ndjson",
    )


@app.post("/run/lotus_procurement")
async def run_lotus(req: LotusProcurementRequest) -> StreamingResponse:
    run_id = str(uuid.uuid4())
    state: dict[str, Any] = {}

    async def stream() -> AsyncIterator[bytes]:
        last_step = 0
        try:
            async for event in run_lotus_procurement(
                run_id=run_id,
                items=req.items,
                mode=req.mode,
                captured=state,
            ):
                if "step" in event:
                    last_step = max(last_step, int(event["step"]))
                # Stash the live browser when phase 1 paused at checkout, and
                # enrich the result with the runId the caller will need to
                # resume via /confirm.
                if event.get("awaiting_confirmation") and event.get("done"):
                    PENDING_LOTUS_RUNS[run_id] = PendingLotusRun(
                        state=state,
                        last_step=last_step,
                    )
                    result = event.get("result")
                    if isinstance(result, dict):
                        result["runId"] = run_id
                yield (json.dumps(event) + "\n").encode("utf-8")
        except Exception:
            # Safety net. The flow already cleans up on its own exception path,
            # but if the StreamingResponse itself is cancelled mid-yield we
            # close here too. Idempotent, so double-close is fine.
            await close_lotus_run(state)
            raise

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.post("/run/lotus_procurement/{run_id}/confirm")
async def confirm_lotus(run_id: str) -> StreamingResponse:
    pending = PENDING_LOTUS_RUNS.pop(run_id, None)
    if pending is None:
        raise HTTPException(
            status_code=404, detail=f"Unknown or expired runId: {run_id}"
        )

    async def stream() -> AsyncIterator[bytes]:
        try:
            async for event in complete_lotus_checkout(
                run_id=run_id,
                state=pending.state,
                start_step=pending.last_step + 1,
            ):
                yield (json.dumps(event) + "\n").encode("utf-8")
        finally:
            await close_lotus_run(pending.state)

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.post("/run/lotus_procurement/{run_id}/cancel")
async def cancel_lotus(run_id: str) -> dict[str, Any]:
    pending = PENDING_LOTUS_RUNS.pop(run_id, None)
    if pending is None:
        return {"ok": False, "reason": "not_found"}
    await close_lotus_run(pending.state)
    return {"ok": True}


@app.post("/run/{flow}")
async def run_unknown(flow: str) -> None:
    raise HTTPException(status_code=404, detail=f"Unknown flow: {flow}")


@app.on_event("startup")
async def _start_reaper() -> None:
    asyncio.create_task(_reap_pending_lotus_runs())


async def _reap_pending_lotus_runs() -> None:
    """Close abandoned procurement runs whose TTL has elapsed."""
    while True:
        await asyncio.sleep(60)
        now = time.time()
        expired = [rid for rid, p in PENDING_LOTUS_RUNS.items() if p.expires_at <= now]
        for rid in expired:
            pending = PENDING_LOTUS_RUNS.pop(rid, None)
            if pending is None:
                continue
            try:
                await close_lotus_run(pending.state)
            except Exception:
                pass


async def _stream(events: AsyncIterator[dict[str, Any]]) -> AsyncIterator[bytes]:
    async for event in events:
        yield (json.dumps(event) + "\n").encode("utf-8")


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
