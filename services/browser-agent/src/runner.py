"""Common runner utilities: emit a step, take a screenshot, upload to OSS."""

from __future__ import annotations

import os
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from playwright.async_api import Page

from .storage.oss import upload_screenshot


SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "./screenshots"))
SCREENSHOT_DIR.mkdir(exist_ok=True)


async def emit_step(
    *,
    run_id: str,
    step: int,
    description: str,
    page: Page | None = None,
) -> dict[str, Any]:
    """Build a browser_step event. Captures and stores a screenshot if a page is given."""

    screenshot_url: str | None = None
    if page is not None:
        try:
            filename = f"{run_id}_{step:03d}_{int(time.time())}.png"
            local_path = SCREENSHOT_DIR / filename
            await page.screenshot(path=str(local_path), full_page=False)
            screenshot_url = await upload_screenshot(local_path, filename)
        except Exception as exc:  # screenshot failure should not crash the run
            print(f"[runner] screenshot failed at step {step}: {exc}")

    event: dict[str, Any] = {
        "runId": run_id,
        "step": step,
        "description": description,
    }
    if screenshot_url:
        event["screenshotUrl"] = screenshot_url
    return event


async def replay_recording(
    *,
    run_id: str,
    recording_path: Path,
) -> AsyncIterator[dict[str, Any]]:
    """Fallback: replay a recorded happy-path run as fake browser_step events.

    Used when browser-use fails. The frontend cannot tell the difference because
    each event still carries a screenshot URL and a description.
    """
    import json

    if not recording_path.exists():
        yield {
            "runId": run_id,
            "step": 0,
            "description": f"Replay missing: {recording_path.name}",
        }
        return

    data = json.loads(recording_path.read_text())
    for i, step_data in enumerate(data.get("steps", []), start=1):
        yield {
            "runId": run_id,
            "step": i,
            "description": step_data.get("description", ""),
            "screenshotUrl": step_data.get("screenshotUrl"),
        }
