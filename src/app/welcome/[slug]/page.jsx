"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Coffee, Lock, Sparkles, AlertCircle } from "lucide-react";
import { queryKeys } from "../../../utils/queryKeys.js";

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
    queryKey: queryKeys.publicWelcome(slug),
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
    queryKey: queryKeys.publicWelcomePreview(),
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

  const accent = settings?.accent_color || "#7a8b5f";
  const cream = settings?.cream_color || "#e8e9d6";
  const cafeName = settings?.cafe_name || "QUARTERS";
  const cafeNameAr = settings?.cafe_name_ar || "كوارتـــرز";
  const cafeTagline = settings?.cafe_tagline || "BAR";
  const welcomeHeadline = settings?.welcome_headline || "أهلاً بك في كوارترز";
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
      queryClient.invalidateQueries({ queryKey: queryKeys.publicWelcome(slug) });
    },
    onError: (e) => setActivateError(e.message || "خطأ"),
  });

  // Solid brand olive — no gradients. Matches the printed card.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = accent;
    return () => {
      document.body.style.background = prev;
    };
  }, [accent]);

  const submitPin = (e) => {
    e.preventDefault();
    if (!pin) return setActivateError("أدخل رقم التفعيل");
    activateMut.mutate();
  };

  const brandProps = { cafeName, cafeNameAr, cafeTagline, cream };

  // Loading
  if (
    (welcomeQuery.isLoading && !isPreview) ||
    (previewQuery.isLoading && isPreview)
  ) {
    return (
      <FullscreenWrapper accent={accent} cream={cream}>
        <div style={{ textAlign: "center", opacity: 0.6, fontFamily: '"El Messiri", sans-serif' }}>
          جاري التحميل…
        </div>
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
      <FullscreenWrapper accent={accent} cream={cream}>
        <div className="max-w-md w-full mx-auto">
          <BrandWordmark {...brandProps} size="md" />
          <div
            className="mt-10 p-8 rounded-2xl text-center"
            style={{
              background: `${cream}10`,
              border: `1px solid ${cream}26`,
              backdropFilter: "blur(8px)",
            }}
          >
            <AlertCircle className="w-10 h-10 mx-auto mb-4 opacity-60" style={{ color: cream }} />
            <p style={{ fontFamily: '"El Messiri", sans-serif', fontSize: 18, fontWeight: 700, color: cream }}>
              {msg}
            </p>
            <p style={{ fontFamily: '"El Messiri", sans-serif', fontSize: 13, color: cream, opacity: 0.65, marginTop: 8 }}>
              تأكد من الرابط أو راجع الكاشير.
            </p>
          </div>
        </div>
      </FullscreenWrapper>
    );
  }

  // Pre-activation — show activation form. Covers both 'pending'
  // (not yet handed out) and 'invited' (admin marked as invited but
  // cashier hasn't activated yet). Menu only opens when state is
  // genuinely 'active'.
  if (
    blogger &&
    blogger.state !== "active" &&
    !isPreview
  ) {
    return (
      <FullscreenWrapper accent={accent} cream={cream}>
        <div className="max-w-md w-full mx-auto">
          <BrandWordmark {...brandProps} size="md" />
          <div
            style={{
              width: 48,
              height: 1,
              background: `${cream}55`,
              margin: "20px auto 0",
            }}
          />
          <p
            style={{
              fontFamily: '"El Messiri", sans-serif',
              textAlign: "center",
              color: cream,
              opacity: 0.7,
              fontSize: 14,
              marginTop: 14,
              letterSpacing: "0.06em",
            }}
          >
            دعوة خاصة لـ {blogger.name}
          </p>

          <div
            className="mt-8 p-7 rounded-2xl"
            style={{
              background: `${cream}0d`,
              border: `1px solid ${cream}2a`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: cream, opacity: 0.85 }} />
              <h2
                style={{
                  fontFamily: '"El Messiri", sans-serif',
                  fontSize: 20,
                  fontWeight: 700,
                  color: cream,
                  letterSpacing: "0.02em",
                }}
              >
                يلزم تفعيل الكود من الكاشير
              </h2>
              <p
                style={{
                  fontFamily: '"El Messiri", sans-serif',
                  fontSize: 13,
                  color: cream,
                  opacity: 0.65,
                  marginTop: 8,
                  lineHeight: 1.8,
                }}
              >
                سلّم الجهاز للكاشير لإدخال رقم التفعيل.
              </p>
            </div>

            <form onSubmit={submitPin} className="mt-6 space-y-3" style={{ textAlign: "right" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: '"El Messiri", sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    color: cream,
                    opacity: 0.75,
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  رقم التفعيل
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 14,
                    background: `${cream}10`,
                    border: `1px solid ${cream}2a`,
                    color: cream,
                    textAlign: "center",
                    fontSize: 24,
                    letterSpacing: "0.4em",
                    fontFamily: '"Cormorant Garamond", serif',
                    outline: "none",
                  }}
                  placeholder="••••••"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: '"El Messiri", sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    color: cream,
                    opacity: 0.75,
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  اسم الكاشير (اختياري)
                </label>
                <input
                  type="text"
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 14,
                    background: `${cream}10`,
                    border: `1px solid ${cream}2a`,
                    color: cream,
                    fontFamily: '"El Messiri", sans-serif',
                    outline: "none",
                  }}
                />
              </div>
              {activateError ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(220, 38, 38, 0.18)",
                    border: "1px solid rgba(220, 38, 38, 0.4)",
                    color: "#fecaca",
                    fontFamily: '"El Messiri", sans-serif',
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  {activateError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={activateMut.isPending}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 14,
                  background: cream,
                  color: accent,
                  fontFamily: '"El Messiri", sans-serif',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  border: "none",
                  cursor: "pointer",
                  opacity: activateMut.isPending ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {activateMut.isPending ? "جاري التفعيل…" : "تفعيل الكود"}
              </button>
            </form>
          </div>

          {/* Menu preview shown under the activation form so the
              blogger can browse the hospitality menu while waiting on
              the cashier. The wording flags it as a preview — items
              don't get redeemed until the PIN flips state to active. */}
          {Object.keys(grouped).length > 0 ? (
            <div
              className="mt-8 p-6 rounded-2xl"
              style={{
                background: `${cream}08`,
                border: `1px solid ${cream}1f`,
                backdropFilter: "blur(8px)",
              }}
            >
              <MenuList grouped={grouped} cream={cream} title="معاينة قائمة الضيافة" preview />
            </div>
          ) : null}
        </div>
      </FullscreenWrapper>
    );
  }

  // Active (or preview) — welcome + menu screen
  return (
    <FullscreenWrapper accent={accent} cream={cream}>
      <div className="w-full max-w-2xl mx-auto">
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <BrandWordmark {...brandProps} size="lg" />

          <div
            style={{
              width: 56,
              height: 1,
              background: `${cream}55`,
              margin: "28px auto 0",
            }}
          />

          <div
            style={{
              fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.5em",
              color: cream,
              opacity: 0.8,
              textTransform: "uppercase",
              marginTop: 22,
            }}
          >
            Welcome
          </div>

          <h1
            style={{
              fontFamily: '"El Messiri", "Cairo", sans-serif',
              fontSize: "clamp(28px, 6vw, 42px)",
              fontWeight: 700,
              color: cream,
              marginTop: 6,
              lineHeight: 1.3,
              letterSpacing: "0.01em",
            }}
          >
            {welcomeHeadline}
          </h1>
          {welcomeSub ? (
            <p
              style={{
                fontFamily: '"El Messiri", "Cairo", sans-serif',
                fontSize: 16,
                color: cream,
                opacity: 0.7,
                marginTop: 8,
                letterSpacing: "0.04em",
              }}
            >
              {welcomeSub}
            </p>
          ) : null}

          {blogger?.name ? (
            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 22px",
                  borderRadius: 999,
                  background: `${cream}1a`,
                  border: `1px solid ${cream}40`,
                  fontFamily: '"El Messiri", "Cairo", sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  color: cream,
                  letterSpacing: "0.04em",
                }}
              >
                <Sparkles className="w-4 h-4" style={{ opacity: 0.85 }} />
                <span>{blogger.name}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Menu card */}
        <div
          style={{
            borderRadius: 24,
            background: `${cream}0e`,
            border: `1px solid ${cream}26`,
            backdropFilter: "blur(8px)",
            padding: "28px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                flex: 1,
                maxWidth: 60,
                height: 1,
                background: `${cream}40`,
              }}
            />
            <Coffee className="w-4 h-4" style={{ color: cream, opacity: 0.8 }} />
            <div
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.4em",
                color: cream,
                opacity: 0.85,
                textTransform: "uppercase",
              }}
            >
              Menu
            </div>
            <Coffee className="w-4 h-4" style={{ color: cream, opacity: 0.8 }} />
            <span
              style={{
                flex: 1,
                maxWidth: 60,
                height: 1,
                background: `${cream}40`,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: '"El Messiri", sans-serif',
              fontSize: 14,
              color: cream,
              opacity: 0.65,
              textAlign: "center",
              marginBottom: 24,
              letterSpacing: "0.04em",
            }}
          >
            قائمة ضيافتك
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div
              style={{
                fontFamily: '"El Messiri", sans-serif',
                fontSize: 14,
                color: cream,
                opacity: 0.55,
                textAlign: "center",
                padding: "28px 0",
              }}
            >
              المنيو غير متاح بعد. تواصل مع الكاشير.
            </div>
          ) : (
            <MenuList grouped={grouped} cream={cream} title="" />
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 11,
            letterSpacing: "0.32em",
            color: cream,
            opacity: 0.5,
            textTransform: "uppercase",
          }}
        >
          {cafeName} · Private Invitation
        </div>
      </div>
    </FullscreenWrapper>
  );
}

