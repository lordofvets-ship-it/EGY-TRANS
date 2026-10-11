import React, { useCallback, useEffect, useState } from "react";
import { Headphones, Lock, LogIn, ShieldAlert } from "lucide-react";
import { clearSession, getToken, setSession } from "../utils/authClient";

type Phase = "checking" | "open" | "login";

export const LoginGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/status", { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined });
      const d = await r.json();
      setPhase(!d.authRequired || d.authenticated ? "open" : "login");
    } catch {
      setPhase("open"); // server unreachable: let the app show its own connection errors
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    const onAuth = () => { clearSession(); setPhase("login"); };
    const onForbidden = () => setNotice("هذه العملية متاحة للمدير فقط.");
    window.addEventListener("qa-auth-required", onAuth);
    window.addEventListener("qa-forbidden", onForbidden);
    return () => { window.removeEventListener("qa-auth-required", onAuth); window.removeEventListener("qa-forbidden", onForbidden); };
  }, []);

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(t); }, [notice]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "تعذّر تسجيل الدخول."); return; }
      setSession(d.token, d.role);
      setPassword("");
      setPhase("open");
    } finally { setBusy(false); }
  };

  if (phase === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-stone-500 text-sm" dir="rtl">جاري التحقق…</div>;
  }

  if (phase === "login") {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-[#FAF7F2] dark:bg-[#121110]">
        <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-[#1C1A18] border border-[#EAE3D9] dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4" aria-label="تسجيل الدخول">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#C25E38]/10 text-[#C25E38] border border-[#C25E38]/20 flex items-center justify-center"><Headphones className="w-5 h-5" /></div>
            <div>
              <h1 className="text-base font-black text-stone-900 dark:text-stone-100">تدقيق جودة المكالمات</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400">سجّل الدخول للمتابعة</p>
            </div>
          </div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
            كلمة المرور
            <div className="mt-1.5 relative">
              <Lock className="w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 right-3" />
              <input
                type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2.5 pr-9 pl-3 rounded-xl border border-[#EAE3D9] dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 outline-none focus:border-[#C25E38]"
              />
            </div>
          </label>
          {error && <div role="alert" className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-2.5"><ShieldAlert className="w-4 h-4 shrink-0" />{error}</div>}
          <button type="submit" disabled={busy || !password} className="w-full py-2.5 bg-[#C25E38] hover:bg-[#A94E2C] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
            <LogIn className="w-4 h-4" /><span>{busy ? "جاري الدخول…" : "دخول"}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {notice && <div role="status" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold shadow-lg">{notice}</div>}
      {children}
    </>
  );
};
