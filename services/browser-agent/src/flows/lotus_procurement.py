"""Lotus procurement flow.

Public entry: `run_lotus_procurement`. Same shape as grant_application:
importable, HTTP-callable, CLI-callable, validated through Pydantic.

Validation rejects items whose SKU is not in the live catalog.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from ..runner import emit_step, replay_recording
from .types import LotusProcurementRequest, ShoppingItem

RECORDINGS_DIR = Path(__file__).parent.parent.parent / "recordings"
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
DEFAULT_LOTUS_URL = os.environ.get("MOCK_TNG_URL", "http://localhost:5000") + "/lotus.html"


async def run_lotus_procurement(
    *,
    run_id: str,
    items: list[ShoppingItem] | list[dict[str, Any]],
    mode: str = "scripted",
) -> AsyncIterator[dict[str, Any]]:
    """Drive the Lotus mock cart. Yields StepEvent dicts."""
    normalized: list[ShoppingItem] = [
        i if isinstance(i, ShoppingItem) else ShoppingItem(**i) for i in items
    ]
    req = LotusProcurementRequest(items=normalized, mode=mode)  # type: ignore[arg-type]

    last_step = 0
    captured: dict[str, Any] = {}
    try:
        gen = _run_scripted(run_id, req.items, captured) if req.mode == "scripted" \
            else _run_agent(run_id, req.items, captured)
        async for event in gen:
            last_step = max(last_step, int(event.get("step", 0)))
            yield event
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": "Cart ready for payment hand-off.",
            "done": True,
            "result": {
                "ok": True,
                "mode": req.mode,
                "items": [i.model_dump() for i in req.items],
                "subtotal": captured.get("subtotal"),
                "total": captured.get("total"),
            },
        }
        return
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": f"Live run failed ({exc}). Falling back to recorded replay.",
        }
        async for event in replay_recording(
            run_id=run_id,
            recording_path=RECORDINGS_DIR / "lotus_happy_path.json",
        ):
            last_step = max(last_step, int(event.get("step", 0)))
            yield event
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": "Replay finished. Live run failed earlier.",
            "done": True,
            "result": {"ok": False, "fallback": True, "items": [i.model_dump() for i in req.items]},
            "error": str(exc),
        }


# ----- scripted ------------------------------------------------------------


async def _run_scripted(
    run_id: str,
    items: list[ShoppingItem],
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """Deterministic Playwright run. Ports fill_scripted_lotus.py."""
    slow_mo = int(os.environ.get("SLOW_MO_MS", "350"))

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=slow_mo)
        context = await browser.new_context(viewport={"width": 1320, "height": 880})
        page = await context.new_page()

        yield await emit_step(
            run_id=run_id, step=1, description="Buka Lotus Malaysia", page=page
        )
        await page.goto(DEFAULT_LOTUS_URL)
        await page.wait_for_selector('[data-test="search-input"]')

        for idx, item in enumerate(items, start=2):
            # Fall back to using the SKU as the search term. The catalog has
            # enough name overlap with SKUs to make this reliable on the mock.
            query = _query_for(item.sku)
            await page.fill('[data-test="search-input"]', "")
            await page.fill('[data-test="search-input"]', query)
            await page.wait_for_selector(
                f'[data-test="add-to-cart-{item.sku}"]', timeout=5000
            )
            for _ in range(item.quantity):
                await page.click(f'[data-test="add-to-cart-{item.sku}"]')
                await asyncio.sleep(0.18)

            yield await emit_step(
                run_id=run_id,
                step=idx,
                description=f"Tambah {item.quantity} x {item.sku} ke cart",
                page=page,
            )

        await page.fill('[data-test="search-input"]', "")
        await asyncio.sleep(0.4)

        await page.click('[data-test="cart-button"]')
        await page.wait_for_selector('[data-test="cart-items"]')
        subtotal = (await page.text_content('[data-test="cart-subtotal"]') or "").strip()
        captured["subtotal"] = subtotal
        yield await emit_step(
            run_id=run_id,
            step=len(items) + 2,
            description=f"Cart subtotal {subtotal}",
            page=page,
        )

        await page.click('[data-test="proceed-checkout"]')
        await page.wait_for_selector('[data-test="delivery-address"]')
        await page.check('[data-test="slot-today-evening"]')
        total = (await page.text_content('[data-test="checkout-total"]') or "").strip()
        captured["total"] = total

        yield await emit_step(
            run_id=run_id,
            step=len(items) + 3,
            description=f"Checkout ready, total {total}. Mak Cik review dan bayar.",
            page=page,
        )
        await asyncio.sleep(1)
        await context.close()
        await browser.close()


def _query_for(sku: str) -> str:
    """Cheap search term derived from SKU. The mock filters on name+sku+brand."""
    return sku.split("-")[0].lower()


# ----- agent ---------------------------------------------------------------


async def _run_agent(
    run_id: str,
    items: list[ShoppingItem],
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """browser-use AI agent with deterministic recovery.

    Same two-track strategy as grant_application._run_agent:
    1. Patch browser-use, run the agent.
    2. Whatever the agent's final answer says, scrape subtotal/total
       directly from the cart and checkout DOM.
    3. If the agent stalled before checkout, navigate cart -> checkout
       -> select slot deterministically so the totals are still readable.
    """
    from browser_use import Agent, Browser, BrowserConfig
    from browser_use.browser.context import BrowserContext, BrowserContextConfig

    from ..lib.agent_llm import select_agent_llm, selected_provider_name
    from ..lib.patch_browser_use import apply as patch_browser_use

    patch_browser_use()
    llm = select_agent_llm()

    list_text = "\n".join(f"{i+1}. {it.sku} (qty {it.quantity})" for i, it in enumerate(items))
    task = (
        f"You are doing a procurement run on Lotus's Online at {DEFAULT_LOTUS_URL}.\n"
        "1. For each item below, search by SKU or product name, then click "
        '"Add to Cart" the listed quantity of times.\n'
        "2. Open the cart from the header.\n"
        '3. Click "Proceed to Checkout".\n'
        "4. Select the earliest delivery slot.\n"
        "5. STOP at the checkout page. Do NOT click Place Order.\n"
        "Return the final total.\n\n"
        f"Shopping list:\n{list_text}"
    )

    yield {
        "runId": run_id,
        "step": 1,
        "description": f"Agent starting Lotus run via {selected_provider_name()}",
    }

    browser = Browser(config=BrowserConfig(headless=HEADLESS))
    context = BrowserContext(
        browser=browser,
        config=BrowserContextConfig(
            highlight_elements=False,
            wait_between_actions=0.2,
            wait_for_network_idle_page_load_time=0.3,
            minimum_wait_page_load_time=0.1,
        ),
    )

    agent = Agent(
        task=task,
        llm=llm,
        browser_context=context,
        use_vision=True,
        max_failures=3,
        max_actions_per_step=4,
    )

    try:
        await agent.run(max_steps=50)
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": 2,
            "description": f"Agent loop crashed: {exc}. Trying deterministic recovery.",
        }

    page = await context.get_current_page()
    on_checkout = False
    try:
        await page.wait_for_selector('[data-test="checkout-total"]', timeout=2000)
        on_checkout = True
    except Exception:
        # Try our own checkout navigation if the agent didn't get there.
        try:
            await page.click('[data-test="cart-button"]')
            await page.click('[data-test="proceed-checkout"]')
            await page.wait_for_selector('[data-test="checkout-total"]', timeout=5000)
            on_checkout = True
            yield {
                "runId": run_id,
                "step": 3,
                "description": "Agent did not reach checkout, navigated deterministically.",
            }
        except Exception:
            on_checkout = False

    if on_checkout:
        # Make sure a slot is selected so total includes delivery fee.
        try:
            await page.check('[data-test="slot-today-evening"]')
        except Exception:
            pass
        subtotal = (await page.text_content('[data-test="cart-subtotal"]') or "").strip()
        total = (await page.text_content('[data-test="checkout-total"]') or "").strip()
        captured["subtotal"] = subtotal or None
        captured["total"] = total or None
        yield await emit_step(
            run_id=run_id,
            step=99,
            description=f"Agent finished. Subtotal {subtotal} - Total {total}",
            page=page,
        )
    else:
        captured["subtotal"] = None
        captured["total"] = None
        yield {
            "runId": run_id,
            "step": 99,
            "description": "Agent did not reach checkout. No totals captured.",
        }

    await context.close()
    await browser.close()
