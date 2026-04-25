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
  const res = await fetch(`${env.BROWSER_AGENT_URL}/run/grant_application`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: { grantId, profile, applicationUrl: grant.applicationUrl } }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`browser-agent /run/grant_application returned ${res.status}`);
  }

  yield* forwardBrowserStream(res.body);

  yield {
    type: 'handoff',
    kind: 'review_submit',
    payload: {
      grantId,
      grantName: grant.name,
      applicationUrl: grant.applicationUrl,
    },
  };

  return { ok: true, kind: 'web_form', grantId };
};

async function fetchProfile(): Promise<MerchantProfile> {
  const res = await fetch(`${env.MOCK_TNG_URL}/merchant`);
  if (!res.ok) throw new Error(`mock-tng /merchant returned ${res.status}`);
  return (await res.json()) as MerchantProfile;
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

async function* forwardBrowserStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent, void, void> {
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
        const step = JSON.parse(trimmed) as {
          runId: string;
          step: number;
          description: string;
          screenshotUrl?: string;
        };
        yield {
          type: 'browser_step',
          runId: step.runId,
          step: step.step,
          description: step.description,
          ...(step.screenshotUrl ? { screenshotUrl: step.screenshotUrl } : {}),
        };
      } catch {
        // ignore malformed lines
      }
    }
  }
}
