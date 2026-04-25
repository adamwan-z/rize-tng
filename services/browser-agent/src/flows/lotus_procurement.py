"""Lotus procurement flow.

Two-phase: `run_lotus_procurement` fills the cart and stops at the checkout
page with the browser still open; `complete_lotus_checkout` clicks Place
Order on that same live page after the merchant has confirmed via chat.
The caller is responsible for `close_lotus_run(state)` once the run ends
(either confirmed or abandoned).

Validation rejects items whose SKU is not in the live catalog.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from playwright.async_api import Page, async_playwright

from ..runner import emit_step, replay_recording
from .types import LotusProcurementRequest, ShoppingItem

RECORDINGS_DIR = Path(__file__).parent.parent.parent / "recordings"
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
DEFAULT_LOTUS_URL = os.environ.get("MOCK_TNG_URL", "http://localhost:5050") + "/lotus.html"


async def run_lotus_procurement(
    *,
    run_id: str,
    items: list[ShoppingItem] | list[dict[str, Any]],
    mode: str = "scripted",
    captured: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Phase 1. Fill cart, navigate to checkout, capture totals.

    Stops at the checkout page with the browser still open. The terminator
    event has `awaiting_confirmation: True` so the caller can prompt the
    user. To resume, call `complete_lotus_checkout(state=captured)`; to
    abandon, call `close_lotus_run(captured)`.

    If `captured` is None, the browser is opened and closed within this
    call (legacy CLI / test path).
    """
    normalized: list[ShoppingItem] = [
        i if isinstance(i, ShoppingItem) else ShoppingItem(**i) for i in items
    ]
    req = LotusProcurementRequest(items=normalized, mode=mode)  # type: ignore[arg-type]

    standalone = captured is None
    state: dict[str, Any] = captured if captured is not None else {}
    state["items"] = req.items
    state["mode"] = req.mode

    last_step = 0
    try:
        gen = (
            _run_scripted(run_id, req.items, state)
            if req.mode == "scripted"
            else _run_agent(run_id, req.items, state)
        )
        async for event in gen:
            last_step = max(last_step, int(event.get("step", 0)))
            yield event
        state["last_step"] = last_step
        if state.get("agent_overran"):
            # Agent placed the order itself in phase 1. Skip the
            # awaiting_confirmation handshake and surface the completed
            # result so the LLM can tell the merchant it is done.
            order_ref = state.get("order_ref")
            yield {
                "runId": run_id,
                "step": last_step + 1,
                "description": f"Pesanan dah masuk. Ref {order_ref}.",
                "done": True,
                "result": {
                    "ok": True,
                    "mode": req.mode,
                    "items": [i.model_dump() for i in req.items],
                    "subtotal": state.get("subtotal"),
                    "total": state.get("total"),
                    "orderRef": order_ref,
                    "completedInPhase1": True,
                },
            }
            await close_lotus_run(state)
            return
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": "Cart ready. Tunggu konfirmasi dari merchant.",
            "done": True,
            "awaiting_confirmation": True,
            "result": {
                "ok": True,
                "mode": req.mode,
                "items": [i.model_dump() for i in req.items],
                "subtotal": state.get("subtotal"),
                "total": state.get("total"),
                "awaiting_confirmation": True,
            },
        }
        if standalone:
            await close_lotus_run(state)
        return
    except Exception as exc:
        await close_lotus_run(state)
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
            "result": {
                "ok": False,
                "fallback": True,
                "items": [i.model_dump() for i in req.items],
            },
            "error": str(exc),
        }


async def complete_lotus_checkout(
    *,
    run_id: str,
    state: dict[str, Any],
    start_step: int,
) -> AsyncIterator[dict[str, Any]]:
    """Phase 2. Click Place Order on the live checkout, capture order ref.

    The caller must call `close_lotus_run(state)` after iterating, even
    on failure.
    """
    page: Page | None = state.get("page")
    if page is None:
        yield {
            "runId": run_id,
            "step": start_step,
            "description": "No live browser to confirm. Run already closed.",
            "done": True,
            "result": {"ok": False, "error": "no_active_run"},
            "error": "no_active_run",
        }
        return

    try:
        yield await emit_step(
            run_id=run_id,
            step=start_step,
            description="Klik Place Order, bayar via TNG eWallet.",
            page=page,
        )
        await page.click('[data-test="place-order"]')
        await page.wait_for_function(
            "document.body.dataset.orderPlaced === 'true'", timeout=8000
        )
        order_ref = (
            await page.text_content('[data-test="order-ref"]') or ""
        ).strip()
        state["order_ref"] = order_ref
        yield await emit_step(
            run_id=run_id,
            step=start_step + 1,
            description=f"Pesanan confirmed. Ref {order_ref}.",
            page=page,
        )
        yield {
            "runId": run_id,
            "step": start_step + 2,
            "description": "Pesanan dah masuk. Ready untuk delivery.",
            "done": True,
            "result": {
                "ok": True,
                "orderRef": order_ref,
                "total": state.get("total"),
                "items": [
                    i.model_dump() if isinstance(i, ShoppingItem) else i
                    for i in state.get("items", [])
                ],
            },
        }
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": start_step + 1,
            "description": f"Place order failed: {exc}",
            "done": True,
            "result": {"ok": False, "error": str(exc)},
            "error": str(exc),
        }


