"""Public input/output models for browser-agent flows.

These are the API contract. Both HTTP callers and direct Python callers route
through these so validation cannot be bypassed.
"""

from __future__ import annotations

from typing import Literal, TypedDict

from pydantic import BaseModel, EmailStr, Field, model_validator


# ----- Grant application ---------------------------------------------------


class GrantProfile(BaseModel):
    """Fields the SME Growth Fund mock form requires.

    Patterns mirror what the form's HTML validation expects so a malformed
    profile is rejected here rather than failing mid-fill.
    """

    full_name: str = Field(min_length=2)
    nric: str = Field(pattern=r"^\d{6}-\d{2}-\d{4}$")
    mobile: str = Field(pattern=r"^01\d-?\d{7,8}$")
    email: EmailStr
    business_name: str = Field(min_length=2)
    business_reg_no: str = Field(min_length=4)
    business_type: Literal["F&B", "Retail", "Services", "Manufacturing", "Tech", "Other"]
    business_address: str = Field(min_length=10)
    years_operating: int = Field(ge=0, le=100)
    employee_count: int = Field(ge=0, le=10000)
    annual_revenue: int = Field(ge=0)
    requested_amount: int = Field(ge=0)
    purpose: str = Field(min_length=10)


class GrantApplicationRequest(BaseModel):
    profile: GrantProfile
    application_url: str | None = None
    grant_id: str = "unknown"
    mode: Literal["scripted", "agent"] = "scripted"


# ----- Lotus procurement ---------------------------------------------------


class ShoppingItem(BaseModel):
    sku: str
    quantity: int = Field(ge=1, le=99)


class LotusProcurementRequest(BaseModel):
    items: list[ShoppingItem] = Field(min_length=1)
    mode: Literal["scripted", "agent"] = "scripted"

    @model_validator(mode="after")
    def _check_skus(self) -> "LotusProcurementRequest":
        # Local import avoids a circular dep at module load.
        from ..lib.catalog import get_valid_skus

        valid = get_valid_skus()
        unknown = sorted({i.sku for i in self.items} - valid)
        if unknown:
            sample = sorted(valid)[:5]
            raise ValueError(
                f"Unknown SKU(s): {unknown}. "
                f"Available example: {sample} ({len(valid)} total)"
            )
        return self


# ----- Stream events -------------------------------------------------------


class StepEvent(TypedDict, total=False):
    """One progress event emitted by a flow.

    `runId`, `step`, `description` always set. `screenshotUrl` is best-effort.
    `done` is True only on the final event. `result` carries structured
    outcome data on the final event when the flow has one (e.g. Lotus totals).
    `error` is set on the final event when the run failed and even the
    fallback could not produce useful output.
    """

    runId: str
    step: int
    description: str
    screenshotUrl: str
    done: bool
    result: dict
    error: str
