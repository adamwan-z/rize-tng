"""Grant application flow.

Strategy:
1. Try browser-use with the grant URL and merchant profile as context.
2. Take screenshots after each meaningful action and emit browser_step events.
3. Stop before the Submit button. The merchant clicks Submit themselves.
4. On any failure, fall back to replay_recording so the demo still has motion.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from ..runner import emit_step, replay_recording

RECORDINGS_DIR = Path(__file__).parent.parent.parent / "recordings"
HEADLESS = os.environ.get("HEADLESS", "0") == "1"


async def run_grant_application(
    *,
    run_id: str,
    inputs: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    grant_id = inputs.get("grantId", "unknown")
    profile = inputs.get("profile", {})
    application_url = inputs.get("applicationUrl")

    if not application_url:
        yield await emit_step(
            run_id=run_id,
            step=0,
            description=f"No applicationUrl for grant {grant_id}, falling back to recorded replay.",
        )
        async for event in replay_recording(
            run_id=run_id,
            recording_path=RECORDINGS_DIR / "grant_happy_path.json",
        ):
            yield event
        return

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=HEADLESS)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            yield await emit_step(
                run_id=run_id,
                step=1,
                description=f"Buka portal grant {grant_id}",
                page=page,
            )
            await page.goto(application_url, wait_until="domcontentloaded")
            yield await emit_step(
                run_id=run_id,
                step=2,
                description="Portal dibuka, cari borang permohonan",
                page=page,
            )

            # Lane C fills in real interactions here. The walking skeleton emits a
            # few descriptive steps so the frontend renders motion end-to-end.
            yield await emit_step(
                run_id=run_id,
                step=3,
                description=f"Masukkan nama: {profile.get('name', '')}",
                page=page,
            )
            yield await emit_step(
                run_id=run_id,
                step=4,
                description=f"Masukkan SSM: {profile.get('ssm', '')}",
                page=page,
            )
            yield await emit_step(
                run_id=run_id,
                step=5,
                description="Borang diisi. Berhenti sebelum Submit.",
                page=page,
            )

            await context.close()
            await browser.close()
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": 99,
            "description": f"Live run failed ({exc}). Falling back to recorded replay.",
        }
        async for event in replay_recording(
            run_id=run_id,
            recording_path=RECORDINGS_DIR / "grant_happy_path.json",
        ):
            yield event