async def close_lotus_run(state: dict[str, Any]) -> None:
    """Close all live Playwright handles in `state`. Safe to call repeatedly."""
    for key in ("context", "browser"):
        handle = state.pop(key, None)
        if handle is None:
            continue
        try:
            await handle.close()
        except Exception:
            pass
    pw = state.pop("pw", None)
    if pw is not None:
        try:
            await pw.stop()
        except Exception:
            pass
    state.pop("page", None)


# ----- scripted ------------------------------------------------------------


async def _run_scripted(
    run_id: str,
    items: list[ShoppingItem],
    state: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """Deterministic Playwright run. Stops at checkout with browser open.

    Lifecycle is manual (no `async with` block) so the caller can keep the
    browser alive between phase 1 and phase 2.
    """
    slow_mo = int(os.environ.get("SLOW_MO_MS", "350"))

    pw = await async_playwright().start()
    state["pw"] = pw
    browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=slow_mo)
    state["browser"] = browser
    context = await browser.new_context(viewport={"width": 1320, "height": 880})
    state["context"] = context
    page = await context.new_page()
    state["page"] = page

    yield await emit_step(
        run_id=run_id, step=1, description="Buka Lotus Malaysia", page=page
    )
    await page.goto(DEFAULT_LOTUS_URL)
    await page.wait_for_selector('[data-test="search-input"]')

    for idx, item in enumerate(items, start=2):
        # SKU search works reliably because the mock filters on name+sku+brand.
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
    state["subtotal"] = subtotal
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
    state["total"] = total

    yield await emit_step(
        run_id=run_id,
        step=len(items) + 3,
        description=f"Checkout ready, total {total}. Tunggu konfirmasi.",
        page=page,
    )


def _query_for(sku: str) -> str:
    """Cheap search term derived from SKU. The mock filters on name+sku+brand."""
    return sku.split("-")[0].lower()


# ----- agent ---------------------------------------------------------------


async def _run_agent(
    run_id: str,
    items: list[ShoppingItem],
    state: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """browser-use AI agent with deterministic recovery. Browser stays open.

    Same two-track strategy as the original: agent drives, then we scrape
    subtotal/total from the DOM regardless of what the agent reports.
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
    state["browser"] = browser
    context = BrowserContext(
        browser=browser,
        config=BrowserContextConfig(
            highlight_elements=False,
            wait_between_actions=0.2,
            wait_for_network_idle_page_load_time=0.3,
            minimum_wait_page_load_time=0.1,
        ),
    )
    state["context"] = context

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
    state["page"] = page

    # The prompt tells the agent to STOP at checkout, but LLMs sometimes
    # one-shot and click Place Order anyway. Detect that and surface it as
    # a successful completion instead of a broken confirm flow.
    try:
        already_placed = await page.evaluate(
            "document.body.dataset.orderPlaced === 'true'"
        )
    except Exception:
        already_placed = False

    if already_placed:
        order_ref = ""
        order_total = ""
        try:
            order_ref = (
                await page.evaluate("document.body.dataset.orderRef") or ""
            ).strip()
            order_total = (
                await page.evaluate("document.body.dataset.orderTotal") or ""
            ).strip()
        except Exception:
            pass
        state["agent_overran"] = True
        state["order_ref"] = order_ref
        state["total"] = order_total or state.get("total")
        yield await emit_step(
            run_id=run_id,
            step=99,
            description=f"Agent placed order autonomously. Ref {order_ref}.",
            page=page,
        )
        return

    on_checkout = False
    try:
        await page.wait_for_selector('[data-test="checkout-total"]', timeout=2000)
        on_checkout = True
    except Exception:
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
        try:
            await page.check('[data-test="slot-today-evening"]')
        except Exception:
            pass
        subtotal = (await page.text_content('[data-test="cart-subtotal"]') or "").strip()
        total = (await page.text_content('[data-test="checkout-total"]') or "").strip()
        state["subtotal"] = subtotal or None
        state["total"] = total or None
        yield await emit_step(
            run_id=run_id,
            step=99,
            description=f"Agent finished. Subtotal {subtotal} - Total {total}",
            page=page,
        )
    else:
        state["subtotal"] = None
        state["total"] = None
        yield {
            "runId": run_id,
            "step": 99,
            "description": "Agent did not reach checkout. No totals captured.",
        }
