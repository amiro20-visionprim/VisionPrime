import { NewSessionRecord, SessionRow } from "./sessions.types";

export interface SessionsRepository {
  create(record: NewSessionRecord): Promise<SessionRow>;
  findByRefreshTokenHash(hash: string): Promise<SessionRow | null>;
  revoke(id: string): Promise<void>;
}
