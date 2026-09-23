import { randomUUID } from "node:crypto";
import { buildDataset, type Dataset } from "./seed.js";
import type { AuditEvent, Session } from "./types.js";

class Store {
  data: Dataset = buildDataset();
  sessions = new Map<string, Session>();
  audit: AuditEvent[] = [];

  reset(): void {
    this.data = buildDataset();
    this.sessions.clear();
    this.audit = [];
  }

  // -- Sessions -----------------------------------------------------------
  createSession(userId: string): Session {
    const session: Session = {
      token: randomUUID(),
      userId,
      activeClientId: null,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.token, session);
    return session;
  }

  getSession(token: string | undefined): Session | undefined {
    if (!token) return undefined;
    return this.sessions.get(token);
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  // -- Audit --------------------------------------------------------------
  record(
    actorUserId: string,
    clientId: string | null,
    action: string,
    entity: string,
    detail: string,
  ): void {
    this.audit.push({
      id: randomUUID(),
      clientId,
      actorUserId,
      action,
      entity,
      timestampUtc: new Date().toISOString(),
      detail,
    });
  }

  newId(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }
}

export const store = new Store();
