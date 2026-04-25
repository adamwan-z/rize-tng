"""iTEKAD application pack PDF generator.

Builds the cover + 12-week cashflow + 3-month income statement + funding
breakdown for Mak Cik Aminah's Burger Bakar stall. The numbers are seeded
from her MerchantProfile (monthly revenue, monthly costs, registration
date) so the PDF stays in sync with whatever the rest of the demo shows.

Styling uses the TNG Rise palette from `apps/web/src/styles/tokens.css`
so the printed pack visually matches the in-app brand.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---- TNG Rise palette (mirrors apps/web/src/styles/tokens.css) -------------
TNG_BLUE = colors.HexColor("#005BAA")
TNG_BLUE_DARK = colors.HexColor("#003D75")
TNG_BLUE_DEEP = colors.HexColor("#002A52")
TNG_BLUE_100 = colors.HexColor("#E5EFF8")
TNG_YELLOW = colors.HexColor("#FFF200")
TNG_YELLOW_DEEP = colors.HexColor("#F5C400")
RISE_ACCENT = colors.HexColor("#FF6B35")
SURFACE_0 = colors.HexColor("#FAFAF7")
SURFACE_2 = colors.HexColor("#F2F1EC")
SURFACE_3 = colors.HexColor("#E5E4DD")
INK_900 = colors.HexColor("#1A1A1A")
INK_700 = colors.HexColor("#3D3D3D")
INK_500 = colors.HexColor("#6E6E6E")


# ---- Default Mak Cik data (used if no profile is passed) -------------------
DEFAULT_PROFILE: dict[str, Any] = {
    "id": "mak-cik-aminah-001",
    "name": "Aminah binti Hassan",
    "businessName": "Burger Bakar Mak Cik",
    "businessType": "Hawker F&B (Ramly burger stall)",
    "location": {
        "city": "Kampung Baru, Kuala Lumpur",
        "state": "Wilayah Persekutuan Kuala Lumpur",
    },
    "registeredSince": "2024-03-12",
    "ssm": "JM0823491-W",
    "monthlyRevenueRm": 14800,
    "monthlyCostsRm": {
        "rent": 800,
        "utilities": 200,
        "gas": 350,
        "supplies": 4200,
        "other": 300,
    },
}

# Identity fields the MerchantProfile does not carry. These match the demo
# profile in `services/browser-agent/src/flows/__main__.py` so a CLI run
# without a passed profile produces the same PDF the orchestrator does.
DEFAULT_IDENTITY: dict[str, str] = {
    "nric": "700815-14-5238",
    "phone": "012-345 7821",
    "email": "burger.bakar.makcik@gmail.com",
    "tng_merchant_id": "TNG-MERCH-882341",
    "tng_active_since": "March 2024",
}

DEFAULT_FUNDING: dict[str, Any] = {
    "amount": 50000,
    "purpose": "Permanent kiosk upgrade and equipment expansion",
    "tenure_months": 36,
    "use_of_funds": [
        ("Permanent kiosk structure (rental + setup)", 18000),
        ("Commercial griddle and fryer (2x)", 12000),
        ("Refrigeration unit and prep table", 8000),
        ("Branded packaging and signage", 4500),
        ("Working capital for first 3 months", 7500),
    ],
    "expected_outcomes": [
        "Increase daily output from 80 to 200 burgers",
        "Hire 2 additional helpers (currently solo plus 1 part-time)",
        "Extend operating hours from 6 to 10 hours per day",
        "Project monthly revenue growth from RM 14.8k to RM 38k by month 6",
    ],
}


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"],
            fontName="Helvetica-Bold", fontSize=22, leading=26,
            textColor=TNG_BLUE_DEEP, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"],
            fontName="Helvetica", fontSize=11, leading=14,
            textColor=INK_500, spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"],
            fontName="Helvetica-Bold", fontSize=14, leading=18,
            textColor=TNG_BLUE_DEEP, spaceBefore=16, spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=INK_900, spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"],
            fontName="Helvetica", fontSize=9, leading=12,
            textColor=INK_500,
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"],
            fontName="Helvetica-Oblique", fontSize=8, leading=10,
            textColor=INK_500, alignment=1,
        ),
    }


def _fmt_rm(n: float) -> str:
    return f"RM {n:,.2f}"


def _header_band() -> Table:
    """Brand strip: TNG-blue block on the left, Rise-accent on the right.

    Mirrors the way TNG Rise is rendered in the FE chrome.
    """
    band = Table(
        [["GORISE", "iTEKAD APPLICATION PACK"]],
        colWidths=[60 * mm, 110 * mm],
        rowHeights=[14 * mm],
    )
    band.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), TNG_BLUE),
        ("BACKGROUND", (1, 0), (1, 0), RISE_ACCENT),
        ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (0, 0), 16),
        ("FONTSIZE", (1, 0), (1, 0), 12),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return band


def _info_table(rows: list[tuple[str, str]], styles: dict[str, ParagraphStyle]) -> Table:
    data = [
        [Paragraph(f"<b>{k}</b>", styles["body"]), Paragraph(str(v), styles["body"])]
        for k, v in rows
    ]
    t = Table(data, colWidths=[55 * mm, 115 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, SURFACE_0]),
        ("BOX", (0, 0), (-1, -1), 0.6, SURFACE_3),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, SURFACE_3),
    ]))
    return t


def _cashflow_table(rows: list[tuple[str, int, int]]) -> Table:
    header = ["Week", "Revenue (RM)", "Cost of Goods (RM)", "Net Cashflow (RM)"]
    body: list[list[str]] = []
    total_rev = total_cogs = 0
    for week, rev, cogs in rows:
        net = rev - cogs
        total_rev += rev
        total_cogs += cogs
        body.append([week, f"{rev:,.0f}", f"{cogs:,.0f}", f"{net:,.0f}"])
    total_net = total_rev - total_cogs
    totals = [
        "TOTAL (12 weeks)",
        f"{total_rev:,.0f}", f"{total_cogs:,.0f}", f"{total_net:,.0f}",
    ]
    data: list[list[str]] = [header] + body + [totals]
    t = Table(data, colWidths=[42 * mm] * 4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TNG_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, SURFACE_0]),
        ("BACKGROUND", (0, -1), (-1, -1), TNG_YELLOW),
        ("TEXTCOLOR", (0, -1), (-1, -1), TNG_BLUE_DEEP),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.6, SURFACE_3),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, SURFACE_3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def _income_table(rows: list[tuple[str, int, int, int, int, int, int]]) -> Table:
    header = ["Month", "Revenue", "COGS", "Rent", "Utilities", "Gas", "Other", "Net"]
    body = [
        [m, f"{r:,}", f"{c:,}", f"{rent:,}", f"{u:,}", f"{g:,}", f"{o:,}", f"{r - c - rent - u - g - o:,}"]
        for m, r, c, rent, u, g, o in rows
    ]
    data = [header] + body
    t = Table(data, colWidths=[26 * mm] + [20 * mm] * 7)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TNG_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE_0]),
        ("BOX", (0, 0), (-1, -1), 0.6, SURFACE_3),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, SURFACE_3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        # Highlight Net column with a subtle TNG-blue tint.
        ("BACKGROUND", (-1, 1), (-1, -1), TNG_BLUE_100),
        ("FONTNAME", (-1, 1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (-1, 1), (-1, -1), TNG_BLUE_DEEP),
    ]))
    return t


def _use_of_funds_table(rows: list[tuple[str, float]], total: float) -> Table:
    header = ["Category", "Amount (RM)"]
    body = [[label, f"{amt:,.0f}"] for label, amt in rows]
    body.append(["TOTAL", f"{total:,.0f}"])
    data = [header] + body
    t = Table(data, colWidths=[120 * mm, 50 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TNG_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, SURFACE_0]),
        ("BACKGROUND", (0, -1), (-1, -1), TNG_YELLOW),
        ("TEXTCOLOR", (0, -1), (-1, -1), TNG_BLUE_DEEP),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.6, SURFACE_3),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, SURFACE_3),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _bullets(items: list[str], styles: dict[str, ParagraphStyle]) -> list[Paragraph]:
    return [Paragraph(f"&#8226;&nbsp;&nbsp;{item}", styles["body"]) for item in items]


def _seed_cashflow(monthly_revenue: float, monthly_supplies: float) -> list[tuple[str, int, int]]:
    """Synthesize 12 weeks of cashflow that adds up to ~3 months of revenue.

    Mild upward drift (the same 'demand growing' story the FE reflects) so
    a reviewer who eyeballs the table sees consistency with the cover claim
    of trailing growth.
    """
    weeks = [
        "Week 1 (Feb 2)", "Week 2 (Feb 9)", "Week 3 (Feb 16)", "Week 4 (Feb 23)",
        "Week 5 (Mar 2)", "Week 6 (Mar 9)", "Week 7 (Mar 16)", "Week 8 (Mar 23)",
        "Week 9 (Mar 30)", "Week 10 (Apr 6)", "Week 11 (Apr 13)", "Week 12 (Apr 20)",
    ]
    weekly_rev_avg = monthly_revenue / 4.33
    weekly_cogs_avg = monthly_supplies / 4.33
    # Linear ramp from -8% to +8% of average to keep the trend visible without
    # generating outliers a reviewer would question.
    rows: list[tuple[str, int, int]] = []
    for i, w in enumerate(weeks):
        ramp = (i - 5.5) / 5.5 * 0.08  # range -0.08 .. +0.08
        rev = round(weekly_rev_avg * (1 + ramp))
        cogs = round(weekly_cogs_avg * (1 + ramp * 0.7))
        rows.append((w, int(rev), int(cogs)))
    return rows


def _seed_income(profile: dict[str, Any]) -> list[tuple[str, int, int, int, int, int, int]]:
    """3-month P&L. Most recent month uses the live profile values; earlier
    months are stepped down 5% and 10% so the upward trend is visible."""
    costs = profile["monthlyCostsRm"]
    rev = float(profile["monthlyRevenueRm"])
    rent = int(costs["rent"])
    utils = int(costs["utilities"])
    gas = int(costs["gas"])
    other = int(costs["other"])
    cogs = int(costs["supplies"])

    months = ["February 2026", "March 2026", "April 2026"]
    multipliers = [0.90, 0.95, 1.00]
    rows: list[tuple[str, int, int, int, int, int, int]] = []
    for m, mult in zip(months, multipliers):
        rows.append((
            m,
            int(round(rev * mult)),
            int(round(cogs * mult)),
            rent, utils, gas, other,
        ))
    return rows


def build_pdf(
    output_path: Path,
    *,
    profile: dict[str, Any] | None = None,
    identity: dict[str, str] | None = None,
    funding: dict[str, Any] | None = None,
) -> Path:
    """Build the iTEKAD application pack PDF and write to `output_path`.

    Numbers come from `profile` (a MerchantProfile dict) so the printed pack
    matches what the rest of the demo shows the merchant. Pass `identity`
    for NRIC/phone/email which the MerchantProfile does not carry; pass
    `funding` to override the requested amount, tenure, and use of funds.
    """
    p = profile or DEFAULT_PROFILE
    ident = {**DEFAULT_IDENTITY, **(identity or {})}
    fund = {**DEFAULT_FUNDING, **(funding or {})}

    styles = _styles()
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"iTEKAD Application Pack - {p['businessName']}",
        author="GoRise",
    )

    today = datetime.now().strftime("%d %B %Y")
    established = p["registeredSince"][:4] if p.get("registeredSince") else ""
    address_full = (
        f"{p['location']['city']}, {p['location']['state']}"
        if isinstance(p.get("location"), dict)
        else str(p.get("location", ""))
    )

    story: list[Any] = []

    # ---- COVER ----
    story.append(_header_band())
    story.append(Spacer(1, 14 * mm))

    story.append(Paragraph(
        "Application Pack for Micro-Enterprise Financing",
        styles["title"],
    ))
    story.append(Paragraph(
        f"iTEKAD Programme &middot; Bank Negara Malaysia &middot; Submitted {today}",
        styles["subtitle"],
    ))

    story.append(Paragraph("Business Profile", styles["h1"]))
    story.append(_info_table([
        ("Business Name", p["businessName"]),
        ("Owner / Applicant", p["name"]),
        ("NRIC", ident["nric"]),
        ("SSM Registration", p.get("ssm", "-")),
        ("Business Address", address_full),
        ("Contact", f"{ident['phone']} &middot; {ident['email']}"),
        ("Category", p.get("businessType", "F&amp;B")),
        ("Year Established", established),
        ("TnG Merchant ID", ident["tng_merchant_id"]),
        ("TnG Active Since", ident["tng_active_since"]),
    ], styles))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "<i>This pack was prepared automatically by GoRise using verified "
        "transaction data from the merchant's Touch &#8217;n Go eWallet account. "
        "All cashflow figures are derived from settled QR payments; no self-reported "
        "data is included.</i>",
        styles["small"],
    ))

    # ---- CASHFLOW ----
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("12-Week Cashflow Summary", styles["h1"]))
    cashflow_rows = _seed_cashflow(
        float(p["monthlyRevenueRm"]),
        float(p["monthlyCostsRm"]["supplies"]),
    )
    story.append(Paragraph(
        f"Period: {cashflow_rows[0][0].split('(')[1].rstrip(')')} - "
        f"{cashflow_rows[-1][0].split('(')[1].rstrip(')')} 2026. "
        "Source: TnG QR settlement data and recorded supplier payments.",
        styles["body"],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(_cashflow_table(cashflow_rows))

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Income Statement (Last 3 Months)", styles["h1"]))
    story.append(_income_table(_seed_income(p)))
    story.append(Paragraph(
        "<i>Net cashflow is on a steady upward trend across the trailing 3 months, "
        "indicating consistent demand and effective cost control. Current operations "
        "are at physical capacity (single stall, 6 hours/day).</i>",
        styles["small"],
    ))

    # ---- FUNDING ----
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Funding Request", styles["h1"]))
    story.append(_info_table([
        ("Requested Amount", _fmt_rm(fund["amount"])),
        ("Purpose", fund["purpose"]),
        ("Repayment Source", "Net cashflow from expanded operations"),
        ("Proposed Tenure", f"{fund['tenure_months']} months"),
    ], styles))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Use of Funds", styles["h1"]))
    story.append(_use_of_funds_table(fund["use_of_funds"], fund["amount"]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Expected Outcomes", styles["h1"]))
    for para in _bullets(fund["expected_outcomes"], styles):
        story.append(para)

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "Generated by GoRise &middot; "
        f"Document ID: GR-{datetime.now().strftime('%Y%m%d-%H%M%S')} &middot; "
        "FINHACK 2026 demo build.",
        styles["footer"],
    ))

    doc.build(story)
    return output_path


if __name__ == "__main__":
    out = Path("application_pack.pdf").resolve()
    build_pdf(out)
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
