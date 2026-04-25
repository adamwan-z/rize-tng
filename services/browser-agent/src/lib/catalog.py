"""Cached fetch of the Lotus catalog from mock-tng.

Single source of truth: services/mock-tng/data/lotus-catalog.json. The HTML
mock loads it client-side; we load it here for SKU validation. If mock-tng
is unreachable on first call, raise CatalogUnavailable so the request can
return 503 instead of silently allowing every SKU through.
"""

from __future__ import annotations

import os
from typing import Any

import httpx


class CatalogUnavailable(RuntimeError):
    """Raised when mock-tng's catalog cannot be fetched."""


_cache: list[dict[str, Any]] | None = None


def _catalog_url() -> str:
    base = os.environ.get("MOCK_TNG_URL", "http://localhost:5050").rstrip("/")
    return f"{base}/data/lotus-catalog.json"


def get_lotus_catalog() -> list[dict[str, Any]]:
    """Return the catalog list of dicts. Cached after first success.

    On failure the cache stays unset so the next call retries.
    """
    global _cache
    if _cache is not None:
        return _cache

    url = _catalog_url()
    try:
        resp = httpx.get(url, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        raise CatalogUnavailable(f"Lotus catalog unreachable at {url}: {exc}") from exc

    if not isinstance(data, list) or not data:
        raise CatalogUnavailable(f"Lotus catalog at {url} is empty or malformed")

    _cache = data
    return _cache


def get_valid_skus() -> set[str]:
    return {item["sku"] for item in get_lotus_catalog() if "sku" in item}


def reset_cache() -> None:
    """Test/dev helper. Force a re-fetch on next access."""
    global _cache
    _cache = None
