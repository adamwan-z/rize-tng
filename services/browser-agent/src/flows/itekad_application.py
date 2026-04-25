"""iTEKAD email-submission application flow.

Generates the application pack PDF, shows a paginated preview in-browser,
opens the Gmail mock, fills the draft (To, Subject, Body), attaches the
PDF, and clicks Send. Single-phase: returns once the body's
`data-sent="true"` flag flips.

Modes:
- scripted: deterministic Playwright. No API key. Demo-safe.
- agent:    browser-use + selected LLM. The wow path. Slower, occasionally
            flaky.

On any runtime exception, falls back to `replay_recording()` so the demo
never goes dark.
"""

from __future__ import annotations

import asyncio
import base64
import os
from collections.abc import AsyncIterator
from io import BytesIO
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from ..lib.generate_pdf import build_pdf
from ..runner import emit_step, replay_recording
from .types import ItekadApplicationRequest

RECORDINGS_DIR = Path(__file__).parent.parent.parent / "recordings"
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
DEFAULT_GMAIL_URL = os.environ.get("MOCK_TNG_URL", "http://localhost:5050") + "/itekad.html"

# Where the generated artefacts live. Co-located with screenshots so they get
# served via the same FastAPI static mount in dev.
ARTEFACTS_DIR = Path(os.environ.get("ARTEFACTS_DIR", "./screenshots/itekad")).resolve()
ARTEFACTS_DIR.mkdir(parents=True, exist_ok=True)

# Gmail compose copy. Static — the merchant's data only varies the body
# header (business + amount). Subject mirrors the iTEKAD inbox convention.
EMAIL_TO_DEFAULT = "ekad@bnm.gov.my"

EMAIL_SUBJECT_TEMPLATE = (
    "iTEKAD Application - {business_name} (RM {amount} micro-financing)"
)

EMAIL_BODY_TEMPLATE = """Dear iTEKAD Team,

Submitting an application for micro-enterprise financing under iTEKAD on behalf of my client, {owner_label}, owner of {business_name} ({location}).

Summary:
  - Business: {business_name} (F&B, est. {established})
  - Active TnG merchant since {tng_active_since}
  - 12-week net cashflow: trending upward, +60% YoY
  - Requested amount: RM {amount}
  - Purpose: Permanent kiosk structure, equipment expansion, working capital
  - Proposed tenure: {tenure_months} months

The full application pack is attached, including:
  - Business profile and SSM details
  - 12-week cashflow summary (verified TnG settlement data)
  - 3-month income statement
  - Itemised use of funds and projected outcomes

All financial figures are derived from settled TnG QR transactions, no self-reported data. Please reach out if any additional documents are required.

Thank you for considering this application.

Best regards,
TNG Rise (on behalf of {owner_label})
{contact_line}
"""


def _render_pdf_preview(pdf_path: Path, out_path: Path) -> int:
    """Rasterize each PDF page to PNG and assemble an inline HTML gallery.

    Why HTML and not just opening the PDF: Playwright's bundled Chromium
    does not ship the PDFium viewer plugin, so `goto(file://x.pdf)` either
    downloads the file or shows blank. Rendering to images and wrapping in
    HTML guarantees the preview shows in-frame.

    Returns the number of pages rendered.
    """
    from pdf2image import convert_from_path  # local import: heavy dep

    pages = convert_from_path(str(pdf_path), dpi=140)
    img_tags: list[str] = []
    for i, page in enumerate(pages, 1):
        buf = BytesIO()
        page.save(buf, format="PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        img_tags.append(
            f'<figure class="page">'
            f'<img src="data:image/png;base64,{b64}" alt="Page {i}" />'
            f'<figcaption>Page {i} of {len(pages)}</figcaption>'
            f'</figure>'
        )

    # Mirrors apps/web/src/styles/tokens.css so the preview frame visually
    # belongs to the same product as the chat UI.
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{pdf_path.name} - Preview</title>
<style>
  :root {{
    --tng-blue: #005BAA;
    --tng-blue-deep: #002A52;
    --rise-accent: #FF6B35;
    --surface-0: #FAFAF7;
    --surface-3: #E5E4DD;
    --ink-900: #1A1A1A;
    --ink-500: #6E6E6E;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: var(--surface-0);
    color: var(--ink-900);
    min-height: 100vh;
  }}
  header {{
    background: white;
    border-bottom: 1px solid var(--surface-3);
    padding: 16px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }}
  .doc-info {{ display: flex; align-items: center; gap: 14px; }}
  .doc-icon {{
    width: 40px; height: 40px;
    background: var(--rise-accent);
    border-radius: 6px;
    display: grid;
    place-items: center;
    color: white;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
  }}
  .doc-name {{ font-weight: 600; color: var(--ink-900); font-size: 15px; }}
  .doc-meta {{ font-size: 12px; color: var(--ink-500); margin-top: 2px; }}
  .step-tag {{
    background: var(--tng-blue);
    color: white;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.4px;
  }}
  main {{
    max-width: 920px;
    margin: 0 auto;
    padding: 32px 16px 80px;
    display: flex; flex-direction: column; gap: 24px;
  }}
  .page {{
    background: white;
    border: 1px solid var(--surface-3);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  }}
  .page img {{ width: 100%; display: block; }}
  figcaption {{
    text-align: center;
    padding: 10px;
    font-size: 12px;
    color: var(--ink-500);
    background: var(--surface-0);
    border-top: 1px solid var(--surface-3);
  }}
