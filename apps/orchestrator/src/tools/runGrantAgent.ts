import { getGrantById } from '@tng-rise/grants-kb';
import { env } from '../lib/env.js';
import type { AgentEvent, MerchantProfile } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';
import { markGrantApplied } from '../agent/memory.js';

export const runGrantAgent: ToolHandler = async function* (input, ctx) {
  const grantId = input.grantId as string;
  const grant = getGrantById(grantId);
  if (!grant) {
    throw new Error(`Unknown grant id: ${grantId}`);
  }

  // Email-submission grants drive the Gmail mock end-to-end. Generate the
  // application pack PDF, preview it in-browser, fill the compose draft,
  // attach, and click Send. The browser-agent service handles all of that.
  if (grant.submissionMethod === 'email') {
    const profile = await fetchProfile();
    const itekadRequest = {
      profile: {
        id: profile.id,
        name: profile.name,
        businessName: profile.businessName,
        businessType: profile.businessType,
        location_city: profile.location.city,
        location_state: profile.location.state,
        registeredSince: profile.registeredSince,
        ssm: profile.ssm,
        monthlyRevenueRm: profile.monthlyRevenueRm,
        monthlyCostsRm: profile.monthlyCostsRm,
      },
      email_to: grant.applicationEmail ?? 'ekad@bnm.gov.my',
      mode: (input.mode as 'scripted' | 'agent' | undefined) ?? 'scripted',
    };

    const emailRes = await fetch(`${env.BROWSER_AGENT_URL}/run/itekad_application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itekadRequest),
    });
    if (!emailRes.ok || !emailRes.body) {
      const detail = emailRes.body ? await emailRes.text() : '';
      throw new Error(
        `browser-agent /run/itekad_application returned ${emailRes.status} ${detail}`,
      );
    }

    let sentTo: string | null = null;
    let sentSubject: string | null = null;
    let sentAttachment: string | null = null;
    for await (const event of forwardBrowserStream(emailRes.body)) {
      if (event.result) {
        const r = event.result as Record<string, unknown>;
        if (typeof r.sentTo === 'string') sentTo = r.sentTo;
        if (typeof r.sentSubject === 'string') sentSubject = r.sentSubject;
        if (typeof r.sentAttachment === 'string') sentAttachment = r.sentAttachment;
      }
      const { result: _result, ...forFe } = event;
      yield forFe as AgentEvent;
    }

    // Mark the grant as applied so matchGrants drops it on subsequent calls.
    // Done on completion (not just on send-success) because the demo treats
    // any completed run, including the recorded fallback, as Mak Cik having
    // engaged with this grant.
    markGrantApplied(ctx.sessionId, grantId);

    return {
      ok: true,
      kind: 'email',
      grantId,
      grantName: grant.name,
      sentTo,
      sentSubject,
      sentAttachment,
    };
  }

  // Web form grants: kick off the browser agent and forward steps.
  const profile = await fetchProfile();
  const grantProfile = toGrantProfile(profile, grant.maxAmountRm);
  const mode = (input.mode as 'scripted' | 'agent' | undefined) ?? 'scripted';

  const res = await fetch(`${env.BROWSER_AGENT_URL}/run/grant_application`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: grantProfile,
      application_url: grant.applicationUrl,
      grant_id: grantId,
      mode,
    }),
  });
  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : '';
    throw new Error(`browser-agent /run/grant_application returned ${res.status} ${detail}`);
  }

  let referenceNumber: string | null = null;
  for await (const event of forwardBrowserStream(res.body)) {
    // The terminator event carries the reference number in result.
    if (event.result?.referenceNumber) {
      referenceNumber = String(event.result.referenceNumber);
    }
    // Strip the result field before yielding to FE; it is internal.
    const { result: _result, ...forFe } = event;
    yield forFe as AgentEvent;
  }

  yield {
    type: 'handoff',
    kind: 'review_submit',
    payload: {
      grantId,
      grantName: grant.name,
      applicationUrl: grant.applicationUrl,
      referenceNumber,
    },
  };

  markGrantApplied(ctx.sessionId, grantId);

  return { ok: true, kind: 'web_form', grantId, referenceNumber };
};

async function fetchProfile(): Promise<MerchantProfile> {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) throw new Error(`mock-tng /merchant returned ${res.status}`);
  return (await res.json()) as MerchantProfile;
}

// MerchantProfile holds TNG-side data (revenue, SSM, location). The grant form
// also needs NRIC/mobile/email which TNG does not have. For the demo these are
// hardcoded; the production flow would prompt the merchant for them.
function toGrantProfile(p: MerchantProfile, requestedAmountRm: number) {
  return {
    full_name: p.name,
    nric: '740512-10-5234',
    mobile: '012-3456789',
    email: 'merchant@example.com',
    business_name: p.businessName,
    business_reg_no: p.ssm ?? 'JM0000000-X',
    business_type: 'F&B',
    business_address: `${p.location.city}, ${p.location.state}`,
    years_operating: yearsSince(p.registeredSince),
    employee_count: 3,
    annual_revenue: p.monthlyRevenueRm * 12,
    requested_amount: requestedAmountRm,
    purpose:
      'Expand to a permanent stall location with proper kitchen equipment, ' +
      'hire two additional staff, and develop branded packaging.',
  };
}

function yearsSince(isoDate: string): number {
  const start = new Date(isoDate).getTime();
  if (Number.isNaN(start)) return 1;
  return Math.max(1, Math.floor((Date.now() - start) / (365 * 24 * 60 * 60 * 1000)));
}

// The orchestrator's AgentEvent.browser_step shape only declares the fields
// FE renders directly. The browser-agent terminator includes done/result/error
// which we surface via this typed parsed-line so the caller in this file can
// pluck out the reference number. FE only needs the step description and
// screenshot, which we forward on every event.
type BrowserAgentLine = {
  runId: string;
  step: number;
  description: string;
  screenshotUrl?: string;
  done?: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

async function* forwardBrowserStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent & { result?: Record<string, unknown> }, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const step = JSON.parse(trimmed) as BrowserAgentLine;
        const evt: AgentEvent & { result?: Record<string, unknown> } = {
          type: 'browser_step',
          runId: step.runId,
          step: step.step,
          description: step.description,
          ...(step.screenshotUrl ? { screenshotUrl: step.screenshotUrl } : {}),
        };
        if (step.result) (evt as { result: Record<string, unknown> }).result = step.result;
        yield evt;
      } catch {
        // ignore malformed lines
      }
    }
  }
}
