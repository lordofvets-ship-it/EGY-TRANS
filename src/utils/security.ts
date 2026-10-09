import { timingSafeEqual } from "node:crypto";

/** Compare UTF-8 secrets without leaking the first differing byte. */
export function safeSecretEqual(supplied: string, expected: string): boolean {
  const a = Buffer.from(String(supplied ?? ""), "utf8");
  const b = Buffer.from(String(expected ?? ""), "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function parseBasicAuthorization(header = ""): { username: string; password: string } | null {
  const match = header.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    // Reject malformed/non-canonical base64 to avoid parser ambiguity.
    if (!username || !password || Buffer.from(decoded, "utf8").toString("base64") !== match[1]) return null;
    return { username, password };
  } catch {
    return null;
  }
}

export function isValidBasicCredentials(header: string, expectedUser: string, expectedPassword: string): boolean {
  if (expectedUser.trim().length < 3 || expectedPassword.length < 24) return false;
  const supplied = parseBasicAuthorization(header);
  if (!supplied) return false;
  return safeSecretEqual(supplied.username, expectedUser) && safeSecretEqual(supplied.password, expectedPassword);
}

export function isValidBackupToken(suppliedToken: string, expectedToken: string): boolean {
  return expectedToken.trim().length >= 32 && safeSecretEqual(suppliedToken, expectedToken.trim());
}

export function isSameOriginRequest(input: {
  origin?: string;
  referer?: string;
  host?: string;
  protocol?: string;
  forwardedProto?: string;
}): boolean {
  const rawOrigin = input.origin || input.referer;
  if (!rawOrigin || !input.host) return false;
  try {
    const requestOrigin = new URL(rawOrigin).origin;
    const forwardedProto = (input.forwardedProto || "").split(",")[0].trim();
    const protocol = forwardedProto || input.protocol || "";
    if (protocol !== "http" && protocol !== "https") return false;
    return requestOrigin === `${protocol}://${input.host}`;
  } catch {
    return false;
  }
}


/** Accept only a configured backup filename, never a path supplied by a request. */
export function isSafeBackupFilename(filename: string): boolean {
  if (!filename || filename !== filename.trim()) return false;
  if (filename !== filename.split(/[\\/]/).pop()) return false;
  if (filename === '.' || filename === '..') return false;
  return /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\.zip|[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz)$/i.test(filename);
}
