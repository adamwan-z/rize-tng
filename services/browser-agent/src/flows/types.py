"""Public input/output models for browser-agent flows.

These are the API contract. Both HTTP callers and direct Python callers route
through these so validation cannot be bypassed.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

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


# ----- iTEKAD email-submission application ---------------------------------


class ItekadIdentity(BaseModel):
    """Personal identity bits the MerchantProfile does not carry.

    Defaults match Mak Cik Aminah's data so a profile-less call still
    produces a coherent pack. The orchestrator passes these in explicitly
    rather than relying on defaults.
    """

    nric: str = Field(default="700815-14-5238", pattern=r"^\d{6}-\d{2}-\d{4}$")
    phone: str = Field(default="012-345 7821")
    email: EmailStr = "burger.bakar.makcik@gmail.com"
    tng_merchant_id: str = "TNG-MERCH-882341"
    tng_active_since: str = "March 2024"


class ItekadFunding(BaseModel):
    """Funding ask. Defaults sized for Mak Cik's expansion to a permanent kiosk."""

    amount_rm: int = Field(default=50000, ge=0)
    purpose: str = Field(default="Permanent kiosk upgrade and equipment expansion")
    tenure_months: int = Field(default=36, ge=1, le=120)


class ItekadMerchantProfile(BaseModel):
    """Subset of MerchantProfile the PDF generator needs.

    Mirrors the shared `MerchantProfile` Zod schema so anything the
    orchestrator forwards lands here cleanly.
    """

    id: str
    name: str
    business_name: str = Field(alias="businessName")
    business_type: str = Field(alias="businessType")
    location_city: str
    location_state: str
    registered_since: str = Field(alias="registeredSince")
    ssm: str | None = None
    monthly_revenue_rm: float = Field(alias="monthlyRevenueRm")
    monthly_costs_rm: dict[str, float] = Field(alias="monthlyCostsRm")

    model_config = {"populate_by_name": True}


class ItekadApplicationRequest(BaseModel):
    """Validated input for the iTEKAD flow.

    `profile` is the merchant data (from mock-tng); `identity` and
    `funding` are demo-stable extras.
    """

    profile: ItekadMerchantProfile
    identity: ItekadIdentity = Field(default_factory=ItekadIdentity)
    funding: ItekadFunding = Field(default_factory=ItekadFunding)
    email_to: str = Field(default="ekad@bnm.gov.my")
    mode: Literal["scripted", "agent"] = "scripted"

    # ----- helpers used by the flow + PDF generator -----

    @property
    def business_name(self) -> str:
        return self.profile.business_name

    @property
    def owner_name(self) -> str:
        return self.profile.name

    @property
    def location(self) -> str:
        return f"{self.profile.location_city}, {self.profile.location_state}"

    @property
    def established_year(self) -> str:
        return self.profile.registered_since[:4]

    @property
    def requested_amount_rm(self) -> int:
        return self.funding.amount_rm

    @property
    def tenure_months(self) -> int:
        return self.funding.tenure_months

    def profile_for_pdf(self) -> dict[str, Any]:
        return {
            "id": self.profile.id,
            "name": self.profile.name,
            "businessName": self.profile.business_name,
            "businessType": self.profile.business_type,
            "location": {
                "city": self.profile.location_city,
                "state": self.profile.location_state,
            },
            "registeredSince": self.profile.registered_since,
            "ssm": self.profile.ssm,
            "monthlyRevenueRm": self.profile.monthly_revenue_rm,
            "monthlyCostsRm": self.profile.monthly_costs_rm,
        }

    def identity_for_pdf(self) -> dict[str, str]:
        return {
            "nric": self.identity.nric,
            "phone": self.identity.phone,
            "email": str(self.identity.email),
            "tng_merchant_id": self.identity.tng_merchant_id,
            "tng_active_since": self.identity.tng_active_since,
        }

    def funding_for_pdf(self) -> dict[str, Any]:
        # Use-of-funds and outcomes stay defaulted in generate_pdf so the PDF
        # has a concrete breakdown without forcing the orchestrator to invent
        # one. Only the headline numbers are wired from request inputs.
        return {
            "amount": self.funding.amount_rm,
            "purpose": self.funding.purpose,
            "tenure_months": self.funding.tenure_months,
        }


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
