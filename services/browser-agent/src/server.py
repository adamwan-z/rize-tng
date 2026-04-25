"""FastAPI entry. Streams browser-step events as JSON-lines back to callers.

JSON-lines (newline-delimited JSON) is chosen instead of SSE because the
orchestrator parses line-by-line. SSE would add a `data:` prefix the orchestrator
already strips upstream, so we avoid the double-encoding.

This module is a thin shell on top of `src.flows.*`. The flow functions are
the real implementation and can be imported directly or run via CLI.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .flows.grant_application import run_grant_application
from .flows.lotus_procurement import run_lotus_procurement
from .flows.types import GrantApplicationRequest, LotusProcurementRequest
from .lib.catalog import CatalogUnavailable

app = FastAPI(title="tng-rise browser agent")

# Serve local screenshots in dev. Container falls back to OSS in prod.
if os.path.isdir("./screenshots"):
    app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "browser-agent"}


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
    return StreamingResponse(
        _stream(
            run_lotus_procurement(
                run_id=run_id,
                items=req.items,
                mode=req.mode,
            )
        ),
        media_type="application/x-ndjson",
    )


@app.post("/run/{flow}")
async def run_unknown(flow: str) -> None:
    raise HTTPException(status_code=404, detail=f"Unknown flow: {flow}")


async def _stream(events: AsyncIterator[dict[str, Any]]) -> AsyncIterator[bytes]:
    async for event in events:
        yield (json.dumps(event) + "\n").encode("utf-8")


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