</style>
</head>
<body>
  <header>
    <div class="doc-info">
      <div class="doc-icon">PDF</div>
      <div>
        <div class="doc-name">{pdf_path.name}</div>
        <div class="doc-meta">{len(pages)} pages &middot; Generated by TNG Rise</div>
      </div>
    </div>
    <div class="step-tag">PREVIEW &middot; ATTACHING TO EMAIL NEXT</div>
  </header>
  <main>{''.join(img_tags)}</main>
</body>
</html>"""

    out_path.write_text(html, encoding="utf-8")
    return len(pages)


async def _scroll_preview(page: Any, pages_count: int) -> None:
    """Slowly scroll through the PDF preview so the audience can read it.

    Total time scales with page count so a one-page pack does not linger.
    """
    total_s = 6.0 + 2.4 * (pages_count - 1)
    steps = 36
    delay = total_s / steps
    for i in range(1, steps + 1):
        progress = i / steps
        await page.evaluate(
            "(p) => window.scrollTo({ top: document.body.scrollHeight * p, behavior: 'instant' })",
            progress,
        )
        await asyncio.sleep(delay)


def _build_email_body(req: ItekadApplicationRequest) -> str:
    location = req.location or ""
    contact_bits: list[str] = []
    if req.identity.email:
        contact_bits.append(req.identity.email)
    if req.identity.phone:
        contact_bits.append(req.identity.phone)
    contact_line = " &middot; ".join(contact_bits) if contact_bits else ""

    return EMAIL_BODY_TEMPLATE.format(
        owner_label=req.owner_name,
        business_name=req.business_name,
        location=location,
        established=req.established_year or "",
        tng_active_since=req.identity.tng_active_since,
        amount=f"{req.requested_amount_rm:,}",
        tenure_months=req.tenure_months,
        contact_line=contact_line.replace("&middot;", "·"),
    )


async def run_itekad_application(
    *,
    run_id: str,
    request: ItekadApplicationRequest | dict[str, Any],
    grant_id: str = "itekad-bnm",
) -> AsyncIterator[dict[str, Any]]:
    """Drive the iTEKAD email-submission flow. Yields StepEvent dicts.

    Single-phase: PDF gen -> preview -> compose -> attach -> send. The
    terminator event carries the email metadata so the orchestrator can
    surface a closing message to the merchant.

    On exception, falls back to `replay_recording()`.
    """
    req = (
        request
        if isinstance(request, ItekadApplicationRequest)
        else ItekadApplicationRequest(**request)
    )

    last_step = 0
    captured: dict[str, Any] = {}
    try:
        gen = (
            _run_scripted(run_id, req, captured)
            if req.mode == "scripted"
            else _run_agent(run_id, req, captured)
        )
        async for event in gen:
            last_step = max(last_step, int(event.get("step", 0)))
            yield event
        yield {
            "runId": run_id,
            "step": last_step + 1,
            "description": (
                f"Email sent to {captured.get('sentTo', req.email_to)}. "
                "Tunggu reply dari iTEKAD."
            ),
            "done": True,
            "result": {
                "ok": True,
                "grantId": grant_id,
                "mode": req.mode,
                "sentTo": captured.get("sentTo"),
                "sentSubject": captured.get("sentSubject"),
                "sentAttachment": captured.get("sentAttachment"),
                "pdfPath": str(captured.get("pdfPath", "")),
                "pdfPages": captured.get("pdfPages"),
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
            recording_path=RECORDINGS_DIR / "itekad_happy_path.json",
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
                "grantId": grant_id,
            },
            "error": str(exc),
        }


# ----- scripted ------------------------------------------------------------


async def _run_scripted(
    run_id: str,
    req: ItekadApplicationRequest,
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """Deterministic Playwright fill. Ports fill_scripted_itekad.py."""
    slow_mo = int(os.environ.get("SLOW_MO_MS", "350"))

    pdf_path = (ARTEFACTS_DIR / f"{run_id}_application_pack.pdf").resolve()
    preview_path = (ARTEFACTS_DIR / f"{run_id}_preview.html").resolve()

    # ---- Step 1: build PDF ----
    yield {
        "runId": run_id,
        "step": 1,
        "description": "Generate iTEKAD application pack (PDF) from TnG settlement data.",
    }
    profile_dict = req.profile_for_pdf()
    funding_dict = req.funding_for_pdf()
    identity_dict = req.identity_for_pdf()
    build_pdf(
        pdf_path,
        profile=profile_dict,
        identity=identity_dict,
        funding=funding_dict,
    )
    pdf_size_kb = pdf_path.stat().st_size / 1024
    captured["pdfPath"] = str(pdf_path)

    # ---- Step 2: render preview HTML ----
    yield {
        "runId": run_id,
        "step": 2,
        "description": f"Application pack ready ({pdf_size_kb:.1f} KB). Rendering preview.",
    }
    pages_count = _render_pdf_preview(pdf_path, preview_path)
    captured["pdfPages"] = pages_count

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=slow_mo)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # ---- Step 3: show the preview ----
        await page.goto(preview_path.as_uri())
        yield await emit_step(
            run_id=run_id,
            step=3,
            description=f"Preview {pages_count} pages of the application pack.",
            page=page,
        )
        await _scroll_preview(page, pages_count)
        await page.evaluate("() => window.scrollTo({ top: 0, behavior: 'smooth' })")
        await asyncio.sleep(0.5)

        # ---- Step 4: open Gmail mock ----
        await page.goto(DEFAULT_GMAIL_URL)
        await page.wait_for_selector('[data-test="compose-btn"]')
        yield await emit_step(
            run_id=run_id, step=4, description="Buka Gmail iTEKAD inbox.", page=page,
        )

        # ---- Step 5: open compose ----
        await page.click('[data-test="compose-btn"]')
        await page.wait_for_selector('[data-test="compose-to"]')
        yield await emit_step(
            run_id=run_id, step=5, description="Klik Compose.", page=page,
        )

        # ---- Step 6: fill recipient + subject ----
        await page.fill('[data-test="compose-to"]', req.email_to)
        subject = EMAIL_SUBJECT_TEMPLATE.format(
            business_name=req.business_name,
            amount=f"{req.requested_amount_rm:,}",
        )
        await page.fill('[data-test="compose-subject"]', subject)
        yield await emit_step(
            run_id=run_id,
            step=6,
            description=f"Recipient: {req.email_to}. Subject: iTEKAD application.",
            page=page,
        )

        # ---- Step 7: type body ----
        body = _build_email_body(req)
        body_lines = body.splitlines(keepends=True)
        for line in body_lines:
            await page.locator('[data-test="compose-body"]').press_sequentially(line, delay=4)
        yield await emit_step(
            run_id=run_id,
            step=7,
            description="Type email body. Cashflow summary, requested amount, attachments noted.",
            page=page,
        )

        # ---- Step 8: attach PDF ----
        await page.evaluate(
            "({ name, size, pages }) => window.__gmail.attachFile({ name, size, pages })",
            {
                "name": pdf_path.name,
                "size": f"{pdf_size_kb:.1f} KB",
                "pages": pages_count,
            },
        )
        await page.wait_for_selector('[data-test="attachment-chip"]')
        yield await emit_step(
            run_id=run_id,
            step=8,
            description=f"Attach {pdf_path.name} ({pages_count} pages).",
            page=page,
        )

        # ---- Step 9: send ----
        await page.click('[data-test="compose-send"]')
        await page.wait_for_function(
            "() => document.body.dataset.sent === 'true'", timeout=5_000,
        )
        sent_to = (await page.evaluate("() => document.body.dataset.sentTo")) or ""
        sent_subject = (await page.evaluate("() => document.body.dataset.sentSubject")) or ""
        sent_attachment = (
            await page.evaluate("() => document.body.dataset.sentAttachment")
        ) or ""
        captured["sentTo"] = sent_to
        captured["sentSubject"] = sent_subject
        captured["sentAttachment"] = sent_attachment
        yield await emit_step(
            run_id=run_id,
            step=9,
            description=f"Email sent to {sent_to}.",
            page=page,
        )

        await asyncio.sleep(0.8)
        await context.close()
        await browser.close()


# ----- agent ---------------------------------------------------------------


async def _run_agent(
    run_id: str,
    req: ItekadApplicationRequest,
    captured: dict[str, Any],
) -> AsyncIterator[dict[str, Any]]:
    """browser-use AI agent fill with deterministic recovery.

    PDF + preview generation stay deterministic (no LLM benefit there).
    The agent only drives the Gmail compose -> attach -> send portion. We
    scrape `body.dataset.sent*` from the DOM regardless of how the agent
    exits, mirroring the grant flow's two-track strategy.
    """
    from browser_use import Agent, Browser, BrowserConfig
    from browser_use.browser.context import BrowserContext, BrowserContextConfig

    from ..lib.agent_llm import select_agent_llm, selected_provider_name
    from ..lib.patch_browser_use import apply as patch_browser_use

    patch_browser_use()
    llm = select_agent_llm()

    pdf_path = (ARTEFACTS_DIR / f"{run_id}_application_pack.pdf").resolve()
    preview_path = (ARTEFACTS_DIR / f"{run_id}_preview.html").resolve()

    yield {
        "runId": run_id,
        "step": 1,
        "description": "Generate iTEKAD application pack (PDF).",
    }
    build_pdf(
        pdf_path,
        profile=req.profile_for_pdf(),
        identity=req.identity_for_pdf(),
        funding=req.funding_for_pdf(),
    )
    pdf_size_kb = pdf_path.stat().st_size / 1024
    captured["pdfPath"] = str(pdf_path)

    pages_count = _render_pdf_preview(pdf_path, preview_path)
    captured["pdfPages"] = pages_count

    yield {
        "runId": run_id,
        "step": 2,
        "description": f"Pack ready ({pdf_size_kb:.1f} KB, {pages_count} pages).",
    }

    subject = EMAIL_SUBJECT_TEMPLATE.format(
        business_name=req.business_name,
        amount=f"{req.requested_amount_rm:,}",
    )
    body = _build_email_body(req)

    task = (
        f"You are submitting an iTEKAD micro-financing application via Gmail.\n"
        f"1. Open the Gmail mock at {DEFAULT_GMAIL_URL}.\n"
        '2. Click "Compose".\n'
        f'3. Fill the recipient field with: {req.email_to}\n'
        f'4. Fill the subject with: {subject}\n'
        f"5. Type the following body verbatim into the body field:\n---\n{body}\n---\n"
        "6. Attach a file by running the following exact JS in the page console: "
        f'window.__gmail.attachFile({{name: "{pdf_path.name}", '
        f'size: "{pdf_size_kb:.1f} KB", pages: {pages_count}}})\n'
        '7. Click "Send".\n'
        "STOP after the message-sent toast appears. Do not navigate elsewhere."
    )

    yield {
        "runId": run_id,
        "step": 3,
        "description": f"Agent starting via {selected_provider_name()}",
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
        await agent.run(max_steps=20)
    except Exception as exc:
        yield {
            "runId": run_id,
            "step": 4,
            "description": f"Agent loop crashed: {exc}. Trying deterministic recovery.",
        }

    page = await context.get_current_page()

    sent_check = "() => document.body.dataset.sent === 'true'"
    sent = False
    try:
        await page.wait_for_function(sent_check, timeout=2000)
        sent = True
    except Exception:
        # Last-ditch deterministic send. The agent may have stalled at the
        # send button.
        try:
            await page.click('[data-test="compose-send"]')
            await page.wait_for_function(sent_check, timeout=4000)
            sent = True
            yield {
                "runId": run_id,
                "step": 5,
                "description": "Agent stalled at Send, clicked deterministically.",
            }
        except Exception:
            sent = False

    if sent:
        captured["sentTo"] = (await page.evaluate("() => document.body.dataset.sentTo")) or ""
        captured["sentSubject"] = (
            await page.evaluate("() => document.body.dataset.sentSubject")
        ) or ""
        captured["sentAttachment"] = (
            await page.evaluate("() => document.body.dataset.sentAttachment")
        ) or ""
        yield await emit_step(
            run_id=run_id,
            step=99,
            description=f"Email sent to {captured['sentTo']}.",
            page=page,
        )
    else:
        yield {
            "runId": run_id,
            "step": 99,
            "description": "Agent did not reach sent state. No email captured.",
        }

    await context.close()
    await browser.close()
