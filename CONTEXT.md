# Context

> Read this once, fully. It is the why behind every technical choice.

## The hackathon

TNG Digital hackathon, April 2026. Theme: financial inclusion. Build window: Saturday afternoon to Sunday 8AM pitch. Live pitch in front of judges. 4-person team.

### Judging criteria

1. **AI & Intelligent Systems**: meaningful AI integration, not gimmicks
2. **Technical Implementation**: scalability, robustness, security, prototype quality
3. **Multi-Cloud Service Usage**: purposeful use of two or more cloud platforms
4. **Impact & Feasibility**: real-world relevance, sustainability, adoption
5. **Presentation & Teamwork**: demo clarity, pitch, documentation

We optimise for criteria 1, 4, and 5 hardest. 2 and 3 are table stakes.

## The persona

**Mak Cik**, mid-50s, runs a Nasi Daging Salai stall in a KL neighbourhood. She accepts TNG QR payments because customers asked. She works 12-hour days. She closes the stall not because customers stop coming, but because she runs out of beef. She has heard of "grants" but assumes they are not for people like her.

She is digitally literate enough to use WhatsApp and TNG eWallet. She sticks to flows she knows. She trusts text and conversation. She avoids forms.

We are building for her. Every design decision filters through the question: would Mak Cik understand this in 3 seconds?

## The problem

Malaysian micro F&B entrepreneurs face three compounding gaps:

1. **Cashflow visibility.** They know "today was good" but cannot answer "is this month better than last?"
2. **Procurement friction.** They buy supplies based on memory, not data. Cost spikes hit before they notice.
3. **Capital access.** Real Malaysian SME grants exist (TEKUN, MARA, TERAJU, BNM micro-financing, AIM) but the application process assumes literacy in forms, regulation, and documents that micro-merchants do not have time to learn.

The third gap is the financial inclusion gap. It is where TNG Rise earns its name.

## The solution

TNG Rise is an AI agent embedded in TNG eWallet (and reachable via WhatsApp in the long-term roadmap). It does three things:

1. **Reads.** Looks at her transaction history and tells her how the business is doing in plain Bahasa-Inggeris.
2. **Procures.** When she needs supplies, the agent plans the order, opens a supplier site (Lotus), adds items to cart, hands off to her for payment. Live browser automation.
3. **Applies for grants.** Matches her business profile to real grants, then auto-fills the application form (or drafts the email if the grant is submitted that way), hands off to her for review and submission. Live browser automation.

For the hackathon demo, **the grant flow runs live**. The procurement flow is prepared but may be cut depending on demo time.

## Decisions already made (do not relitigate)

| Decision | Rationale |
| --- | --- |
| Hero live demo is the grant flow | Strongest financial-inclusion punch. Best emotional payoff. |
| Interface is a simple chatbot, not a full TNG mockup | Function over form. We are showing capability, not visual fidelity. |
| Mock the TNG merchant data | No real sandbox available. Mock is believable and fully under our control. |
| No AP2 wiring | No public API. Payment is a "user takes over here" handoff card. |
| No real auth | Demo lands logged in. Out of scope. |
| Multi-cloud: AWS Bedrock plus Alibaba OSS | Bedrock for LLM cognition. OSS for screenshot artifact storage. ECS deploy as stretch goal. |
| LLM swap via env var | `LLM_PROVIDER=anthropic` for dev (fastest), `bedrock` for demo. Possible Qwen for Malay copy as stretch. |
| All services run in Docker Compose locally | Cloud deploy is stretch goal, not critical path. |
| Live demo with OBS-recorded fallback | If live breaks, cut to recording in 5 seconds. |

## Out of scope

- Real TNG eWallet integration
- Real payment rails (AP2, FPX, anything)
- Authentication, user accounts
- Mobile native app (web only, mobile-friendly viewport)
- Voice input (mention as roadmap only)
- Persistence beyond a single session (in-memory or SQLite is fine)
- Polished onboarding flow
- Internationalisation beyond English plus sprinkled Malay

## The grant submission edge case

Some Malaysian SME grants are submitted via a web form. Some are submitted via **email** (PDF attached, structured body). The agent must handle both:

- `submission_method: "web_form"` → BrowserUse fills the form, stops before Submit
- `submission_method: "email"` → agent drafts a `mailto:` link with subject and body pre-filled, opens it in the user's mail client, user reviews and sends

For the live demo, we pick a `web_form` grant as the hero. The KB includes at least one `email` grant so the agent can demonstrate awareness of both paths if asked.

## Multi-cloud rationale (for the deck)

Two clouds, both doing real work:

- **AWS Bedrock** runs the LLM. Strongest reasoning model in-region for the agent loop.
- **Alibaba Cloud OSS** stores screenshot artifacts from BrowserUse runs. Each agent run creates 5 to 15 screenshots that the frontend embeds in the live viewport.

One cloud for cognition. One cloud for the hands.

Stretch goal: deploy the orchestrator to AWS Lambda or ECS Fargate, and the browser agent to Alibaba ECS (it needs persistent Chromium, which suits an ECS instance naturally).

## The pitch arc

Open with Mak Cik's reality (photo, 2 to 3 stats). State the problem in one line. Show the solution as a live demo: she asks for help, the agent matches her to a grant, BrowserUse fills the form, hand-off card appears. Close on this line:

> From a roadside stall, to her own product, to her own restaurant. One day.
