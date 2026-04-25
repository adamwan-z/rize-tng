"""Grant application flow.

Public entry: `run_grant_application`. Importable, HTTP-callable, CLI-callable.
All three paths route through `GrantApplicationRequest` for validation.

Modes:
- scripted: deterministic Playwright fill. No API key. Demo-safe.
- agent:    browser-use + Anthropic. The wow moment. Slower, occasionally flaky.

On any runtime exception, falls back to `replay_recording()` so the demo
never goes dark.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from ..runner import emit_step, replay_recording
from .types import GrantApplicationRequest, GrantProfile

RECORDINGS_DIR = Path(__file__).parent.parent.parent / "recordings"
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
DEFAULT_MOCK_URL = os.environ.get("MOCK_TNG_URL", "http://localhost:5000") + "/grant.html"


async def run_grant_application(
    *,
    run_id: str,
    profile: GrantProfile | dict[str, Any],
    application_url: str | None = None,
    grant_id: str = "unknown",
    mode: str = "scripted",
) -> AsyncIterator[dict[str, Any]]:
    """Drive the grant form. Yields StepEvent dicts.

    `profile` may be a GrantProfile or a dict. The dict path runs through
    Pydantic so HTTP callers and direct callers cannot diverge.
    """
    req = GrantApplicationRequest(
        profile=profile if isinstance(profile, GrantProfile) else GrantProfile(**profile),
        application_url=application_url,
        grant_id=grant_id,
        mode=mode,  # type: ignore[arg-type]
    )
    url = req.application_url or DEFAULT_MOCK_URL

    last_step = 0
    captured: dict[str, Any] = {}
    try:
        gen = (
            _run_scripted(run_id, url, req.profile, req.grant_id, captured)
            if req.mode == "scripted"
            else _run_agent(run_id, url, req.profile, req.grant_id, captured)
        )
        async for event in gen:
            last_step = max(last_step, int(event.get("step", 0)))
            yield event
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": (
                f"Application submitted. Reference: {captured.get('referenceNumber', 'unknown')}"
            ),
            "done": True,
            "result": {
                "ok": True,
                "grantId": req.grant_id,
                "mode": req.mode,
                "applicationUrl": url,
                "referenceNumber": captured.get("referenceNumber"),
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
            recording_path=RECORDINGS_DIR / "grant_happy_path.json",
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
                "grantId": req.grant_id,
                "referenceNumber": None,
            },
            "error": str(exc),
        }


# ----- scripted ------------------------------------------------------------


async def _run_scripted(
    run_id: str,
    url: str,
    profile: GrantProfile,
    grant_id: str,
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """Deterministic Playwright fill. Ports fill_scripted.py."""
    slow_mo = int(os.environ.get("SLOW_MO_MS", "450"))
    p = profile

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=slow_mo)
        context = await browser.new_context(viewport={"width": 1280, "height": 860})
        page = await context.new_page()

        yield await emit_step(
            run_id=run_id, step=1, description=f"Buka portal grant {grant_id}", page=page
        )
        await page.goto(url)
        await page.wait_for_selector('input[name="full_name"]')
        yield await emit_step(
            run_id=run_id, step=2, description="Step 1/3 Applicant", page=page
        )

        # ---- Step 1: Applicant ----
        await page.fill('input[name="full_name"]', p.full_name)
        await page.fill('input[name="nric"]', p.nric)
        await page.fill('input[name="mobile"]', p.mobile)
        await page.fill('input[name="email"]', p.email)
        yield await emit_step(
            run_id=run_id, step=3, description=f"Masukkan nama: {p.full_name}", page=page
        )
        await page.click('[data-test="step-1-next"]')

        # ---- Step 2: Business ----
        await page.wait_for_selector('input[name="business_name"]')
        yield await emit_step(
            run_id=run_id, step=4, description="Step 2/3 Business info", page=page
        )
        await page.fill('input[name="business_name"]', p.business_name)
        await page.fill('input[name="business_reg_no"]', p.business_reg_no)
        await page.select_option('select[name="business_type"]', value=p.business_type)
        await page.fill('textarea[name="business_address"]', p.business_address)
        await page.fill('input[name="years_operating"]', str(p.years_operating))
        await page.fill('input[name="employee_count"]', str(p.employee_count))
        yield await emit_step(
            run_id=run_id, step=5, description=f"Masukkan SSM: {p.business_reg_no}", page=page
        )
        await page.click('[data-test="step-2-next"]')

        # ---- Step 3: Funding ----
        await page.wait_for_selector('input[name="annual_revenue"]')
        yield await emit_step(
            run_id=run_id, step=6, description="Step 3/3 Funding details", page=page
        )
        await page.fill('input[name="annual_revenue"]', str(p.annual_revenue))
        await page.fill('input[name="requested_amount"]', str(p.requested_amount))
        await page.fill('textarea[name="purpose"]', p.purpose)
        await page.check('input[name="declare_truthful"]')
        await page.check('input[name="declare_terms"]')
        yield await emit_step(
            run_id=run_id,
            step=7,
            description="Borang lengkap. Submitting.",
            page=page,
        )

        # Submit the mock form so the success page renders the reference number.
        # The reference is what callers (orchestrator, FE) display to the merchant.
        await page.click('[data-test="submit"]')
        await page.wait_for_function(
            "() => document.body.dataset.submitted === 'true'",
            timeout=10_000,
        )
        ref = (await page.text_content('[data-test="reference-no"]') or "").strip()
        captured["referenceNumber"] = ref or None
        yield await emit_step(
            run_id=run_id,
            step=8,
            description=f"Submitted. Reference: {ref or '(none)'}",
            page=page,
        )

        await asyncio.sleep(1)
        await context.close()
        await browser.close()


# ----- agent ---------------------------------------------------------------


async def _run_agent(
    run_id: str,
    url: str,
    profile: GrantProfile,
    grant_id: str,
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """browser-use AI agent fill. Ports fill_agent.py."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY not set; agent mode unavailable")

    # Imports are local so scripted-only deployments do not need these libs.
    from browser_use import Agent, Browser, BrowserConfig
    from langchain_anthropic import ChatAnthropic

    profile_text = "\n".join(
        f"- {k.replace('_', ' ').title()}: {v}" for k, v in profile.model_dump().items()
    )
    task = (
        f"You are filing a grant application on behalf of a small business owner.\n"
        f"1. Open the SME Growth Fund application at {url}.\n"
        "2. The form has 3 steps: Applicant, Business, Funding. After each step, "
        'click the "Next" button.\n'
        "3. Fill every field accurately using the profile below.\n"
        "4. On step 3, tick BOTH declaration checkboxes, then click "
        '"Submit Application".\n'
        "5. After submission a success page shows a reference number prefixed "
        "TER-2026-04-. Read the reference number and return it as your final answer.\n\n"
        f"Profile:\n{profile_text}"
    )

    yield {
        "runId": run_id,
        "step": 1,
        "description": f"Agent starting against {grant_id}",
    }

    browser = Browser(config=BrowserConfig(headless=HEADLESS))
    agent = Agent(
        task=task,
        llm=ChatAnthropic(model="claude-sonnet-4-5", temperature=0, max_tokens=4096),
        browser=browser,
        use_vision=True,
        max_failures=3,
        max_actions_per_step=4,
    )

    history = await agent.run(max_steps=25)
    final = (history.final_result() or "").strip()
    # The agent's final answer is the reference number (per the task prompt).
    # Be lenient: accept either the raw ref string or any line containing it.
    import re

    match = re.search(r"TER-\d{4}-\d{2}-\d+", final)
    captured["referenceNumber"] = match.group(0) if match else None

    yield {
        "runId": run_id,
        "step": 99,
        "description": f"Agent finished. Reference: {captured['referenceNumber'] or final or '(none)'}",
    }
    await browser.close()
