import { describe, it, expect, beforeEach } from "vitest";
import { signToken, verifyToken, checkPassword, authMiddleware, requireAdmin, isAuthEnabled } from "../src/utils/auth";

const mkRes = () => { const r: any = { code: 200, body: null, status(c: number) { r.code = c; return r; }, json(b: any) { r.body = b; return r; } }; return r; };
const mkReq = (path: string, headers: any = {}, query: any = {}) => ({ path, headers, query } as any);

beforeEach(() => { process.env.APP_ADMIN_PASSWORD = "adm!n"; process.env.APP_ANALYST_PASSWORD = "analyst1"; });

describe("tokens", () => {
  it("round-trips a role", () => expect(verifyToken(signToken("analyst"))?.role).toBe("analyst"));
  it("rejects tampering", () => { const t = signToken("analyst"); const [b, s] = t.split("."); const forged = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + 1e9 })).toString("base64url"); expect(verifyToken(`${forged}.${s}`)).toBeNull(); expect(verifyToken(`${b}.x${s}`)).toBeNull(); });
  it("rejects expired tokens", () => expect(verifyToken(signToken("admin", Date.now() - 13 * 3600 * 1000))).toBeNull());
  it("rejects garbage", () => { expect(verifyToken(undefined)).toBeNull(); expect(verifyToken("abc")).toBeNull(); });
});

describe("passwords", () => {
  it("maps passwords to roles", () => { expect(checkPassword("adm!n")).toBe("admin"); expect(checkPassword("analyst1")).toBe("analyst"); expect(checkPassword("nope")).toBeNull(); expect(checkPassword("")).toBeNull(); });
});

describe("middleware", () => {
  it("lets public endpoints and non-API paths through", () => {
    for (const p of ["/api/health", "/api/auth/login", "/", "/assets/x.js"]) { let called = false; authMiddleware(mkReq(p), mkRes(), () => (called = true)); expect(called).toBe(true); }
  });
  it("blocks API calls without a token (401)", () => { const res = mkRes(); let called = false; authMiddleware(mkReq("/api/analyzed-calls"), res, () => (called = true)); expect(called).toBe(false); expect(res.code).toBe(401); });
  it("accepts a bearer token and sets the role", () => { const req = mkReq("/api/analyzed-calls", { authorization: `Bearer ${signToken("analyst")}` }); let called = false; authMiddleware(req, mkRes(), () => (called = true)); expect(called).toBe(true); expect(req.authRole).toBe("analyst"); });
  it("accepts ?token= only for the audio endpoint", () => {
    const t = signToken("analyst");
    let ok = false; authMiddleware(mkReq("/api/audio/abc", {}, { token: t }), mkRes(), () => (ok = true)); expect(ok).toBe(true);
    const res = mkRes(); let leaked = false; authMiddleware(mkReq("/api/analyzed-calls", {}, { token: t }), res, () => (leaked = true)); expect(leaked).toBe(false); expect(res.code).toBe(401);
  });
  it("requireAdmin blocks analysts (403) and allows admins", () => {
    const res = mkRes(); let called = false; requireAdmin({ authRole: "analyst" } as any, res, () => (called = true)); expect(called).toBe(false); expect(res.code).toBe(403);
    requireAdmin({ authRole: "admin" } as any, mkRes(), () => (called = true)); expect(called).toBe(true);
  });
  it("is disabled (open) when no admin password is configured", () => {
    delete process.env.APP_ADMIN_PASSWORD;
    expect(isAuthEnabled()).toBe(false);
    const req = mkReq("/api/analyzed-calls"); let called = false; authMiddleware(req, mkRes(), () => (called = true)); expect(called).toBe(true); expect(req.authRole).toBe("admin");
  });
});
