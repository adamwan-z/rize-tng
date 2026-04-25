"""CLI runner for browser-agent flows.

Lets a teammate cold-run a flow without booting orchestrator or FE.

Usage:
    python -m src.flows grant --mock
    python -m src.flows grant --profile profile.json --mode agent
    python -m src.flows lotus --mock
    python -m src.flows lotus --items shopping.json --mode scripted

Output is one StepEvent per line on stdout. Exit code 0 on success, 1 on
unhandled error.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path
from typing import Any

from .grant_application import run_grant_application
from .lotus_procurement import run_lotus_procurement


_DEMO_PROFILE: dict[str, Any] = {
    "full_name": "Aminah binti Hassan",
    "nric": "700815-14-5238",
    "mobile": "012-3457821",
    "email": "burger.bakar.makcik@gmail.com",
    "business_name": "Burger Bakar Mak Cik",
    "business_reg_no": "JM0823491-W",
    "business_type": "F&B",
    "business_address": "Lot 12, Jalan Raja Muda Musa, Kampung Baru, 50300 Kuala Lumpur",
    "years_operating": 8,
    "employee_count": 3,
    "annual_revenue": 177600,
    "requested_amount": 50000,
    "purpose": (
        "Upgrade from open-air pushcart to a permanent kiosk with proper grill, "
        "hire two additional staff, and procure a chiller to reduce daily Lotus runs."
    ),
}

_DEMO_SHOPPING_LIST: list[dict[str, Any]] = [
    {"sku": "RAMLY-BEEF-12", "quantity": 2},
    {"sku": "GARD-BURG-6", "quantity": 4},
    {"sku": "KRAFT-CHED-24", "quantity": 1},
    {"sku": "EGG-GRADE-A-30", "quantity": 1},
    {"sku": "PLANTA-MARG-480", "quantity": 1},
    {"sku": "LADYS-MAYO-470", "quantity": 1},
    {"sku": "MAGGI-CHIL-750", "quantity": 1},
    {"sku": "SAJI-OIL-5KG", "quantity": 1},
]


async def _run_grant(args: argparse.Namespace) -> int:
    profile = _DEMO_PROFILE if args.mock else json.loads(Path(args.profile).read_text())
    async for event in run_grant_application(
        run_id=str(uuid.uuid4()),
        profile=profile,
        application_url=args.url,
        grant_id=args.grant_id,
        mode=args.mode,
    ):
        print(json.dumps(event), flush=True)
    return 0


async def _run_lotus(args: argparse.Namespace) -> int:
    items = _DEMO_SHOPPING_LIST if args.mock else json.loads(Path(args.items).read_text())
    async for event in run_lotus_procurement(
        run_id=str(uuid.uuid4()),
        items=items,
        mode=args.mode,
    ):
        print(json.dumps(event), flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m src.flows")
    sub = parser.add_subparsers(dest="flow", required=True)

    g = sub.add_parser("grant", help="Run grant application flow")
    g.add_argument("--mock", action="store_true", help="Use demo profile")
    g.add_argument("--profile", type=str, help="Path to profile JSON")
    g.add_argument("--url", type=str, default=None, help="Override application URL")
    g.add_argument("--grant-id", type=str, default="local-cli")
    g.add_argument("--mode", choices=["scripted", "agent"], default="scripted")

    l = sub.add_parser("lotus", help="Run Lotus procurement flow")
    l.add_argument("--mock", action="store_true", help="Use demo shopping list")
    l.add_argument("--items", type=str, help="Path to items JSON")
    l.add_argument("--mode", choices=["scripted", "agent"], default="scripted")

    args = parser.parse_args(argv)

    if args.flow == "grant":
        if not args.mock and not args.profile:
            parser.error("grant requires --mock or --profile")
        return asyncio.run(_run_grant(args))
    if args.flow == "lotus":
        if not args.mock and not args.items:
            parser.error("lotus requires --mock or --items")
        return asyncio.run(_run_lotus(args))
    parser.error(f"Unknown flow: {args.flow}")
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
