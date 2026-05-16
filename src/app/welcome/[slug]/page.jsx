"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Coffee, Lock, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";

// Public page — no auth, no admin chrome. Single column, mobile-first.
//
// Flow:
//   1) On mount, fetch /api/marketing/welcome/<slug>.
//        - 404      → "code not found" screen.
//        - state=pending → "needs activation" screen with cashier PIN form.
//        - state=active  → welcome + menu screen.
//   2) Cashier types PIN → POST /api/marketing/activate.
//        - 200 → optimistically refetch welcome (now state=active).
//        - 401 → "wrong PIN" inline.
//        - 409 → already active (race) → refetch.

export default function PublicWelcomePage() {
  const params = useParams();
  const slug = String(params?.slug || "").trim();
  const queryClient = useQueryClient();

  // Preview mode: /welcome/preview is a special slug for the admin to
  // see what the screen looks like without creating a real blogger.
  const isPreview = slug === "preview";

  const welcomeQuery = useQuery({
    queryKey: ["public-welcome", slug],
    enabled: !!slug && !isPreview,
    queryFn: async () => {
      const r = await fetch(
        `/api/marketing/welcome/${encodeURIComponent(slug)}`,
      );
      if (r.status === 404) {
        throw new Error("NOT_FOUND");
      }
      if (!r.ok) {
        throw new Error("FETCH_FAILED");
      }
      return r.json();
    },
    retry: false,
  });

  // Preview pulls settings + menu only (no blogger).
  const previewQuery = useQuery({
    queryKey: ["public-welcome-preview"],
    enabled: isPreview,
    queryFn: async () => {
      const [sRes, mRes] = await Promise.all([
        fetch("/api/marketing/settings"),
        // Menu list is admin-gated. For preview we just show settings
        // and a placeholder menu — admins can verify their styling.
        Promise.resolve({ ok: true, json: async () => ({ items: [] }) }),
      ]);
      const [settings, menu] = await Promise.all([sRes.json(), mRes.json()]);
      return {
        blogger: { name: "اسم البلوقر", slug: "PREVIEW", state: "active" },
        items: menu.items || [],
        settings: settings.settings || null,
      };
    },
  });

  const data = isPreview ? previewQuery.data : welcomeQuery.data;
  const blogger = data?.blogger || null;
  const settings = data?.settings || null;
  const items = data?.items || [];

  const accent = settings?.accent_color || "#10b981";
  const logoLetter = settings?.logo_letter || "Q";
  const cafeName = settings?.cafe_name || "Quarters Coffee Bar";
  const welcomeHeadline = settings?.welcome_headline || "مرحباً بك";
  const welcomeSub = settings?.welcome_subtext || "";

  // Group menu items by category once.
  const grouped = useMemo(() => {
    const g = {};
    for (const it of items) {
      if (!g[it.category]) g[it.category] = [];
      g[it.category].push(it);
    }
    return g;
  }, [items]);

  // Activation form state.
  const [pin, setPin] = useState("");
  const [cashier, setCashier] = useState("");
  const [activateError, setActivateError] = useState(null);

  const activateMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/marketing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin, cashierName: cashier || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التفعيل");
      return d;
    },
    onSuccess: () => {
      setActivateError(null);
      setPin("");
      queryClient.invalidateQueries({ queryKey: ["public-welcome", slug] });
    },
    onError: (e) => setActivateError(e.message || "خطأ"),
  });

  // Lock body scroll for fullscreen feel.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = `linear-gradient(135deg, ${accent}11, #0b0b1a)`;
    return () => {
      document.body.style.background = prev;
    };
  }, [accent]);

  const submitPin = (e) => {
    e.preventDefault();
    if (!pin) return setActivateError("أدخل رقم التفعيل");
    activateMut.mutate();
  };

  // Loading
  if (
    (welcomeQuery.isLoading && !isPreview) ||
    (previewQuery.isLoading && isPreview)
  ) {
    return (
      <FullscreenWrapper accent={accent}>
        <div className="text-white/65">جاري التحميل…</div>
      </FullscreenWrapper>
    );
  }

  // 404 — code not found
  if (!isPreview && welcomeQuery.isError) {
    const msg =
      welcomeQuery.error?.message === "NOT_FOUND"
        ? "الكود غير موجود أو لم يعد صالحاً."
        : "تعذّر تحميل البيانات.";
    return (
      <FullscreenWrapper accent={accent}>
        <div className="text-center max-w-md w-full">
          <Logo letter={logoLetter} accent={accent} />
          <h1 className="text-2xl font-bold text-white mt-6">{cafeName}</h1>
          <div className="mt-6 p-6 rounded-3xl bg-red-500/10 border border-red-500/25 text-red-100">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-70" />
            <p className="text-lg font-semibold">{msg}</p>
            <p className="text-sm text-red-200/70 mt-2">
              تأكد من الرابط أو راجع الكاشير.
            </p>
          </div>
        </div>
      </FullscreenWrapper>
    );
  }

  // Pending — show activation form
  if (blogger && blogger.state === "pending" && !isPreview) {
    return (
      <FullscreenWrapper accent={accent}>
        <div className="text-center max-w-md w-full">
          <Logo letter={logoLetter} accent={accent} />
          <h1 className="text-2xl font-bold text-white mt-6">{cafeName}</h1>
          <p className="text-white/55 text-sm mt-1">دعوة خاصة لـ {blogger.name}</p>

          <div className="mt-8 p-6 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
            <Lock
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: accent }}
            />
            <h2 className="text-xl font-bold text-white">
              يلزم تفعيل الكود من الكاشير
            </h2>
            <p className="text-white/55 text-sm mt-2 leading-relaxed">
              سلّم الجهاز للكاشير وادخل رقم التفعيل الخاص بـ {cafeName}.
            </p>

            <form onSubmit={submitPin} className="mt-6 space-y-3 text-right">
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  رقم التفعيل
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-white/30"
                  placeholder="••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  اسم الكاشير (اختياري)
                </label>
                <input
                  type="text"
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-white/30"
                />
              </div>
              {activateError ? (
                <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-100 text-sm">
                  {activateError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={activateMut.isPending}
                className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-50 transition-opacity"
                style={{ background: accent }}
              >
                {activateMut.isPending ? "جاري التفعيل…" : "تفعيل الكود"}
              </button>
            </form>
          </div>
        </div>
      </FullscreenWrapper>
    );
  }

  // Active (or preview) — welcome + menu screen
  return (
    <FullscreenWrapper accent={accent}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Logo letter={logoLetter} accent={accent} />
          <div className="mt-6 flex items-center justify-center gap-2 text-white/60 text-sm">
            <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            <span>{cafeName}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-4 leading-tight">
            {welcomeHeadline}
          </h1>
          {welcomeSub ? (
            <p className="text-white/70 text-lg mt-2">{welcomeSub}</p>
          ) : null}
          {blogger?.name ? (
            <div
              className="mt-6 inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-semibold"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span>{blogger.name}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Coffee className="w-5 h-5" style={{ color: accent }} />
            <h2 className="text-xl font-bold text-white">ضيافتك</h2>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="text-white/55 text-sm text-center py-8">
              المنيو غير متاح بعد. تواصل مع الكاشير.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, list]) => (
                <div key={category}>
                  <h3
                    className="text-sm font-bold mb-3"
                    style={{ color: accent }}
                  >
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {list.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold">
                            {it.name_ar}
                          </div>
                          {it.name_en ? (
                            <div className="text-white/40 text-xs">
                              {it.name_en}
                            </div>
                          ) : null}
                          {it.description ? (
                            <div className="text-white/55 text-xs mt-1 leading-relaxed">
                              {it.description}
                            </div>
                          ) : null}
                        </div>
                        {it.price !== null && it.price !== undefined ? (
                          <div className="text-white/80 text-sm font-bold whitespace-nowrap">
                            {Number(it.price).toFixed(2)} ر.س
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-white/40 text-xs mt-6">
          {cafeName} · بطاقة دعوة شخصية
        </div>
      </div>
    </FullscreenWrapper>
  );
}

function FullscreenWrapper({ accent, children }) {
  return (
    <div
      dir="rtl"
      className="min-h-[100svh] flex items-center justify-center p-4 sm:p-8"
      style={{
        background: `radial-gradient(circle at 30% 0%, ${accent}1a 0%, transparent 50%), radial-gradient(circle at 70% 100%, ${accent}14 0%, transparent 60%), #0b0b1a`,
      }}
    >
      {children}
    </div>
  );
}

function Logo({ letter, accent }) {
  return (
    <div
      className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-white text-5xl font-extrabold"
      style={{
        background: `linear-gradient(135deg, ${accent}, #0b0b1a)`,
        boxShadow: `0 16px 48px ${accent}55`,
      }}
    >
      {letter}
    </div>
  );
}
