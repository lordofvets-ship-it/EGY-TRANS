import { isSameOriginRequest, isValidBasicCredentials } from "./security.ts";

export interface AccessPolicyInput {
  path: string;
  method: string;
  authorization?: string;
  origin?: string;
  referer?: string;
  host?: string;
  protocol?: string;
  forwardedProto?: string;
}

export interface AccessPolicyConfig {
  production: boolean;
  username: string;
  password: string;
}

export type AccessPolicyResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 503; error: string; challenge?: boolean };

/** Central policy shared by the Express middleware and HTTP regression tests. */
export function evaluateAccessPolicy(input: AccessPolicyInput, config: AccessPolicyConfig): AccessPolicyResult {
  if (input.path === "/api/health") return { allowed: true };

  const configuredUser = config.username || "";
  const configuredPassword = config.password || "";
  if (!config.production && !configuredUser && !configuredPassword) return { allowed: true };

  if (configuredUser.trim().length < 3 || configuredPassword.length < 24) {
    return {
      allowed: false,
      status: 503,
      error: "التطبيق مغلق لحين ضبط APP_BASIC_AUTH_USER وكلمة مرور قوية في إعدادات الخادم.",
    };
  }

  if (!isValidBasicCredentials(input.authorization || "", configuredUser, configuredPassword)) {
    return { allowed: false, status: 401, error: "يلزم تسجيل الدخول للوصول إلى التطبيق.", challenge: true };
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(input.method.toUpperCase())) {
    const sameOrigin = isSameOriginRequest({
      origin: input.origin,
      referer: input.referer,
      host: input.host,
      protocol: input.protocol,
      forwardedProto: input.forwardedProto,
    });
    if (!sameOrigin) {
      return { allowed: false, status: 403, error: "تم رفض الطلب لتعارض مصدره مع مصدر التطبيق." };
    }
  }

  return { allowed: true };
}
