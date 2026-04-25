"""Runtime monkey-patch for browser-use 0.1.40 to suppress headful screenshot flicker.

Two known causes of visible flicker per agent step:
  1. page.screenshot() in headful Chromium temporarily resizes the window to ~1px
     before capturing, then restores it. Playwright issues #2576, #29487, #30149.
  2. page.bring_to_front() triggers a focus/repaint cycle even with one tab.

Fix: replace BrowserContext.take_screenshot with a CDP-based capture
(Page.captureScreenshot) which does not touch window size, and skip
bring_to_front entirely.

Use:
    from .patch_browser_use import apply as patch_browser_use
    patch_browser_use()  # idempotent

Apply only when running in agent mode. Scripted Playwright takes its own
screenshots through emit_step() and is not affected.
"""

from __future__ import annotations

from browser_use.browser.context import BrowserContext


_applied = False


async def _take_screenshot_cdp(self, full_page: bool = False) -> str:
    page = await self.get_current_page()
    await page.wait_for_load_state()

    cdp = await page.context.new_cdp_session(page)
    try:
        result = await cdp.send(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": bool(full_page)},
        )
    finally:
        await cdp.detach()

    return result["data"]


def apply() -> None:
    """Install the CDP-based screenshot patch. Idempotent."""
    global _applied
    if _applied:
        return
    BrowserContext.take_screenshot = _take_screenshot_cdp
    _applied = True
