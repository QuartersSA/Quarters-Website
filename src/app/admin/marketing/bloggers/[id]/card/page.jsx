"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Printer, ArrowRight, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Sidebar } from "@/components/Admin/Sidebar";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";

export default function BloggerCardPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const params = useParams();
  const bloggerId = Number(params?.id);

  const bloggerQuery = useQuery({
    queryKey: ["marketing-blogger", bloggerId],
    enabled: isAuthenticated && Number.isFinite(bloggerId),
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/bloggers");
      if (!r.ok) throw new Error("فشل التحميل");
      const data = await r.json();
      const b = (data.bloggers || []).find((x) => Number(x.id) === bloggerId);
      if (!b) throw new Error("غير موجود");
      return b;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["marketing-settings"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/settings");
      if (!r.ok) throw new Error("فشل التحميل");
      return r.json();
    },
  });

  const welcomeURL = useMemo(() => {
    const slug = bloggerQuery.data?.slug;
    if (!slug) return "";
    if (typeof window === "undefined") return `/welcome/${slug}`;
    return `${window.location.origin}/welcome/${slug}`;
  }, [bloggerQuery.data]);

  if (!isAuthenticated) return null;

  const b = bloggerQuery.data;
  const settings = settingsQuery.data?.settings;
  const accent = settings?.accent_color || "#7a8b5f";
  const cream = settings?.cream_color || "#e8e9d6";
  const cafeName = settings?.cafe_name || "QUARTERS";
  const cafeNameAr = settings?.cafe_name_ar || "كوارتـــرز";
  const cafeTagline = settings?.cafe_tagline || "BAR";

  return (
    <div className="min-h-[100svh]" dir="rtl">
      {/* Brand fonts + print-only rules. Playfair Display = English
          serif wordmark; El Messiri = refined Arabic naskh that pairs
          with the brand's stretched lettering. Loaded once for the
          whole card view. */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=El+Messiri:wght@500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap"
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print">
        <Sidebar activePage="marketing-bloggers" onLogout={logout} />
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="no-print mb-6 flex items-center justify-between gap-3 flex-wrap">
          <a
            href="/admin/marketing/bloggers"
            className={`${ws.btnNeutral} px-4 py-2 justify-center`}
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href={welcomeURL}
              target="_blank"
              rel="noreferrer"
              className={`${ws.btnNeutral} px-4 py-2 justify-center`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>فتح الرابط</span>
            </a>
            <button
              onClick={() => window.print()}
              className={`${ws.btnPrimary} px-4 py-2 justify-center`}
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {bloggerQuery.isLoading ? (
          <div className={`${ws.glass} ${ws.card} p-8 text-center text-white/55`}>
            جاري التحميل…
          </div>
        ) : !b ? (
          <div className={`${ws.glass} ${ws.card} p-8 text-center text-red-200`}>
            لم يُعثر على البلوقر.
          </div>
        ) : (
          <div className="flex justify-center">
            {/* Brand-led invitation card. Solid olive ground, cream
                serif wordmark, minimal ornaments. Mirrors the official
                Quarters Bar identity rather than competing with it.
                Prints cleanly on A6 / 5x7. */}
            <div
              className="print-card"
              style={{
                width: "100%",
                maxWidth: 460,
                position: "relative",
                borderRadius: 26,
                background: accent,
                color: cream,
                padding: "56px 38px 44px",
                textAlign: "center",
                boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px ${cream}22`,
                fontFamily:
                  '"Cormorant Garamond", "Playfair Display", "Times New Roman", serif',
                overflow: "hidden",
              }}
            >
              {/* Double inner border — outer hairline + inner ornamental */}
              <div
                style={{
                  position: "absolute",
                  inset: 12,
                  borderRadius: 20,
                  border: `1px solid ${cream}22`,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 18,
                  borderRadius: 16,
                  border: `1px solid ${cream}11`,
                  pointerEvents: "none",
                }}
              />

              {/* Paper texture wash */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(ellipse at top, ${cream}12 0%, transparent 55%), radial-gradient(ellipse at bottom, ${cream}08 0%, transparent 60%)`,
                  pointerEvents: "none",
                }}
              />

              {/* Decorative corner ornaments — small leaf flourishes */}
              <Leaf corner="tl" cream={cream} />
              <Leaf corner="tr" cream={cream} />
              <Leaf corner="bl" cream={cream} />
              <Leaf corner="br" cream={cream} />

              {/* === Wordmark === */}
              <div style={{ position: "relative", marginBottom: 30 }}>
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                  }}
                >
                  <div
                    style={{
                      fontFamily:
                        '"Cormorant Garamond", "Playfair Display", serif',
                      fontWeight: 700,
                      fontSize: 58,
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
                        top: 0,
                        right: -22,
                        fontFamily:
                          '"Cormorant Garamond", "Playfair Display", serif',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.12em",
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
                      fontFamily:
                        '"El Messiri", "Cairo", "Tahoma", sans-serif',
                      fontSize: 30,
                      fontWeight: 600,
                      color: cream,
                      marginTop: 6,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {cafeNameAr}
                  </div>
                ) : null}
              </div>

              {/* Ornamental divider — hairline + diamond + hairline */}
              <Flourish cream={cream} marginBottom={22} />

              {/* "INVITATION" label — bilingual */}
              <div
                style={{
                  fontFamily:
                    '"Cormorant Garamond", "Playfair Display", serif',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.55em",
                  color: cream,
                  opacity: 0.85,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Private Invitation
              </div>
              <div
                style={{
                  fontFamily:
                    '"El Messiri", "Cairo", "Tahoma", sans-serif',
                  fontSize: 12,
                  color: cream,
                  opacity: 0.6,
                  marginBottom: 24,
                  letterSpacing: "0.1em",
                }}
              >
                دعوة خاصة
              </div>

              {/* === Blogger name with ornamental side marks === */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  marginBottom: b.handle ? 2 : 26,
                }}
              >
                <SideMark cream={cream} side="left" />
                <div
                  style={{
                    fontFamily:
                      '"El Messiri", "Cairo", "Tahoma", sans-serif',
                    fontSize: 30,
                    fontWeight: 700,
                    color: cream,
                    lineHeight: 1.3,
                    letterSpacing: "0.01em",
                  }}
                >
                  {b.name}
                </div>
                <SideMark cream={cream} side="right" />
              </div>
              {b.handle ? (
                <div
                  style={{
                    color: cream,
                    opacity: 0.6,
                    fontSize: 13,
                    marginBottom: 26,
                    direction: "ltr",
                    letterSpacing: "0.05em",
                    fontStyle: "italic",
                  }}
                >
                  @{b.handle}
                </div>
              ) : null}

              {/* === QR — cream tile with embossed inner ring === */}
              <div
                style={{
                  display: "inline-block",
                  position: "relative",
                  padding: 18,
                  background: cream,
                  borderRadius: 18,
                  marginBottom: 24,
                  boxShadow: `0 10px 28px rgba(0,0,0,0.22), inset 0 0 0 1px ${darkenForQR(accent)}1a`,
                }}
              >
                <QRCodeSVG
                  value={welcomeURL}
                  size={196}
                  level="M"
                  bgColor={cream}
                  fgColor={darkenForQR(accent)}
                  includeMargin={false}
                />
              </div>

              {/* Slug — bracketed serif treatment */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  marginBottom: 28,
                  direction: "ltr",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      '"Cormorant Garamond", "Playfair Display", serif',
                    fontSize: 22,
                    color: cream,
                    opacity: 0.5,
                    fontWeight: 400,
                  }}
                >
                  ⟨
                </span>
                <span
                  style={{
                    fontFamily:
                      '"Cormorant Garamond", "Playfair Display", serif',
                    fontSize: 17,
                    fontWeight: 600,
                    color: cream,
                    letterSpacing: "0.32em",
                  }}
                >
                  {b.slug}
                </span>
                <span
                  style={{
                    fontFamily:
                      '"Cormorant Garamond", "Playfair Display", serif',
                    fontSize: 22,
                    color: cream,
                    opacity: 0.5,
                    fontWeight: 400,
                  }}
                >
                  ⟩
                </span>
              </div>

              {/* Hairline */}
              <div
                style={{
                  width: 56,
                  height: 1,
                  background: `${cream}40`,
                  margin: "0 auto 18px",
                }}
              />

              {/* Instructions */}
              <div
                style={{
                  fontFamily:
                    '"El Messiri", "Cairo", "Tahoma", sans-serif',
                  fontSize: 13,
                  color: cream,
                  opacity: 0.82,
                  lineHeight: 1.9,
                  letterSpacing: "0.02em",
                }}
              >
                امسح الكود وسلّمه للكاشير لتفعيل بطاقتك
              </div>
              <div
                style={{
                  fontFamily:
                    '"El Messiri", "Cairo", "Tahoma", sans-serif',
                  fontSize: 12,
                  color: cream,
                  opacity: 0.55,
                  lineHeight: 1.9,
                  letterSpacing: "0.02em",
                }}
              >
                بعد التفعيل تظهر لك قائمة الضيافة
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Tiny leaf / coffee-bean ornament placed in each corner of the
 * card. Pure inline SVG — no dependency, no asset.
 */
function Leaf({ corner, cream }) {
  const positions = {
    tl: { top: 18, left: 18, rotate: 0 },
    tr: { top: 18, right: 18, rotate: 90 },
    br: { bottom: 18, right: 18, rotate: 180 },
    bl: { bottom: 18, left: 18, rotate: 270 },
  };
  const pos = positions[corner];
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        ...pos,
        width: 26,
        height: 26,
        transform: `rotate(${pos.rotate}deg)`,
        opacity: 0.55,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
        <path
          d="M3 21 C 8 16, 12 12, 21 3 M21 3 C 14 4, 9 7, 6 11 M21 3 C 17 9, 14 13, 11 18"
          stroke={cream}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Hairline → diamond → hairline ornament. Used as section divider
 * after the wordmark.
 */
function Flourish({ cream, marginBottom = 20 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginBottom,
      }}
    >
      <span
        style={{
          width: 56,
          height: 1,
          background: `linear-gradient(to right, transparent, ${cream}66)`,
        }}
      />
      <span
        style={{
          width: 5,
          height: 5,
          transform: "rotate(45deg)",
          background: cream,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          width: 8,
          height: 1,
          background: `${cream}88`,
        }}
      />
      <span
        style={{
          width: 5,
          height: 5,
          transform: "rotate(45deg)",
          background: cream,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          width: 56,
          height: 1,
          background: `linear-gradient(to left, transparent, ${cream}66)`,
        }}
      />
    </div>
  );
}

/**
 * Small side mark — sits left/right of the blogger name. Two tiny
 * dots stacked vertically + short line, all in cream.
 */
function SideMark({ cream, side }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        opacity: 0.6,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: cream,
        }}
      />
      <span
        style={{
          width: 1,
          height: 14,
          background: cream,
        }}
      />
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: cream,
        }}
      />
    </div>
  );
}

/**
 * Drop the brand accent ~50% darker for QR foreground so it stays
 * scannable on the cream backdrop without losing the brand feel.
 * Cheap luminance shift via HSL conversion — no extra dependencies.
 */
function darkenForQR(hex) {
  try {
    const m = String(hex).replace("#", "");
    const r = parseInt(m.length === 3 ? m[0] + m[0] : m.slice(0, 2), 16);
    const g = parseInt(m.length === 3 ? m[1] + m[1] : m.slice(2, 4), 16);
    const b = parseInt(m.length === 3 ? m[2] + m[2] : m.slice(4, 6), 16);
    // 35% of original brightness keeps hue, boosts contrast.
    const f = 0.35;
    const toHex = (n) =>
      Math.max(0, Math.min(255, Math.round(n * f)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return "#1c1917";
  }
}
