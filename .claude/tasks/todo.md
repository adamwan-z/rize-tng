# Lane A · Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the scaffolded React+Vite chat UI from "renders text bubbles" to a demo-ready Lane A surface that passes `pitch/demo-runbook.md` steps 1 to 6, with brand polish drawn from `apps/web/public/design-system.html`, four agent action cards, and an OBS fallback recording cut.

**Architecture:** Single React 18 + Vite app. CSS variable tokens in `src/styles/tokens.css` mirror the canonical `--tng-*`, `--surface-*`, `--ink-*`, `--rise-accent` set from the design system. Tailwind extends those tokens for class-based usage. The existing `useAgentStream` hook stays as the SSE consumer. `ChatWindow` reduces `AgentEvent`s into a list of `ChatItem`s and dispatches each `tool_result` to the right rich card by tool name.

**Posture: a CFO, not an assistant.** Across every card, bubble, and greeting, Rise is framed as Mak Cik's chief financial officer. A CFO does three things, in this order:
1. **Reads** the cash position (Revenue card lives here).
2. **Approves and deploys** capital (Grant matched, Procurement, AP2 Payment cards).
3. **Declines** when the request would over-leverage the business (new DeclineCard).

Copy verbs follow this posture. We say "approved", "deployed", "released" instead of "matched" or "paid". When the CFO says no, we say "tahan dulu" or "not this month" — protective, not punitive. The visual language follows: declines use `--tng-orange` (warning, not danger), since saying no to over-borrowing is good news for cashflow.

**Tech Stack:** React 18, Vite, TypeScript strict, Tailwind 3, lucide-react icons, react-markdown, Google Fonts (Sora, Open Sans, JetBrains Mono, Fraunces).

**Design system tokens (canonical, from `apps/web/public/design-system.html`):**

```
--surface-0:  #FAFAF7    --tng-blue:        #005BAA   --tng-yellow:      #FFF200
--surface-1:  #FFFFFF    --tng-blue-dark:   #003D75   --tng-yellow-deep: #F5C400
--surface-2:  #F2F1EC    --tng-blue-deep:   #002A52   --tng-green:       #008443
--surface-3:  #E5E4DD    --tng-blue-300:    #7FAFD8   --tng-orange:      #EB8705
--ink-900:    #1A1A1A    --tng-blue-200:    #B8D2EA   --tng-pink:        #EF4E74
--ink-700:    #3D3D3D    --tng-blue-100:    #E5EFF8   --tng-warm-grey:   #726658
--ink-500:    #6E6E6E    --rise-accent:     #FF6B35
--ink-300:    #A5A5A0
```

**Files map:**

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `apps/web/src/styles/tokens.css` | All CSS custom properties, single source of truth |
| Create | `apps/web/src/lib/format.ts` | RM, percent, time formatters |
| Create | `apps/web/src/components/brand/TngBar.tsx` | 70/30 slanted blue+yellow identifier bar |
| Create | `apps/web/src/components/brand/RiseMark.tsx` | Lockup, chevron-up SVG |
| Create | `apps/web/src/components/chat/Greeting.tsx` | First-load hero card with Mak Cik's name |
| Create | `apps/web/src/components/agent/RevenueCard.tsx` | Rich `readSales` tool_result |
| Create | `apps/web/src/components/agent/GrantMatchedCard.tsx` | Rich `matchGrants` tool_result row |
| Create | `apps/web/src/components/agent/ProcurementCard.tsx` | Rich `runProcurementAgent` summary |
| Create | `apps/web/src/components/agent/AP2PaymentCard.tsx` | TNG-blue payment handoff variant |
| Create | `apps/web/src/components/agent/DeclineCard.tsx` | The CFO's "tahan dulu". Renders when the agent rejects an over-leverage request |
| Create | `apps/web/src/components/agent/dispatchAgentCard.tsx` | Picks card by tool name |
| Create | `apps/web/src/lib/sound.ts` | Web Audio handoff cue |
| Modify | `apps/web/index.html` | Add Google Fonts link |
| Modify | `apps/web/tailwind.config.js` | Extend with full token set |
| Modify | `apps/web/src/styles/index.css` | Import tokens.css, set base font stack |
| Modify | `apps/web/src/App.tsx` | Swap header for branded version with TngBar + RiseMark |
| Modify | `apps/web/src/components/chat/Message.tsx` | Apply font tokens, refine bubble shape |
| Modify | `apps/web/src/components/chat/ChatInput.tsx` | CTA styling, refined placeholder |
| Modify | `apps/web/src/components/chat/MessageList.tsx` | Replace JSON tool_result with `dispatchAgentCard` |
| Modify | `apps/web/src/components/chat/ChatWindow.tsx` | Mount Greeting, fire sound cue on handoff |
| Modify | `apps/web/src/components/handoff/EmailHandoff.tsx` | Apply token-driven styling |
| Modify | `apps/web/src/components/handoff/ReviewSubmitHandoff.tsx` | Apply token-driven styling |

**Verification methodology:** This is a hackathon UI build. The test harness is `pitch/demo-runbook.md` and visual diffs against `apps/web/public/design-system.html`. Each task ends with running `npm run dev`, walking the runbook step or visually confirming the section, plus `npm run typecheck` clean.

---

## Task 1: Brand foundation — tokens, fonts, Tailwind extend

**Goal:** Every later component reads from canonical tokens. Lock these first.

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/index.html`
- Modify: `apps/web/tailwind.config.js`
- Modify: `apps/web/src/styles/index.css`

**Verify:** `--tng-blue` is computable on `document.documentElement` in DevTools and a Tailwind class like `bg-tng-blue` renders the right hex.

- [ ] **Step 1: Verify the token gap exists**

Run: `cd apps/web && npm run dev` then open the page, in DevTools console run `getComputedStyle(document.documentElement).getPropertyValue('--tng-blue')`.
Expected before: empty string. After Task 1: `#005BAA`.

- [ ] **Step 2: Create `apps/web/src/styles/tokens.css`**

```css
/* TNG Rise · canonical tokens · paste at app root */
:root {
  /* TNG anchor */
  --tng-blue: #005BAA;
  --tng-blue-dark: #003D75;
  --tng-blue-deep: #002A52;
  --tng-blue-300: #7FAFD8;
  --tng-blue-200: #B8D2EA;
  --tng-blue-100: #E5EFF8;
  --tng-yellow: #FFF200;
  --tng-yellow-deep: #F5C400;

  /* Semantic (TNG-named, design system convention) */
  --tng-green: #008443;
  --tng-orange: #EB8705;
  --tng-pink: #EF4E74;
  --tng-warm-grey: #726658;

  /* Editorial accent */
  --rise-accent: #FF6B35;

  /* Surfaces */
  --surface-0: #FAFAF7;
  --surface-1: #FFFFFF;
  --surface-2: #F2F1EC;
  --surface-3: #E5E4DD;

  /* Ink */
  --ink-900: #1A1A1A;
  --ink-700: #3D3D3D;
  --ink-500: #6E6E6E;
  --ink-300: #A5A5A0;

  /* Type stacks */
  --font-display:   'Sora', system-ui, -apple-system, sans-serif;
  --font-body:      'Open Sans', system-ui, -apple-system, sans-serif;
  --font-mono:      'JetBrains Mono', ui-monospace, monospace;
  --font-editorial: 'Fraunces', Georgia, serif;

  /* CTA shadow (yellow CTA gets the deeper yellow underneath) */
  --cta-shadow: 0 4px 0 var(--tng-yellow-deep);
}
```

