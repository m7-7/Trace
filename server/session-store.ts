import session from "express-session";
import Database from "better-sqlite3";
import { resolveDbPath, ensureDataDir } from "./paths";

type Cb = (err?: any) => void;
type GetCb = (err: any, session?: session.SessionData | null) => void;

export class SqliteSessionStore extends session.Store {
  private db: Database.Database;
  private stmts: {
    get: Database.Statement;
    set: Database.Statement;
    destroy: Database.Statement;
    touch: Database.Statement;
    prune: Database.Statement;
  };

  constructor() {
    super();
    const dbPath = resolveDbPath();
    ensureDataDir(dbPath);
    this.db = new Database(dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        data    TEXT NOT NULL,
        expires INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires)
    `);

    this.stmts = {
      get:     this.db.prepare("SELECT data, expires FROM sessions WHERE sid = ?"),
      set:     this.db.prepare("INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)"),
      destroy: this.db.prepare("DELETE FROM sessions WHERE sid = ?"),
      touch:   this.db.prepare("UPDATE sessions SET expires = ? WHERE sid = ?"),
      prune:   this.db.prepare("DELETE FROM sessions WHERE expires <= ?"),
    };

    // Evict expired sessions carried over from a previous run
    this.stmts.prune.run(Date.now());
  }

  private expiry(sessionData: session.SessionData): number {
    const exp = (sessionData.cookie as any).expires;
    if (exp instanceof Date) return exp.getTime();
    const maxAge = sessionData.cookie?.maxAge;
    if (typeof maxAge === "number" && maxAge > 0) return Date.now() + maxAge;
    return Date.now() + 7 * 24 * 60 * 60 * 1000;
  }

  override get(sid: string, cb: GetCb): void {
    try {
      const row = this.stmts.get.get(sid) as { data: string; expires: number } | undefined;
      if (!row) return cb(null, null);
      if (row.expires <= Date.now()) {
        this.stmts.destroy.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data) as session.SessionData);
    } catch (err) {
      cb(err);
    }
  }

  override set(sid: string, sessionData: session.SessionData, cb?: Cb): void {
    try {
      this.stmts.set.run(sid, JSON.stringify(sessionData), this.expiry(sessionData));
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override destroy(sid: string, cb?: Cb): void {
    try {
      this.stmts.destroy.run(sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  override touch(sid: string, sessionData: session.SessionData, cb?: Cb): void {
    try {
      this.stmts.touch.run(this.expiry(sessionData), sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }
}
