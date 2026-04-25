import { getGrantById } from '@tng-rise/grants-kb';
import { env } from '../lib/env.js';
import type { AgentEvent, MerchantProfile } from '@tng-rise/shared';
import type { ToolHandler } from './registry.js';

export const runGrantAgent: ToolHandler = async function* (input) {
  const grantId = input.grantId as string;
  const grant = getGrantById(grantId);
  if (!grant) {
    throw new Error(`Unknown grant id: ${grantId}`);
  }

  // Email-submission grants short-circuit the browser agent. We render a mailto
  // handoff card with the email body interpolated from the merchant profile.
  if (grant.submissionMethod === 'email') {
    const profile = await fetchProfile();
    const subject = interpolate(grant.emailTemplate?.subject ?? '', profile);
    const body = interpolate(grant.emailTemplate?.body ?? '', profile);
    yield {
      type: 'handoff',
      kind: 'email',
      payload: {
        to: grant.applicationEmail,
        subject,
        body,
        grantName: grant.name,
      },
    };
    return { ok: true, kind: 'email', grantId };
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

function interpolate(template: string, profile: MerchantProfile): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const path = key.trim().split('.');
    let value: unknown = profile;
    for (const segment of path) {
      if (value && typeof value === 'object' && segment in value) {
        value = (value as Record<string, unknown>)[segment];
      } else {
        return '';
      }
    }
    return String(value ?? '');
  });
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
