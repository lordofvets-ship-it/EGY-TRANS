import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export type Role = "admin" | "analyst";

const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const TTL_MS = 12 * 60 * 60 * 1000;
const PUBLIC_API = new Set(["/api/health", "/api/auth/login", "/api/auth/status"]);

/** Auth is enforced only when an admin password is configured (keeps local dev frictionless). */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_ADMIN_PASSWORD);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function checkPassword(password: string): Role | null {
  const admin = process.env.APP_ADMIN_PASSWORD;
  const analyst = process.env.APP_ANALYST_PASSWORD;
  if (admin && safeEqual(password, admin)) return "admin";
  if (analyst && safeEqual(password, analyst)) return "analyst";
  return null;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(role: Role, now = Date.now()): string {
  const body = b64u(JSON.stringify({ role, exp: now + TTL_MS }));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): { role: Role; exp: number } | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (!parsed?.exp || parsed.exp < now) return null;
    if (parsed.role !== "admin" && parsed.role !== "analyst") return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | undefined {
  const h = String(req.headers.authorization || "");
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  // <audio src> cannot send headers, so the audio endpoint also accepts ?token=
  if (typeof req.query?.token === "string" && req.path.startsWith("/api/audio/")) return req.query.token;
  return undefined;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/") || PUBLIC_API.has(req.path)) return next();
  if (!isAuthEnabled()) {
    (req as any).authRole = "admin" as Role;
    return next();
  }
  const v = verifyToken(extractToken(req));
  if (!v) return res.status(401).json({ error: "يلزم تسجيل الدخول للوصول إلى هذه الخدمة.", code: "AUTH_REQUIRED" });
  (req as any).authRole = v.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).authRole === "admin") return next();
  return res.status(403).json({ error: "هذه العملية متاحة للمدير فقط.", code: "ADMIN_ONLY" });
}
