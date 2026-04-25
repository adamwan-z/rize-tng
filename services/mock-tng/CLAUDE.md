# Lane D: Mock TNG, Grants KB, Infra

You are building the data and infra backbone for TNG Rise. Read `/CLAUDE.md`, `/CONTEXT.md`, and the Lane D section of `/IMPLEMENTATION.md`.

## Folders you own
- `services/mock-tng/`
- `packages/grants-kb/`
- `infra/`
- `docs/`
- `pitch/` (collaborate with Lane A on the deck)

## Data realism is your most important deliverable
The data you generate is what the LLM sees. If it is lazy, the agent's responses are lazy. Spend time making it feel like a real Malaysian stall.

## Mock TNG
Express + TypeScript. Two endpoints:
- `GET /merchant` returns `MerchantProfile`
- `GET /transactions?days=30` returns `Transaction[]`

Mak Cik's profile is static JSON. Transactions are generated at request time using a date-seeded RNG so reruns within a day are reproducible while dates always look fresh on demo day. See `src/data/transactions.ts`. The CFO does not track inventory; stock is intentionally not exposed by mock-tng so the agent cannot drift into operational/COO territory.

The transaction generator encodes:
- Peak hours: 12 to 13:30 lunch, 18 to 19:30 dinner
- Friday and Saturday busiest, Monday slowest
- Average ticket around RM 12, range RM 8 to RM 35
- 5% week-over-week dip in the last 7 days (a hook for the agent)

If you tune the data, keep the dip. The pitch leans on "agent spots the slowdown."

## Grants KB
Five real Malaysian SME grants in `packages/grants-kb/data/`. Verified URLs preferred. Mix `web_form` (4) and `email` (1: BNM iAES). Schema in `packages/shared/src/contracts.ts`.

## Multi-cloud
Two clouds, both doing real work:
- AWS Bedrock for LLM (Lane B uses)
- Alibaba OSS for screenshot storage (Lane C uses)

You set up both. Document setup in `infra/aws/README.md` and `infra/alibaba/README.md` so any teammate can re-create it.

## Pitch deck stats
Find 3 to 5 real Malaysian micro-SME stats. Sources: AKPK, BNM annual report, DOSM. Cite sources. Do not invent numbers.

## Run
```
cd services/mock-tng
npm install
npm run dev    # :5050

# From repo root
docker compose -f infra/docker-compose.yml up --build
```

## Don't
- Do not invent stats. Cite or omit.
- Do not ship sample data with "John Doe" or "test"
- Do not add real auth or real APIs to mock-tng
- Do not hold up other lanes for perfect data. Get believable data shipped fast, refine in phase 2.