- [ ] **Step 3: Add Google Fonts link in `apps/web/index.html`**

Replace the existing `<head>` block so it includes:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;1,9..144,600&display=swap"
/>
```

Place these after the existing `<meta>` tags inside `<head>`.

- [ ] **Step 4: Update `apps/web/src/styles/index.css` to import tokens and use the body font**

```css
@import './tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  height: 100%;
}

body {
  background: var(--surface-0);
  color: var(--ink-900);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

::selection {
  background: var(--tng-yellow);
  color: var(--ink-900);
}
```

- [ ] **Step 5: Extend `apps/web/tailwind.config.js` with the full token set**

Replace the `theme.extend` block:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tng: {
          blue: '#005BAA',
          'blue-dark': '#003D75',
          'blue-deep': '#002A52',
          'blue-300': '#7FAFD8',
          'blue-200': '#B8D2EA',
          'blue-100': '#E5EFF8',
          yellow: '#FFF200',
          'yellow-deep': '#F5C400',
          green: '#008443',
          orange: '#EB8705',
          pink: '#EF4E74',
          'warm-grey': '#726658',
        },
        surface: {
          0: '#FAFAF7',
          1: '#FFFFFF',
          2: '#F2F1EC',
          3: '#E5E4DD',
        },
        ink: {
          900: '#1A1A1A',
          700: '#3D3D3D',
          500: '#6E6E6E',
          300: '#A5A5A0',
        },
        rise: '#FF6B35',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        body: ['Open Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        editorial: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        cta: '0 4px 0 #F5C400',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Verify**

Run: `cd apps/web && npm run dev`. Open `http://localhost:3000`. In DevTools console:

```js
getComputedStyle(document.documentElement).getPropertyValue('--tng-blue')
// expected: " #005BAA"
```

Add a temporary `<div className="bg-tng-blue text-white p-4">test</div>` to `App.tsx`. Confirm blue background renders. Remove the temporary div before committing.

Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/styles/tokens.css apps/web/src/styles/index.css \
        apps/web/index.html apps/web/tailwind.config.js
git commit -m "Lane A: lock brand foundation (tokens, fonts, Tailwind extend)"
```

---

## Task 2: TngBar slanted identifier component

**Goal:** A reusable 70/30 blue + yellow bar with a 45° clip-path seam, used at the top and bottom of the app.

**Files:**
- Create: `apps/web/src/components/brand/TngBar.tsx`
- Modify: `apps/web/src/App.tsx`

**Verify:** Visual: blue takes ~70% from the left, yellow ~30% on the right, the seam is a 45° diagonal. Bar height switchable via `thin` prop.

- [ ] **Step 1: Create `apps/web/src/components/brand/TngBar.tsx`**

```tsx
type TngBarProps = {
  thin?: boolean;
};

// 70% blue left + 30% yellow right with a 45 degree seam.
// Seam length matches bar height for a true 45 degree cut.
export function TngBar({ thin = false }: TngBarProps) {
  const h = thin ? 8 : 14;
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        height: h,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 30% 0 0',
          background: 'var(--tng-blue)',
          clipPath: `polygon(0 0, 100% 0, calc(100% - ${h}px) 100%, 0 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: `0 0 0 70%`,
          background: 'var(--tng-yellow)',
          clipPath: `polygon(${h}px 0, 100% 0, 100% 100%, 0 100%)`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `apps/web/src/App.tsx`**

Replace `App.tsx` with:

```tsx
import { useMemo } from 'react';
import { ChatWindow } from './components/chat/ChatWindow.js';
import { TngBar } from './components/brand/TngBar.js';

export function App() {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  return (
    <div className="h-full flex flex-col bg-surface-0">
      <TngBar />
      <header className="border-b border-surface-2 bg-surface-1">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Header content lands in Task 3 */}
          <div className="font-display font-bold text-ink-900">TNG Rise</div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatWindow sessionId={sessionId} />
      </main>
      <TngBar thin />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/web && npm run dev`. Open the page. Confirm a thick TNG bar at the top and a thin one at the bottom. Inspect the seam at 70%/30% boundary in DevTools and confirm the diagonal angle.

Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/brand/TngBar.tsx apps/web/src/App.tsx
git commit -m "Lane A: add TngBar slanted identifier component"
```

---

## Task 3: RiseMark lockup with chevron-up

**Goal:** Branded header lockup. "Living / with" label, TNG mark, divider, Rise wordmark with editorial italic + chevron-up SVG.

**Files:**
- Create: `apps/web/src/components/brand/RiseMark.tsx`
- Modify: `apps/web/src/App.tsx`

**Verify:** Header renders with the lockup. Chevron is `--rise-accent` (#FF6B35). "Rise" is in Fraunces italic.

- [ ] **Step 1: Create `apps/web/src/components/brand/RiseMark.tsx`**

```tsx
export function RiseMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col text-[10px] font-mono font-semibold uppercase tracking-widest text-ink-500 leading-tight">
        <span>Living</span>
        <span>with</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 bg-tng-yellow rounded-sm" />
        <div className="flex flex-col leading-none">
          <span className="font-display font-extrabold text-tng-blue text-[20px] tracking-tight">
            TNG
          </span>
          <span className="font-body font-semibold text-ink-700 text-[10px] tracking-wide mt-0.5">
            eWallet
          </span>
        </div>
      </div>
      <div className="w-px h-8 bg-surface-2" aria-hidden />
      <div className="flex items-center gap-2">
        <svg
          width="22"
          height="14"
          viewBox="0 0 24 16"
          fill="none"
          aria-hidden
          style={{ color: 'var(--rise-accent)' }}
        >
          <polyline
            points="2 12 12 4 22 12"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-editorial italic text-ink-900 text-[24px] leading-none tracking-tight">
          Rise
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `App.tsx` header**

Replace the temporary header content in `App.tsx`:

```tsx
import { RiseMark } from './components/brand/RiseMark.js';
// ...
<header className="border-b border-surface-2 bg-surface-1">
  <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
    <RiseMark />
    <span className="hidden sm:inline-flex items-center gap-2 px-2 py-1 rounded-full bg-tng-green/10 text-tng-green text-[10px] font-mono font-semibold uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-tng-green" />
      Online
    </span>
  </div>
</header>
```

- [ ] **Step 3: Verify**

Run: `cd apps/web && npm run dev`. Confirm the lockup renders: "Living/with" label, blue TNG mark, divider, orange chevron, "Rise" in italic Fraunces.
Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/brand/RiseMark.tsx apps/web/src/App.tsx
git commit -m "Lane A: add RiseMark lockup with chevron-up"
```

---

## Task 4: Format helpers (RM, percent, relative time)

**Goal:** A small library of pure formatters used by the agent cards. No test framework; verify via Node REPL.

**Files:**
- Create: `apps/web/src/lib/format.ts`

**Verify:** Each formatter prints the documented output for the documented input.

- [ ] **Step 1: Create `apps/web/src/lib/format.ts`**

```ts
// Malaysian Ringgit. Always 2 decimals. Comma thousands.
// formatRm(847.5)    => "RM 847.50"
// formatRm(1234567)  => "RM 1,234,567.00"
export function formatRm(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    currencyDisplay: 'code',
  })
    .format(amount)
    .replace('MYR', 'RM ')
    .trim()
    .replace(/^RM\s+/, 'RM ');
}

// formatPercent(12)     => "+12%"
// formatPercent(-3.4)   => "-3.4%"
// formatPercent(0)      => "0%"
export function formatPercent(value: number): string {
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '';
  const fixed = Number.isInteger(value) ? value : value.toFixed(1);
  return `${sign}${fixed}%`;
}

// Splits an array of numbers into bar heights normalized to 0..1.
// normalizeForSparkline([1, 2, 3, 4]) => [0.25, 0.5, 0.75, 1]
export function normalizeForSparkline(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => v / max);
}
```

- [ ] **Step 2: Verify with Node**

Run from repo root:

```bash
node --input-type=module -e "
import('./apps/web/src/lib/format.ts').catch(() => null);
const fns = await import('tsx/esm/api').then(m => m.tsImport('./apps/web/src/lib/format.ts', import.meta.url));
console.log(fns.formatRm(847.5));        // RM 847.50
console.log(fns.formatPercent(12));      // +12%
console.log(fns.formatPercent(-3.4));    // -3.4%
console.log(fns.normalizeForSparkline([1,2,3,4]));  // [0.25, 0.5, 0.75, 1]
"
```

If `tsx` REPL is awkward, paste the function bodies into DevTools console after `npm run dev` and call them there.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/format.ts
git commit -m "Lane A: add RM, percent, sparkline format helpers"
```

---

## Task 5: RevenueCard component (rich `readSales` result)

**Goal:** A static React component matching the design system Revenue card. Sparkline of 7 bars with the last as peak yellow, big metric, success pill, top-seller note.

**Files:**
- Create: `apps/web/src/components/agent/RevenueCard.tsx`

**Verify:** Storybook-style: render with sample data in `App.tsx` temporarily, confirm visual match to design system.

- [ ] **Step 1: Define the props the orchestrator's `readSales` tool returns**

The orchestrator's `readSales` returns `{ period, days, totalRm, count, avgTicketRm, transactions }`. The card needs `totalRm`, `count`, plus a 7-day series. We derive the series from `transactions` grouped by day in the dispatcher (Task 9). The card itself takes plain props.

```ts
export type RevenueCardProps = {
  totalRm: number;
  deltaPercent: number;        // signed, vs prior comparable period
  comparedTo: string;          // "yesterday" | "last week"
  orderCount: number;
  series: number[];            // length 7, normalized 0..1
  topSeller?: { name: string; rm: number; orders: number };
};
```

- [ ] **Step 2: Create `apps/web/src/components/agent/RevenueCard.tsx`**

```tsx
import { formatRm, formatPercent } from '../../lib/format.js';

export type RevenueCardProps = {
  totalRm: number;
  deltaPercent: number;
  comparedTo: string;
  orderCount: number;
  series: number[];
  topSeller?: { name: string; rm: number; orders: number };
};

export function RevenueCard({
  totalRm,
  deltaPercent,
  comparedTo,
  orderCount,
  series,
  topSeller,
}: RevenueCardProps) {
  const positive = deltaPercent >= 0;
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        Today · Kampung Baru
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display font-extrabold text-[56px] leading-none tracking-tight text-ink-900">
          <span className="font-mono text-sm font-medium tracking-wider text-ink-500 mr-2">
            RM
          </span>
          {totalRm.toFixed(2)}
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-widest ${
            positive ? 'bg-tng-green/10 text-tng-green' : 'bg-tng-pink/10 text-tng-pink'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${positive ? 'bg-tng-green' : 'bg-tng-pink'}`} />
          {formatPercent(deltaPercent)}
        </span>
      </div>
      <div className="font-mono text-[13px] text-ink-500 tracking-wide">
        vs {comparedTo} · {orderCount} orders
      </div>
      <div className="flex items-end gap-1.5 h-20" aria-hidden>
        {series.map((value, i) => {
          const isPeak = i === series.length - 1;
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-[3px] ${
                isPeak ? 'bg-tng-yellow' : 'bg-tng-blue-100'
              }`}
              style={{ height: `${Math.max(8, value * 100)}%` }}
            />
          );
        })}
      </div>
      {topSeller && (
        <div className="bg-surface-2 rounded-lg px-4 py-3 text-sm text-ink-700">
          <strong className="text-ink-900 font-semibold">Top seller:</strong>{' '}
          {topSeller.name}, {formatRm(topSeller.rm)} across {topSeller.orders} orders.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Visual smoke-test in App.tsx**

Temporarily add inside the `<main>` of `App.tsx`:

```tsx
import { RevenueCard } from './components/agent/RevenueCard.js';
// ...
<div className="max-w-2xl mx-auto p-6">
  <RevenueCard
    totalRm={847.5}
    deltaPercent={12}
    comparedTo="yesterday"
    orderCount={34}
    series={[0.35, 0.48, 0.28, 0.56, 0.64, 0.52, 0.92]}
    topSeller={{ name: 'Nasi lemak ayam goreng', rm: 312, orders: 26 }}
  />
</div>
```

Run `npm run dev`, confirm visual match to the Revenue card in `apps/web/public/design-system.html`. Then **remove** the temporary block from `App.tsx`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/agent/RevenueCard.tsx
git commit -m "Lane A: add RevenueCard component"
```

---

## Task 6: GrantMatchedCard component

**Goal:** Yellow left-border card with grant title, "Up to RM X · No collateral" line, three-step checklist, italic follow-up note.

**Files:**
- Create: `apps/web/src/components/agent/GrantMatchedCard.tsx`

**Verify:** Visual smoke-test, matches design system Grant matched card.

- [ ] **Step 1: Create `apps/web/src/components/agent/GrantMatchedCard.tsx`**

```tsx
import { formatRm } from '../../lib/format.js';

export type GrantMatchedCardProps = {
  grantName: string;
  agency: string;
  maxAmountRm: number;
  collateralFree?: boolean;
  steps: string[];           // already-completed steps, max 3
  followUpNote?: string;     // italic note line
};

function CheckIcon() {
  return (
    <span className="w-5 h-5 rounded-full bg-tng-green/10 text-tng-green inline-flex items-center justify-center flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8.5l3.5 3.5L13 5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function GrantMatchedCard({
  grantName,
  agency,
  maxAmountRm,
  collateralFree,
  steps,
  followUpNote,
}: GrantMatchedCardProps) {
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 pl-7 relative shadow-sm">
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-1 bg-tng-yellow rounded-r-sm"
      />
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-3">
        Grant matched · {agency}
      </div>
      <h3 className="font-display font-bold text-[22px] leading-tight tracking-tight text-ink-900 mb-1">
        {grantName}
      </h3>
      <p className="font-mono text-[13px] text-ink-700 tracking-wide mb-4">
        Up to {formatRm(maxAmountRm)}
        {collateralFree ? ' · No collateral required' : ''}
      </p>
      <ul className="flex flex-col gap-3 mb-4">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 text-[15px] text-ink-900">
            <CheckIcon />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      {followUpNote && (
        <div
          className="font-editorial italic text-base text-ink-700 px-4 py-3 rounded-lg"
          style={{ background: 'rgba(255, 107, 53, 0.08)' }}
        >
          {followUpNote}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Visual smoke-test**

Temporarily render in `App.tsx`:

```tsx
import { GrantMatchedCard } from './components/agent/GrantMatchedCard.js';
// ...
<GrantMatchedCard
  grantName="Skim Pembiayaan Mikro TEKUN"
  agency="TEKUN Nasional"
  maxAmountRm={50000}
  collateralFree
  steps={['Form filled with your TNG profile', 'Last 3 months of takings attached', 'Submitted on your behalf']}
  followUpNote="I'll follow up on Tuesday. You don't need to chase."
/>
```

Confirm visual match against the Grant matched card in the design system. Remove the temporary block.

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/web && npm run typecheck
cd ../..
git add apps/web/src/components/agent/GrantMatchedCard.tsx
git commit -m "Lane A: add GrantMatchedCard component"
```

---

## Task 7: ProcurementCard component

**Goal:** Live BrowserUse Lotus card with line items table, total row, "Pay with eWallet" CTA + "Edit list" ghost button.

**Files:**
- Create: `apps/web/src/components/agent/ProcurementCard.tsx`

**Verify:** Visual smoke-test matches design system Procurement card.

- [ ] **Step 1: Create `apps/web/src/components/agent/ProcurementCard.tsx`**

```tsx
import { formatRm } from '../../lib/format.js';

export type ProcurementItem = {
  name: string;
  qty: string;       // "10 kg", "2 L"
  priceRm: number;
};

export type ProcurementCardProps = {
  source: string;    // "Lotus's"
  live?: boolean;
  items: ProcurementItem[];
  onPay?: () => void;
  onEdit?: () => void;
};

export function ProcurementCard({
  source,
  live = false,
  items,
  onPay,
  onEdit,
}: ProcurementCardProps) {
  const total = items.reduce((sum, i) => sum + i.priceRm, 0);
  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-700">
          {live && (
            <span className="relative w-2 h-2 rounded-full bg-tng-green">
              <span className="absolute inset-[-4px] rounded-full border border-tng-green opacity-40 animate-ping" />
            </span>
          )}
          BrowserUse · {source}
        </span>
        {live && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tng-blue-100 text-tng-blue font-mono text-[11px] font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-tng-blue" />
            Live
          </span>
        )}
      </div>
      <div>
        {items.map((item, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_auto] gap-3 py-2.5 items-baseline ${
              i < items.length - 1 ? 'border-b border-surface-2' : ''
            }`}
          >
            <div>
              <span className="text-[15px] text-ink-900">{item.name}</span>
              <span className="ml-2 text-ink-500 font-mono text-xs tracking-wide">
                {item.qty}
              </span>
            </div>
            <span className="font-mono text-sm font-medium text-ink-900 tracking-wide">
              {formatRm(item.priceRm)}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline pt-3 border-t-2 border-ink-900">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-700">
          Total
        </span>
        <span className="font-display font-bold text-[22px] tracking-tight text-ink-900">
          {formatRm(total)}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPay}
          className="flex-1 justify-center inline-flex items-center gap-2 font-display font-bold text-[15px] text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-5 py-3 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition"
        >
          Pay with eWallet
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 justify-center inline-flex items-center gap-2 font-display font-semibold text-[15px] text-ink-900 bg-transparent border border-surface-2 hover:bg-surface-2 px-5 py-3 rounded-lg"
        >
          Edit list
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Visual smoke-test**

Temporarily in `App.tsx`:

```tsx
<ProcurementCard
  source="Lotus's"
  live
  items={[
    { name: 'Beras pulut', qty: '10 kg', priceRm: 32 },
    { name: 'Santan segar', qty: '2 L', priceRm: 14.4 },
    { name: 'Ikan bilis', qty: '1 kg', priceRm: 28 },
    { name: 'Cili kering', qty: '2 kg', priceRm: 28.1 },
  ]}
  onPay={() => alert('pay')}
  onEdit={() => alert('edit')}
/>
```

Confirm: live dot pulses, total computes to RM 102.50, yellow CTA has the deeper-yellow shadow underneath, ghost button is subtle. Remove the temporary block.

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/web && npm run typecheck
cd ../..
git add apps/web/src/components/agent/ProcurementCard.tsx
git commit -m "Lane A: add ProcurementCard component"
```

---

## Task 8: AP2PaymentCard + DeclineCard + EmailHandoff polish

**Goal:** TNG-blue "Deploy capital" card (AP2 payment), CFO Decline card for over-leverage refusals, and re-style the existing EmailHandoff and ReviewSubmitHandoff to use design tokens instead of raw Tailwind emerald colors. The AP2 card and DeclineCard together carry the "approve and deploy / reject" CFO posture.

**Files:**
- Create: `apps/web/src/components/agent/AP2PaymentCard.tsx`
- Create: `apps/web/src/components/agent/DeclineCard.tsx`
- Modify: `apps/web/src/components/handoff/EmailHandoff.tsx`
- Modify: `apps/web/src/components/handoff/ReviewSubmitHandoff.tsx`

**Verify:** Visual: AP2 card is TNG blue, amount is white display 64px, yellow CTA stands out, mono footer is muted yellow. Email and ReviewSubmit cards use `--tng-green` not raw emerald.

- [ ] **Step 1: Create `apps/web/src/components/agent/AP2PaymentCard.tsx`**

```tsx
import { formatRm } from '../../lib/format.js';

export type AP2PaymentCardProps = {
  amountRm: number;
  payee: string;
  onHold?: () => void;
};

export function AP2PaymentCard({ amountRm, payee, onHold }: AP2PaymentCardProps) {
  return (
    <div
      className="rounded-2xl p-8 flex flex-col gap-5 shadow-md"
      style={{ background: 'var(--tng-blue)', color: 'var(--surface-1)' }}
    >
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-tng-yellow">
        Paying from eWallet
      </span>
      <div>
        <div className="font-display font-extrabold text-[64px] leading-none tracking-tight">
          <span className="font-mono text-base font-medium align-middle mr-2 text-white/70 tracking-wider">
            RM
          </span>
          {amountRm.toFixed(2)}
        </div>
        <div className="text-[15px] mt-2 text-white/80">to {payee}</div>
      </div>
      <button
        type="button"
        onClick={onHold}
        className="w-full justify-center inline-flex items-center gap-2 font-display font-bold text-base text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-5 py-4 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition"
      >
        Hold to pay
      </button>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-tng-yellow/70 text-center">
        Agent-initiated · User-signed
      </div>
    </div>
  );
}
```

- [ ] **Step 1b: Create `apps/web/src/components/agent/DeclineCard.tsx`**

The CFO saying no. Used when the user asks for too much credit, or wants to apply for a grant that would push debt service past 30% of monthly takings. Tone: protective, not scolding. Visual: orange (warning, not danger) left border, plain card body, the "what would work instead" suggestion is the prominent CTA.

```tsx
import { formatRm } from '../../lib/format.js';

export type DeclineCardProps = {
  what: string;                 // e.g. "second cash advance this month"
  reason: string;               // one sentence explanation in BI
  cashOnHandRm?: number;        // optional, surfaces the CFO's reasoning
  monthlyDebtServiceRm?: number;
  alternative?: {               // the "do this instead" path
    label: string;
    cta: string;
    onClick?: () => void;
  };
};

export function DeclineCard({
  what,
  reason,
  cashOnHandRm,
  monthlyDebtServiceRm,
  alternative,
}: DeclineCardProps) {
  return (
    <div
      className="bg-surface-1 border border-surface-2 rounded-2xl p-6 pl-7 relative shadow-sm"
    >
      <div
        aria-hidden
        className="absolute left-0 top-5 bottom-5 w-1 bg-tng-orange rounded-r-sm"
      />
      <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-tng-orange mb-3">
        Tahan dulu · CFO check
      </div>
      <h3 className="font-display font-bold text-[20px] leading-tight tracking-tight text-ink-900 mb-2">
        Saya tak boleh approve {what} sekarang.
      </h3>
      <p className="text-[15px] leading-relaxed text-ink-700 mb-4">{reason}</p>
      {(cashOnHandRm !== undefined || monthlyDebtServiceRm !== undefined) && (
        <dl className="grid grid-cols-2 gap-3 mb-4 text-[13px]">
          {cashOnHandRm !== undefined && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Cash on hand
              </dt>
              <dd className="font-display font-bold text-ink-900 mt-0.5">
                {formatRm(cashOnHandRm)}
              </dd>
            </div>
          )}
          {monthlyDebtServiceRm !== undefined && (
            <div className="bg-surface-2 rounded-lg px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Bayar bulanan (loans)
              </dt>
              <dd className="font-display font-bold text-ink-900 mt-0.5">
                {formatRm(monthlyDebtServiceRm)}
              </dd>
            </div>
          )}
        </dl>
      )}
      {alternative && (
        <div className="border-t border-surface-2 pt-4 flex items-center justify-between gap-3">
          <span className="text-[14px] text-ink-700">{alternative.label}</span>
          <button
            type="button"
            onClick={alternative.onClick}
            className="inline-flex items-center gap-2 font-display font-semibold text-[14px] text-ink-900 bg-tng-yellow hover:bg-tng-yellow-deep px-4 py-2 rounded-lg shadow-cta active:translate-y-0.5 active:shadow-none transition"
          >
            {alternative.cta}
          </button>
        </div>
      )}
    </div>
  );
}
```

Smoke-test in `App.tsx`:

```tsx
<DeclineCard
  what="cash advance ke-3 bulan ni"
  reason="Mak Cik dah ambil dua cash advance bulan ni, jumlah RM 1,800. Kalau tambah lagi, bayar bulanan akan lebih 35% dari jualan. Itu zon bahaya untuk cashflow."
  cashOnHandRm={642}
  monthlyDebtServiceRm={520}
  alternative={{
    label: 'Tunggu 8 hari, lepas next pay cycle masuk?',
    cta: 'Set reminder',
  }}
/>
```

Confirm: orange left border, "Tahan dulu" mono eyebrow, friendly-but-firm wording, two cashflow stats in a 2-up grid, alternative CTA in yellow. Remove the temporary block.

- [ ] **Step 2: Re-style ReviewSubmitHandoff with tokens**

Replace `apps/web/src/components/handoff/ReviewSubmitHandoff.tsx`:

```tsx
import { ClipboardCheck } from 'lucide-react';

export function ReviewSubmitHandoff({ payload }: { payload: Record<string, unknown> }) {
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';
  const url = (payload.applicationUrl as string | undefined) ?? '#';
  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <ClipboardCheck className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Form dah lengkap</span>
      </div>
      <p className="text-sm text-ink-900 mb-3 leading-relaxed">
        Saya dah isi form {grantName}. Sila semak dan klik Submit di sini.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-tng-green px-4 py-2 text-white text-sm font-display font-semibold hover:bg-tng-green/90"
      >
        Take over and submit
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Re-style EmailHandoff with tokens**

Replace `apps/web/src/components/handoff/EmailHandoff.tsx`:

```tsx
import { Mail } from 'lucide-react';

export function EmailHandoff({ payload }: { payload: Record<string, unknown> }) {
  const to = (payload.to as string | undefined) ?? '';
  const subject = (payload.subject as string | undefined) ?? '';
  const body = (payload.body as string | undefined) ?? '';
  const grantName = (payload.grantName as string | undefined) ?? 'Grant';

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="rounded-2xl p-5 border-l-4"
      style={{
        background: 'rgba(0, 132, 67, 0.06)',
        borderLeftColor: 'var(--tng-green)',
      }}
    >
      <div className="flex items-center gap-2 mb-2 text-tng-green">
        <Mail className="w-4 h-4" />
        <span className="font-display font-semibold text-[15px]">Email draf siap</span>
      </div>
      <p className="text-sm text-ink-900 mb-3 leading-relaxed">
        {grantName} ni dihantar melalui emel. Saya dah draf untuk Mak Cik. Sila
        semak dan hantar dari mailbox sendiri.
      </p>
      <details className="mb-3 text-xs">
        <summary className="cursor-pointer text-tng-green font-mono uppercase tracking-wider">
          Tengok preview
        </summary>
        <div className="mt-2 space-y-1 text-ink-900">
          <div>
            <span className="font-mono text-[10px] uppercase text-ink-500">to</span> {to}
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase text-ink-500">subject</span>{' '}
            {subject}
          </div>
          <pre className="whitespace-pre-wrap font-body bg-surface-1 border border-surface-2 rounded p-2 mt-1">
            {body}
          </pre>
        </div>
      </details>
      <a
        href={mailto}
        className="inline-block rounded-lg bg-tng-green px-4 py-2 text-white text-sm font-display font-semibold hover:bg-tng-green/90"
      >
        Buka mail client
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Visual smoke-test**

Temporarily render the AP2 card in `App.tsx`:

```tsx
<AP2PaymentCard amountRm={102.5} payee="Lotus's Malaysia" onHold={() => alert('held')} />
```

Confirm TNG blue background, white amount, yellow CTA, muted-yellow mono footer. Then exercise an existing email and review-submit handoff via mocked agent events (or wait until Task 9 wires them).

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/web && npm run typecheck
cd ../..
git add apps/web/src/components/agent/AP2PaymentCard.tsx \
        apps/web/src/components/agent/DeclineCard.tsx \
        apps/web/src/components/handoff/ReviewSubmitHandoff.tsx \
        apps/web/src/components/handoff/EmailHandoff.tsx
git commit -m "Lane A: AP2PaymentCard + DeclineCard, retoken handoff cards"
```

---

## Task 9: Card dispatcher — wire tool_results to rich cards

**Goal:** When the orchestrator emits `tool_result` for `readSales`, render `RevenueCard` with the result instead of the raw JSON inside `ToolCallCard`. Same for `matchGrants` (one `GrantMatchedCard` per match) and `runProcurementAgent` (`ProcurementCard` summary). Also handle `handoff` with `kind: 'payment'` as `AP2PaymentCard`, and `kind: 'decline'` as `DeclineCard`.

> **Contract note:** `kind: 'decline'` is a new handoff variant the orchestrator does not emit yet. This task adds the renderer side. Lane B owns adding `'decline'` to the `AgentEvent.handoff.kind` enum in `packages/shared/src/contracts.ts` plus the LLM tool that produces it (likely `assessLeverage` or similar). Flag this in chat with Lane B before merging Task 9.

**Files:**
- Create: `apps/web/src/components/agent/dispatchAgentCard.tsx`
- Modify: `apps/web/src/components/chat/MessageList.tsx`
- Modify: `apps/web/src/components/chat/ChatWindow.tsx` (handoff payment kind)
- Modify: `apps/web/src/components/handoff/HandoffCard.tsx` (route payment to AP2 card)

**Verify:** Demo runbook step 3 shows a Revenue card. Step 4 shows Grant matched cards. Step 5 shows Procurement card during the live browser run.

- [ ] **Step 1: Create the dispatcher**

```tsx
// apps/web/src/components/agent/dispatchAgentCard.tsx
import { GrantMatchedCard } from './GrantMatchedCard.js';
import { ProcurementCard } from './ProcurementCard.js';
import { RevenueCard } from './RevenueCard.js';
import { normalizeForSparkline } from '../../lib/format.js';

type ToolResult = {
  toolName: string;
  result: unknown;
};

// Returns null when we have no rich card for this tool.
// MessageList falls back to the existing ToolCallCard JSON view in that case.
export function dispatchAgentCard({ toolName, result }: ToolResult) {
  if (toolName === 'readSales') return renderRevenue(result);
  if (toolName === 'matchGrants') return renderGrants(result);
  if (toolName === 'runProcurementAgent') return renderProcurement(result);
  return null;
}

function renderRevenue(raw: unknown) {
  const r = raw as {
    period: string;
    totalRm: number;
    count: number;
    avgTicketRm: number;
    transactions: Array<{ timestamp: string; amountRm: number }>;
  } | null;
  if (!r || typeof r.totalRm !== 'number') return null;

  // Group transactions by day, take the last 7 days, normalize to 0..1.
  const byDay = new Map<string, number>();
  for (const tx of r.transactions ?? []) {
    const day = tx.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + tx.amountRm);
  }
  const days = [...byDay.keys()].sort();
  const recent = days.slice(-7).map((d) => byDay.get(d) ?? 0);
  const series = normalizeForSparkline(recent.length === 7 ? recent : padLeft(recent, 7, 0));
  const todayRm = recent[recent.length - 1] ?? r.totalRm;
  const yesterdayRm = recent[recent.length - 2] ?? todayRm;
  const deltaPercent =
    yesterdayRm > 0 ? ((todayRm - yesterdayRm) / yesterdayRm) * 100 : 0;

  return (
    <RevenueCard
      totalRm={Number(todayRm.toFixed(2))}
      deltaPercent={Number(deltaPercent.toFixed(1))}
      comparedTo="yesterday"
      orderCount={r.count}
      series={series}
    />
  );
}

function renderGrants(raw: unknown) {
  const r = raw as {
    matches: Array<{
      grant: {
        id: string;
        name: string;
        agency: string;
        maxAmountRm: number;
        submissionMethod: 'web_form' | 'email';
      };
      reasons: string[];
    }>;
  } | null;
  if (!r?.matches?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {r.matches.slice(0, 3).map(({ grant, reasons }) => (
        <GrantMatchedCard
          key={grant.id}
          grantName={grant.name}
          agency={grant.agency}
          maxAmountRm={grant.maxAmountRm}
          collateralFree
          steps={reasons.slice(0, 3)}
        />
      ))}
    </div>
  );
}

function renderProcurement(raw: unknown) {
  const r = raw as {
    items?: Array<{ name: string; qty: string; priceRm: number }>;
    source?: string;
  } | null;
  if (!r?.items?.length) return null;
  return (
    <ProcurementCard
      source={r.source ?? "Lotus's"}
      live
      items={r.items}
    />
  );
}

function padLeft<T>(arr: T[], len: number, fill: T): T[] {
  if (arr.length >= len) return arr.slice(-len);
  return [...Array(len - arr.length).fill(fill), ...arr];
}
```

- [ ] **Step 2: Wire dispatcher into `MessageList.tsx`**

Open `apps/web/src/components/chat/MessageList.tsx`. Find the `case 'tool_call':` block and replace it so that when the tool has finished AND a rich card is available, render the card instead of the raw `ToolCallCard`.

Replace the existing `tool_call` switch arm:

```tsx
case 'tool_call': {
  if (item.status === 'done') {
    const rich = dispatchAgentCard({ toolName: item.name, result: item.result });
    if (rich) return <div key={item.id}>{rich}</div>;
  }
  return (
    <ToolCallCard
      key={item.id}
      name={item.name}
      input={item.input}
      status={item.status}
      result={item.result}
    />
  );
}
```

Add the import at the top:

```tsx
import { dispatchAgentCard } from '../agent/dispatchAgentCard.js';
```

- [ ] **Step 3: Route handoff kinds to the right card**

In `apps/web/src/components/handoff/HandoffCard.tsx`, replace the file with:

```tsx
import { AP2PaymentCard } from '../agent/AP2PaymentCard.js';
import { DeclineCard } from '../agent/DeclineCard.js';
import { ReviewSubmitHandoff } from './ReviewSubmitHandoff.js';
import { EmailHandoff } from './EmailHandoff.js';

// Once Lane B widens the handoff kind union to include 'decline', drop this
// local widening and import the shared type instead.
type HandoffKind = 'payment' | 'review_submit' | 'email' | 'decline';

export function HandoffCard({
  kind,
  payload,
}: {
  kind: HandoffKind;
  payload: Record<string, unknown>;
}) {
  switch (kind) {
    case 'payment': {
      const amountRm = (payload.amountRm as number | undefined) ?? 0;
      const payee = (payload.payee as string | undefined) ?? "Lotus's Malaysia";
      return <AP2PaymentCard amountRm={amountRm} payee={payee} />;
    }
    case 'decline': {
      return (
        <DeclineCard
          what={(payload.what as string | undefined) ?? 'permohonan ni'}
          reason={
            (payload.reason as string | undefined) ??
            'CFO check tak lulus. Cashflow tak cukup ruang sekarang.'
          }
          cashOnHandRm={payload.cashOnHandRm as number | undefined}
          monthlyDebtServiceRm={payload.monthlyDebtServiceRm as number | undefined}
          alternative={
            payload.alternative as
              | { label: string; cta: string }
              | undefined
          }
        />
      );
    }
    case 'review_submit':
      return <ReviewSubmitHandoff payload={payload} />;
    case 'email':
      return <EmailHandoff payload={payload} />;
  }
}
```

- [ ] **Step 4: Verify with the live orchestrator**

In one terminal: `cd apps/orchestrator && ANTHROPIC_API_KEY=sk-ant-... npm run dev`.
In another: `cd services/mock-tng && npm run dev`.
In a third: `cd apps/web && npm run dev`.

Open http://localhost:3000. Type **"macam mana business hari ni?"**. Expected: tool_call shows briefly, then the chat replaces it with a `RevenueCard` showing today's RM amount and a 7-bar sparkline with the last bar peak yellow.

Then type **"ada grant untuk saya?"**. Expected: 1 to 3 `GrantMatchedCard`s render. The card for `bnm-iaes` will follow when the user picks the email path in step 7.

Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/agent/dispatchAgentCard.tsx \
        apps/web/src/components/chat/MessageList.tsx \
        apps/web/src/components/handoff/HandoffCard.tsx
git commit -m "Lane A: dispatch tool_results to rich agent cards"
```

---

## Task 10: Greeting card

**Goal:** First-load hero card with Mak Cik's name fetched from mock-tng and a friendly opening line. Replaces the hardcoded greeting bubble.

**Files:**
- Create: `apps/web/src/components/chat/Greeting.tsx`
- Modify: `apps/web/src/components/chat/ChatWindow.tsx`

**Verify:** On first load, the greeting card displays "Hai Mak Cik Aminah" (or current `profile.name`), the stall name, and a friendly opener.

- [ ] **Step 1: Create the Greeting component**

```tsx
// apps/web/src/components/chat/Greeting.tsx
import { useEffect, useState } from 'react';

type Profile = {
  name: string;
  businessName: string;
  location: { city: string; state: string };
};

export function Greeting() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/merchant')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // Fallback to a generic greeting if mock-tng is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile?.name?.split(' ')[0] ?? 'Mak Cik';
  const business = profile?.businessName ?? 'kedai';

  return (
    <div className="bg-surface-1 border border-surface-2 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
      <div className="w-12 h-12 rounded-full bg-tng-blue flex items-center justify-center text-white font-display font-bold text-lg flex-shrink-0">
        R
      </div>
      <div className="flex-1">
        <div className="font-display font-bold text-ink-900 text-[18px] tracking-tight mb-1">
          Hai Mak Cik {name}.
        </div>
        <div className="text-[15px] leading-relaxed text-ink-700">
          Saya Rise, CFO digital untuk {business}. Boleh tanya saya pasal jualan,
          stok, atau grant. Mula dengan{' '}
          <span className="font-mono text-[13px] tracking-wide bg-surface-2 px-1.5 py-0.5 rounded">
            "macam mana business hari ni?"
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add a Vite proxy entry for `/api/merchant`**

Open `apps/web/vite.config.ts` and add another proxy line:

```ts
server: {
  port: 3000,
  proxy: {
    '/chat': { target: 'http://localhost:4000', changeOrigin: true },
    '/health': { target: 'http://localhost:4000', changeOrigin: true },
    '/api/merchant': { target: 'http://localhost:5000', rewrite: (p) => p.replace(/^\/api/, ''), changeOrigin: true },
  },
},
```

- [ ] **Step 3: Mount Greeting in ChatWindow**

In `apps/web/src/components/chat/ChatWindow.tsx`, remove the hardcoded greeting `ChatItem` and render the `Greeting` component above the `MessageList`.

```tsx
import { Greeting } from './Greeting.js';

// inside ChatWindow JSX, before <MessageList ...>
<div className="pt-6">
  <Greeting />
</div>
```

Also remove the initial greeting entry from the `useState<ChatItem[]>([...])` initial array. Start with `[]`.

- [ ] **Step 4: Verify**

Run all 3 services. Open http://localhost:3000. Confirm: Greeting card appears, "Hai Mak Cik Aminah", "Nasi Daging Salai Mak Cik" mentioned. Type a message. Confirm the greeting stays at the top, new messages appear below it.

Run: `cd apps/web && npm run typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/Greeting.tsx \
        apps/web/src/components/chat/ChatWindow.tsx \
        apps/web/vite.config.ts
git commit -m "Lane A: add Greeting card driven by mock-tng /merchant"
```

---

## Task 11: Loading + error state polish

**Goal:** Replace generic "Loading..." with "Sekejap ya" and "Tengah cari". Style error events with proper tokens. Keep agent text bubble visible during streaming.

**Files:**
- Modify: `apps/web/src/components/chat/Message.tsx`
- Modify: `apps/web/src/components/chat/MessageList.tsx`

**Verify:** When the agent is streaming, the empty bubble shows "Sekejap ya". On a stream error, a softly-styled banner appears in chat.

- [ ] **Step 1: Update Message.tsx**

Replace `apps/web/src/components/chat/Message.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

export function Message({
  role,
  text,
  streaming = false,
}: {
  role: 'user' | 'agent';
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          isUser
            ? 'bg-tng-blue text-white rounded-br-sm font-body'
            : 'bg-surface-1 border border-surface-2 text-ink-900 rounded-bl-sm font-body',
        )}
      >
        {text ? (
          <ReactMarkdown>{text}</ReactMarkdown>
        ) : streaming ? (
          <span className="text-ink-500 italic font-editorial">Sekejap ya</span>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update error rendering in MessageList.tsx**

In `apps/web/src/components/chat/MessageList.tsx`, replace the `case 'error':` arm with:

```tsx
case 'error':
  return (
    <div
      key={item.id}
      className="rounded-2xl p-4 border border-tng-pink/30 text-tng-pink text-sm leading-relaxed"
      style={{ background: 'rgba(239, 78, 116, 0.06)' }}
    >
      <span className="font-display font-semibold mr-2">Alamak,</span>
      {item.message}
    </div>
  );
```

- [ ] **Step 3: Verify**

Run all services. Trigger a long agent reply. Confirm the empty bubble shows "Sekejap ya" in italic Fraunces. Stop mock-tng to simulate a tool failure (`Ctrl+C` in its terminal), trigger a tool call, confirm the error banner uses pink token colors, not generic red.

Run typecheck.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/Message.tsx \
        apps/web/src/components/chat/MessageList.tsx
git commit -m "Lane A: polish loading and error states with tokens"
```

---

## Task 12: ChatInput + bubble polish

**Goal:** Apply CTA-yellow styling to the send button on emphasis (when there is text), refine placeholder copy, ensure no layout shift when streaming.

**Files:**
- Modify: `apps/web/src/components/chat/ChatInput.tsx`

**Verify:** Empty input → muted send button. Typing → button becomes vibrant TNG blue. Submitting clears input without horizontal jitter.

- [ ] **Step 1: Replace ChatInput.tsx**

```tsx
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';

export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (message: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const hasText = value.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue('');
    void onSubmit(trimmed);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-surface-2 bg-surface-1 py-3 sticky bottom-0"
    >
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={disabled}
          placeholder="Tanya apa-apa, contoh: macam mana business hari ni?"
          className="flex-1 resize-none rounded-xl border border-surface-2 px-3 py-2.5 text-[15px] font-body bg-surface-1 text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-4 focus:ring-tng-blue/15 focus:border-tng-blue disabled:bg-surface-2"
        />
        <button
          type="submit"
          disabled={disabled || !hasText}
          className={clsx(
            'rounded-xl w-11 h-11 flex items-center justify-center transition',
            hasText
              ? 'bg-tng-blue hover:bg-tng-blue-dark text-white'
              : 'bg-surface-2 text-ink-300 cursor-not-allowed',
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify**

Reload, focus the input — confirm the focus ring is TNG blue at low opacity. Type — send button turns vibrant TNG blue. Submit — input clears, no horizontal jitter, no scroll jump.

Run typecheck.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/ChatInput.tsx
git commit -m "Lane A: polish ChatInput focus ring and active send"
```

---

## Task 13: Sound cue on handoff (optional, stretch from CLAUDE.md)

**Goal:** When a `handoff` event arrives, play a short Web Audio chime to draw the user's attention. No external assets, stretch goal per Lane A's CLAUDE.md.

**Files:**
- Create: `apps/web/src/lib/sound.ts`
- Modify: `apps/web/src/components/chat/ChatWindow.tsx`

**Verify:** A handoff event plays a short pleasant chime once.

- [ ] **Step 1: Create sound.ts**

```ts
// apps/web/src/lib/sound.ts
// Web Audio chime. Two-note arpeggio, ~250ms total.
// No assets, no library. Honors prefers-reduced-motion as a soft mute.
export function playHandoffCue() {
  if (typeof window === 'undefined') return;
  const reduced =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return;

  const ctx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const notes = [659.25, 880]; // E5, A5
  const noteDuration = 0.12;
  const gap = 0.04;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * (noteDuration + gap);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + noteDuration + 0.02);
  });

  setTimeout(() => ctx.close().catch(() => null), 800);
}
```

- [ ] **Step 2: Fire on handoff in ChatWindow.tsx**

In the `onEvent` callback in `ChatWindow.tsx`, add a side-effect just before merging:

```tsx
import { playHandoffCue } from '../../lib/sound.js';
// ...
const onEvent = useCallback((event: AgentEvent) => {
  if (event.type === 'handoff') playHandoffCue();
  setItems((prev) => mergeEvent(prev, event));
}, []);
```

- [ ] **Step 3: Verify**

Run all services. Trigger the grant flow with TEKUN. When the `handoff` event lands, the cue plays once. Toggle macOS "Reduce Motion" in System Settings → Accessibility, confirm the cue is silent.

Run typecheck.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/sound.ts apps/web/src/components/chat/ChatWindow.tsx
git commit -m "Lane A: play short Web Audio cue on handoff"
```

---

## Task 14: End-to-end runbook pass with the live orchestrator

**Goal:** Walk `pitch/demo-runbook.md` steps 1 to 7 end-to-end with all four services running and the real LLM. Fix anything that breaks until the runbook passes cleanly.

**Files:**
- No file creation. Bug fixes land in whichever file owns the broken behavior.

**Verify:** Each runbook step matches its "Expected" line. Total time from "macam mana business hari ni?" to first response under 5s.

- [ ] **Step 1: Boot all services**

```bash
# Terminal 1
cd services/mock-tng && npm run dev
# Terminal 2
cd apps/orchestrator && LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run dev
# Terminal 3
cd services/browser-agent && uv run python -m src.server
# Terminal 4
cd apps/web && npm run dev
```

Confirm each `/health` endpoint returns `{ ok: true }`.

- [ ] **Step 2: Walk the runbook**

Open `pitch/demo-runbook.md` side by side with the running app.

Run each step in order. Mark the box in `pitch/demo-runbook.md` (green ✓) for each step that matches "Expected". For each step that fails, identify which lane owns the failure:
- Frontend rendering: Lane A
- LLM tool selection or wording: Lane B (file an issue, do not patch from Lane A)
- Browser viewport stuck: Lane C
- Mock data weirdness: Lane D

For Lane A failures, fix in place: usually a class name typo, a missing token import, or a misnamed payload field.

- [ ] **Step 3: Layout-shift check**

While the agent is streaming a long reply, watch the chat area. There should be no horizontal jitter and no scroll jump backwards. If a tool_call card appears, it should slide in below the latest bubble, not push existing ones.

If you see jitter: usually the textarea grows. Add `min-h-[44px]` to the `textarea` className in `ChatInput.tsx`.

- [ ] **Step 4: Phone-width sanity (375px)**

Open DevTools, set device toolbar to "iPhone SE (375 x 667)". Confirm: Greeting fits, agent cards stay readable, ChatInput stays sticky at bottom, no horizontal scroll.

- [ ] **Step 5: Commit any fixes**

```bash
git add -p   # review each change
git commit -m "Lane A: runbook pass · fix layout shift and small-screen overflow"
```

(If no Lane A bug fixes are needed, skip this commit.)

---

## Task 15: OBS recording session

**Goal:** Cut a clean 90-second screen recording of runbook steps 1 to 6. Saved to the demo laptop as the cut-to-tape fallback.

**Files:**
- No code. Output: `pitch/recordings/demo-fallback-<date>.mov` on the demo laptop, plus a copy uploaded to a shared drive linked from `pitch/script.md`.

**Verify:** Recording plays back smoothly, no notifications visible, no terminal windows in frame.

- [ ] **Step 1: Pre-flight checklist**

- macOS: System Settings → Notifications → Do Not Disturb on for the next hour.
- Browser: only `localhost:3000` open. No other tabs. Bookmarks bar hidden.
- Browser zoom: 110% (so text is readable in the recording).
- Dock: hidden (`Cmd+Option+D`).
- Battery: > 50% or plugged in.

- [ ] **Step 2: OBS setup**

- Source: Display Capture, just the browser window.
- Resolution: 1920x1080.
- Frame rate: 30 fps.
- Audio: input "default", monitor only (no mic for the fallback).
- Output: MP4, H.264, ~12 Mbps.

- [ ] **Step 3: Record**

Run the runbook end-to-end at a slightly slower pace than live demo. Pause briefly between steps so the cut points are obvious. Aim for 80 to 95 seconds total.

If you fluff a step: stop, do not edit, re-record from the top. Hackathon scope: take 1 or take 2, not 5.

- [ ] **Step 4: Save and link**

Save to `~/Desktop/tng-rise/pitch/recordings/demo-fallback-2026-04-26.mov` (or current date). Add the absolute path plus a shareable link to `pitch/script.md` under "Demo (90s)" so the speaker knows where the fallback lives.

```bash
git add pitch/script.md
git commit -m "Lane A: link OBS fallback recording in pitch script"
```

---

## Self-Review

**Spec coverage:** Every Lane A acceptance criterion in `IMPLEMENTATION.md` is covered, plus the CFO/cashflow doubling-down:
- Chat input + SSE: scaffolded, polished in Tasks 11 & 12.
- Each AgentEvent renders distinctly: Tasks 5, 6, 7, 8, 9 build the dispatcher and rich cards.
- Tool call spinner + collapse on result: existing `ToolCallCard` survives where no rich card exists; rich cards replace JSON inline.
- BrowserViewport: existing component used as-is, Task 14 verifies it.
- Handoff cards green + CTA: re-tokenized in Task 8.
- Email mailto: existing in scaffold, retoken applied in Task 8.
- No layout shift: Task 14 step 3.
- Runbook 1 to 3: covered by Tasks 9, 10, 14.
- **CFO posture (doubling-down update):** Greeting copy already leads with "CFO digital" (Task 10). Cards verb the CFO's three jobs: read (Revenue, Task 5), approve and deploy (Grant + Procurement + AP2, Tasks 6, 7, 8), decline (DeclineCard, Task 8). Contract change for `kind: 'decline'` flagged to Lane B in Task 9.

**Stretch goals (CLAUDE.md):**
- TNG-orange accent palette: built in. `--rise-accent` is the editorial accent on the chevron.
- Greeting with name + placeholder photo: Task 10 (the "R" badge stands in for the photo, replace with a real one if a non-trivial slot opens before Task 14).
- Sound cue: Task 13.

**Placeholder scan:** No "TBD", no "implement later", no bare "add error handling". Every step has the exact code to write or the exact command to run.

**Type consistency:** `RevenueCardProps`, `GrantMatchedCardProps`, `ProcurementCardProps`, `AP2PaymentCardProps` are defined once in their component files and consumed by `dispatchAgentCard.tsx` only. Tool result shapes referenced in the dispatcher match the orchestrator's tools (`apps/orchestrator/src/tools/readSales.ts` etc.) verified at write time.

**Time estimate (cumulative):**

| Task | Title | Est. |
| --- | --- | --- |
| 1 | Brand foundation | 30 min |
| 2 | TngBar | 15 min |
| 3 | RiseMark | 25 min |
| 4 | Format helpers | 15 min |
| 5 | RevenueCard | 35 min |
| 6 | GrantMatchedCard | 25 min |
| 7 | ProcurementCard | 35 min |
| 8 | AP2 + DeclineCard + handoff retoken | 50 min |
| 9 | Card dispatcher | 45 min |
| 10 | Greeting | 25 min |
| 11 | Loading + error polish | 20 min |
| 12 | ChatInput polish | 15 min |
| 13 | Sound cue (stretch) | 15 min |
| 14 | E2E runbook pass | 60 min |
| 15 | OBS recording | 30 min |
| **Total** | | **~7h 15m** |

This fits the build window from ~3 PM Saturday with comfortable slack. Tasks 1 to 8 are orchestrator-independent and can run before the 4:30 PM walking-skeleton gate.

---

## Review section

> Filled in after the plan is executed. See `Task Management` rule 5 in `/CLAUDE.md`.

(empty)

---

## Lessons captured

> Filled in after corrections. See `Self-Improvement Loop` in `/CLAUDE.md`.

(empty)
