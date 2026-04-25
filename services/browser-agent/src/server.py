"""FastAPI entry. Streams browser-step events as JSON-lines back to the orchestrator.

JSON-lines (newline-delimited JSON) is chosen instead of SSE here because the
orchestrator parses line-by-line. SSE would add a `data:` prefix the orchestrator
already strips upstream, so we avoid the double-encoding.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .flows.grant_application import run_grant_application
from .flows.lotus_procurement import run_lotus_procurement

app = FastAPI(title="tng-rise browser agent")

# Serve local screenshots in dev. Container falls back to OSS in prod.
if os.path.isdir("./screenshots"):
    app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")


class RunRequest(BaseModel):
    inputs: dict[str, Any]


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "browser-agent"}


@app.post("/run/grant_application")
async def run_grant(req: RunRequest) -> StreamingResponse:
    run_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream(run_grant_application(run_id=run_id, inputs=req.inputs)),
        media_type="application/x-ndjson",
    )


@app.post("/run/lotus_procurement")
async def run_lotus(req: RunRequest) -> StreamingResponse:
    run_id = str(uuid.uuid4())
    return StreamingResponse(
        _stream(run_lotus_procurement(run_id=run_id, inputs=req.inputs)),
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
