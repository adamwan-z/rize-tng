import type { LLMMessage } from '../llm/client.js';

// Per-session in-memory store. Holds the full LLMMessage[] (including
// tool_use and tool_result content blocks) so multi-turn pronoun resolution
// and follow-through ("okay buatkan") work. Also holds firedAlerts so
// threshold-triggered nudges never repeat in one session.
type Session = {
  messages: LLMMessage[];
  firedAlerts: Set<string>;
  // Set when runProcurementAgent emits a financing_offer handoff. Cleared at
  // the start of the next /chat turn (i.e. when Mak Cik replies). Gates
  // acceptFinancingTerms so the LLM cannot auto-approve in the same turn.
  pendingFinancingApprovalRunId: string | null;
};

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { messages: [], firedAlerts: new Set(), pendingFinancingApprovalRunId: null };
    sessions.set(id, s);
  }
  return s;
}

export function setPendingFinancingApproval(id: string, runId: string): void {
  getSession(id).pendingFinancingApprovalRunId = runId;
}

export function getPendingFinancingApproval(id: string): string | null {
  return getSession(id).pendingFinancingApprovalRunId;
}

export function clearPendingFinancingApproval(id: string): void {
  getSession(id).pendingFinancingApprovalRunId = null;
}

export function setMessages(id: string, messages: LLMMessage[]): void {
  getSession(id).messages = messages;
}

export function alertAlreadyFired(id: string, key: string): boolean {
  return getSession(id).firedAlerts.has(key);
}

export function markAlertFired(id: string, key: string): void {
  getSession(id).firedAlerts.add(key);
}

export function clearSession(id: string): void {
  sessions.delete(id);
}
