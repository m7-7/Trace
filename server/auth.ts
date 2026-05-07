import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);

export const ADMIN_USERNAME = "admin";

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
  }
}

export function buildSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required in .env");

  return session({
    store: new MemoryStore({ checkPeriod: 86400000 }),
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.authenticated) return next();
  res.status(401).json({ message: "Unauthorized" });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString("hex")}.${salt}`;
}

export async function verifyPassword(supplied: string, stored: string): Promise<boolean> {
  try {
    const [hashHex, salt] = stored.split(".");
    if (!hashHex || !salt) return false;
    const storedHash = Buffer.from(hashHex, "hex");
    const suppliedHash = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(storedHash, suppliedHash);
  } catch {
    return false;
  }
}
