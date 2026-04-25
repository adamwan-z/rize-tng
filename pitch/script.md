# Pitch script

Target length: 4 minutes. 90 seconds of which is the live demo.

## Open (15s)

> "Meet Mak Cik. She runs a nasi daging salai stall in Kampung Baru. She works 12-hour days. She uses TNG eWallet because her customers asked. She has heard of grants. She believes they are not for people like her."

Pause. Slow.

## The gap (30s)

> "Malaysian micro-merchants face three gaps. They cannot see their own cashflow over time. They procure on memory. And the third gap, the one that matters most: capital is sitting in real Malaysian SME grants, but the paperwork shuts them out. This is the financial inclusion gap. This is where TNG Rise earns its name."

## The vision (20s)

> "We built a personal CFO for Mak Cik. Embedded in TNG eWallet. It reads her transactions. It procures her supplies. And it applies for grants on her behalf, live."

Click to demo.

## Demo (90s)

Switch tab to http://localhost:3000.

Speak alongside, not over, the agent's responses.

> "She asks how the business is going. The agent reads 30 days of TNG transactions. Notices the 5% dip last week. Suggests the grant flow."
> "She picks TEKUN. The agent opens the real TEKUN portal."
> "Watch the browser fill the fields. Name, SSM, address, monthly revenue."
> "It stops before Submit. She reviews. She submits."

If anything looks slow, breathe. Do not narrate the loading.

## How it works (30s)

> "Behind the chat, an LLM tool-use loop. AWS Bedrock for cognition, in `ap-southeast-5`. Alibaba OSS for screenshot artifacts, in `ap-southeast-3`. One cloud thinks. One cloud remembers. Both in the region where Mak Cik lives."

## Impact (30s)

Cite stats from `pitch/stats.md`. Be specific. Numbers and sources, not vibes.

## Close (15s)

> "From a roadside stall, to her own product, to her own restaurant. One day."

Pause. Smile. Take questions.

## Q&A handling

- "How does the agent decide which grant?" → rule-based matching today, vector retrieval is a roadmap item.
- "What if the portal changes?" → recordings in `recordings/` plus selectors with `last_verified` dates.
- "Is this real TNG integration?" → mock today, partnership conversation tomorrow.
- "What about privacy?" → no auth in the demo, real version uses TNG eWallet's existing auth.
- "What about other languages?" → today is Bahasa-Inggeris, the register most KL Malay merchants speak. v2 ships Mandarin and Tamil. The voice is one prompt swap, the UI has three strings to localise.
