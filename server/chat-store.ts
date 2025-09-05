// server/chat-store.ts
export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  ts: number;
}

interface Session {
  id: string;
  messages: ChatMessage[];
  lastActive: number;
}

const SESSIONS = new Map<string, Session>();
const MAX_MESSAGES = 50;           // cap per session
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours inactivity TTL

function now() { return Date.now(); }

function pruneOldSessions() {
  const cutoff = now() - TTL_MS;
  for (const [sid, s] of SESSIONS) {
    if (s.lastActive < cutoff) SESSIONS.delete(sid);
  }
}

export function getHistory(sessionId: string): ChatMessage[] {
  pruneOldSessions();
  const s = SESSIONS.get(sessionId);
  return s?.messages ?? [];
}

export function appendMessage(sessionId: string, msg: ChatMessage) {
  pruneOldSessions();
  let s = SESSIONS.get(sessionId);
  if (!s) {
    s = { id: sessionId, messages: [], lastActive: now() };
    SESSIONS.set(sessionId, s);
  }
  s.messages.push(msg);
  if (s.messages.length > MAX_MESSAGES) {
    s.messages.splice(0, s.messages.length - MAX_MESSAGES);
  }
  s.lastActive = now();
}

export function resetSession(sessionId: string) {
  SESSIONS.delete(sessionId);
}