/**
 * Renders the grouped hospitality menu. Shared between the active
 * welcome screen and the pre-activation preview (where `preview=true`
 * adds a subtle "still pending" notice).
 */
function MenuList({ grouped, cream, title, preview = false }) {
  return (
    <>
      {title ? (
        <div
          style={{
            fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.5em",
            color: cream,
            opacity: 0.85,
            textAlign: "center",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
      ) : null}
      {preview ? (
        <div
          style={{
            fontFamily: '"El Messiri", sans-serif',
            fontSize: 12,
            color: cream,
            opacity: 0.55,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          ستتاح الضيافة بعد تفعيل الكود من الكاشير.
        </div>
      ) : (
        <div style={{ marginBottom: 14 }} />
      )}
      <div className="space-y-7">
        {Object.entries(grouped).map(([category, list]) => (
          <div key={category}>
            <h3
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.32em",
                color: cream,
                opacity: 0.85,
                marginBottom: 12,
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {category}
            </h3>
            <div className="space-y-2">
              {list.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: `${cream}08`,
                    borderBottom: `1px solid ${cream}1a`,
                    opacity: preview ? 0.85 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: '"El Messiri", sans-serif',
                        fontSize: 16,
                        fontWeight: 700,
                        color: cream,
                      }}
                    >
                      {it.name_ar}
                    </div>
                    {it.name_en ? (
                      <div
                        style={{
                          fontFamily: '"Cormorant Garamond", serif',
                          fontSize: 12,
                          color: cream,
                          opacity: 0.55,
                          letterSpacing: "0.06em",
                          marginTop: 2,
                        }}
                      >
                        {it.name_en}
                      </div>
                    ) : null}
                    {it.description ? (
                      <div
                        style={{
                          fontFamily: '"El Messiri", sans-serif',
                          fontSize: 12,
                          color: cream,
                          opacity: 0.6,
                          marginTop: 6,
                          lineHeight: 1.7,
                        }}
                      >
                        {it.description}
                      </div>
                    ) : null}
                  </div>
                  {it.price !== null && it.price !== undefined ? (
                    <div
                      style={{
                        fontFamily: '"Cormorant Garamond", serif',
                        fontSize: 16,
                        fontWeight: 700,
                        color: cream,
                        whiteSpace: "nowrap",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {Number(it.price).toFixed(2)} ر.س
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FullscreenWrapper({ accent, cream, children }) {
  return (
    <>
      {/* Brand fonts. Loaded once per render of the welcome page. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Playfair+Display:wght@600;700;900&family=El+Messiri:wght@500;600;700&display=swap"
      />
      <div
        dir="rtl"
        className="min-h-[100svh] flex items-center justify-center p-4 sm:p-8"
        style={{
          background: accent,
          color: cream,
        }}
      >
        {/* Soft paper grain via radial highlights — keeps the solid
            olive from feeling flat, without competing with the brand. */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at 30% 0%, ${cream}14 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, ${cream}0d 0%, transparent 60%)`,
          }}
        />
        <div style={{ position: "relative", width: "100%" }}>{children}</div>
      </div>
    </>
  );
}

function BrandWordmark({ cream, cafeName, cafeNameAr, cafeTagline, size = "lg" }) {
  const sizeMap = {
    sm: { en: 32, ar: 18, tag: 9 },
    md: { en: 44, ar: 22, tag: 11 },
    lg: { en: 56, ar: 28, tag: 13 },
  };
  const s = sizeMap[size] || sizeMap.lg;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "inline-block", position: "relative" }}>
        <div
          style={{
            fontFamily:
              '"Cormorant Garamond", "Playfair Display", serif',
            fontWeight: 700,
            fontSize: s.en,
            letterSpacing: "0.02em",
            lineHeight: 1,
            color: cream,
          }}
        >
          {cafeName}
        </div>
        {cafeTagline ? (
          <div
            style={{
              position: "absolute",
              top: -2,
              right: -Math.round(s.en * 0.5),
              fontFamily:
                '"Cormorant Garamond", "Playfair Display", serif',
              fontSize: s.tag,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: cream,
            }}
          >
            {cafeTagline}
          </div>
        ) : null}
      </div>
      {cafeNameAr ? (
        <div
          style={{
            fontFamily: '"El Messiri", "Cairo", "Tahoma", sans-serif',
            fontSize: s.ar,
            fontWeight: 600,
            color: cream,
            marginTop: 4,
            letterSpacing: "0.04em",
          }}
        >
          {cafeNameAr}
        </div>
      ) : null}
    </div>
  );
}
