"""Stable selectors for portals we automate. Keep last-verified dates fresh.

Prefer in this order:
1. data-testid attributes (rare on government portals)
2. text content matchers (page.get_by_text)
3. ARIA roles (page.get_by_role)
4. CSS class selectors as a last resort, with fallbacks documented
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Selector:
    name: str
    role: str | None = None
    text: str | None = None
    css: str | None = None
    last_verified: str = ""


# TEKUN portal. Last verified: 2026-04-25 (placeholder, Lane C verifies before 6PM Sat).
TEKUN_SELECTORS: dict[str, Selector] = {
    "apply_button": Selector(
        name="apply_button",
        role="link",
        text="Permohonan Pembiayaan",
        last_verified="2026-04-25",
    ),
    "name_input": Selector(name="name_input", css="#full_name", last_verified="2026-04-25"),
    "ic_input": Selector(name="ic_input", css="#ic_number", last_verified="2026-04-25"),
    "ssm_input": Selector(name="ssm_input", css="#ssm_number", last_verified="2026-04-25"),
}

# Lotus Malaysia. Last verified: 2026-04-25.
LOTUS_SELECTORS: dict[str, Selector] = {
    "search_input": Selector(
        name="search_input",
        role="searchbox",
        last_verified="2026-04-25",
    ),
    "add_to_cart": Selector(
        name="add_to_cart",
        role="button",
        text="Add to Cart",
        last_verified="2026-04-25",
    ),
}
