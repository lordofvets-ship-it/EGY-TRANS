const TOKEN_KEY = "qa_auth_token";
const ROLE_KEY = "qa_auth_role";

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
export const getRole = () => { try { return localStorage.getItem(ROLE_KEY) || ""; } catch { return ""; } };
export const setSession = (token: string, role: string) => { try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(ROLE_KEY, role); } catch {} };
export const clearSession = () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ROLE_KEY); } catch {} };
export const audioUrl = (hash: string) => `/api/audio/${encodeURIComponent(hash)}?token=${encodeURIComponent(getToken())}`;

let installed = false;
let forbiddenShownAt = 0;

/** Adds the bearer token to every same-origin /api request and reacts to 401/403 globally. */
export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : (input as Request).url;
    const isApi = url.startsWith("/api/") && !url.startsWith("/api/auth/login");
    let nextInit = init;
    if (isApi) {
      const token = getToken();
      if (token) {
        const headers = new Headers(init?.headers || (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined));
        headers.set("Authorization", `Bearer ${token}`);
        nextInit = { ...init, headers };
      }
    }
    const res = await original(input, nextInit);
    if (isApi && res.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("qa-auth-required"));
    } else if (isApi && res.status === 403 && Date.now() - forbiddenShownAt > 3000) {
      forbiddenShownAt = Date.now();
      window.dispatchEvent(new CustomEvent("qa-forbidden"));
    }
    return res;
  };
}
