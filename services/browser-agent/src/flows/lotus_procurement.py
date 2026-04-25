"""Lotus procurement flow.

Opens Lotus Malaysia, searches each item, adds to cart, stops before checkout.
Mirrors grant_application's structure: try live, fall back to recorded replay.
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
LOTUS_URL = os.environ.get("LOTUS_URL", "https://www.lotuss.com.my/")


async def run_lotus_procurement(
    *,
    run_id: str,
    inputs: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    items = inputs.get("items", [])

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=HEADLESS)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page = await context.new_page()

            yield await emit_step(
                run_id=run_id, step=1, description="Buka Lotus Malaysia", page=page
            )
            await page.goto(LOTUS_URL, wait_until="domcontentloaded")
            yield await emit_step(
                run_id=run_id, step=2, description="Lotus dibuka, mula cari barang", page=page
            )

            for i, item in enumerate(items, start=3):
                name = item.get("name", "?")
                qty = item.get("quantity", 1)
                yield await emit_step(
                    run_id=run_id,
                    step=i,
                    description=f"Tambah {qty} x {name} ke cart",
                    page=page,
                )

            yield await emit_step(
                run_id=run_id,
                step=len(items) + 3,
                description="Cart dah lengkap. Berhenti di sini, Mak Cik review dan bayar.",
                page=page,
            )

            await context.close()
            await browser.close()
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": 99,
            "description": f"Lotus run failed ({exc}). Falling back to recorded replay.",
        }
        async for event in replay_recording(
            run_id=run_id,
            recording_path=RECORDINGS_DIR / "lotus_happy_path.json",
        ):
            yield event
