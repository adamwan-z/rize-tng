// In-memory session store. Map keyed by sessionId. Resets on server restart.
// Fine for the demo. No persistence layer.

export type Turn = {
  role: 'user' | 'assistant';
  content: string;
};

const sessions = new Map<string, Turn[]>();

export function getHistory(sessionId: string): Turn[] {
  return sessions.get(sessionId) ?? [];
}

export function appendTurn(sessionId: string, turn: Turn): void {
  const history = sessions.get(sessionId) ?? [];
  history.push(turn);
  sessions.set(sessionId, history);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
