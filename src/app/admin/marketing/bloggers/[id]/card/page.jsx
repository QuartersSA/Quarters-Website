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
  const accent = settings?.accent_color || "#10b981";
  const logoLetter = settings?.logo_letter || "Q";
  const cafeName = settings?.cafe_name || "Quarters Coffee Bar";

  return (
    <div className="min-h-[100svh]" dir="rtl">
      {/* Hide sidebar + UI chrome when printing. */}
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
            {/* Premium invitation card. Layered design — gradient base,
                ornate frame, foiled accent band, branded crest, ribbon
                tag. Prints cleanly on A6 / 5x7. */}
            <div
              className="print-card"
              style={{
                width: "100%",
                maxWidth: 460,
                position: "relative",
                borderRadius: 28,
                padding: 4,
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}66 35%, #d4af37 70%, ${accent}88 100%)`,
                boxShadow: `0 30px 80px ${accent}55, 0 0 0 1px rgba(255,255,255,0.06)`,
                fontFamily: '"Segoe UI", "Tahoma", "Arial", sans-serif',
              }}
            >
              {/* Inner cream card */}
              <div
                style={{
                  position: "relative",
                  borderRadius: 24,
                  background:
                    "radial-gradient(ellipse at top, #fefcf7 0%, #f9f5ea 100%)",
                  padding: "44px 32px 36px",
                  textAlign: "center",
                  overflow: "hidden",
                  color: "#1c1917",
                }}
              >
                {/* Decorative corner ornaments */}
                <CornerOrnament position="top-left" color={accent} />
                <CornerOrnament position="top-right" color={accent} />
                <CornerOrnament position="bottom-left" color={accent} />
                <CornerOrnament position="bottom-right" color={accent} />

                {/* Top accent band — cafe name with hairline rules */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    marginBottom: 26,
                  }}
                >
                  <HairLine color={accent} />
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.32em",
                      color: accent,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cafeName}
                  </div>
                  <HairLine color={accent} />
                </div>

                {/* Crest / logo monogram */}
                <div
                  style={{
                    position: "relative",
                    width: 96,
                    height: 96,
                    margin: "0 auto 24px",
                  }}
                >
                  {/* Outer ring */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: `conic-gradient(from 0deg, ${accent}, #d4af37, ${accent})`,
                      padding: 3,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: "#fefcf7",
                      }}
                    />
                  </div>
                  {/* Letter */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 8,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${accent}, #1c1917)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 42,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                      boxShadow: `inset 0 -8px 16px ${accent}88`,
                    }}
                  >
                    {logoLetter}
                  </div>
                </div>

                {/* "INVITATION" label */}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.4em",
                    color: "#92400e",
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}
                >
                  دعوة خاصة · invitation
                </div>

                {/* Decorative diamond divider */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    margin: "8px 0 14px",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 1,
                      background: `linear-gradient(to right, transparent, ${accent})`,
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      transform: "rotate(45deg)",
                      background: accent,
                    }}
                  />
                  <span
                    style={{
                      width: 28,
                      height: 1,
                      background: `linear-gradient(to left, transparent, ${accent})`,
                    }}
                  />
                </div>

                {/* Blogger name */}
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#1c1917",
                    marginBottom: b.handle ? 4 : 22,
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {b.name}
                </div>
                {b.handle ? (
                  <div
                    style={{
                      color: "#78716c",
                      fontSize: 13,
                      marginBottom: 22,
                      direction: "ltr",
                    }}
                  >
                    @{b.handle}
                  </div>
                ) : null}

                {/* QR — wrapped in elegant double-border frame */}
                <div
                  style={{
                    display: "inline-block",
                    position: "relative",
                    padding: 4,
                    background: `linear-gradient(135deg, ${accent}, #d4af37)`,
                    borderRadius: 22,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      background: "#fff",
                      borderRadius: 18,
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <QRCodeSVG
                      value={welcomeURL}
                      size={210}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#1c1917"
                      includeMargin={false}
                    />
                  </div>
                </div>

                {/* Slug ribbon */}
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: '"Courier New", monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#1c1917",
                    letterSpacing: "0.16em",
                    background: "#fff",
                    padding: "8px 22px",
                    borderRadius: 999,
                    direction: "ltr",
                    border: `1.5px solid ${accent}`,
                    boxShadow: `0 4px 14px ${accent}33`,
                    marginBottom: 22,
                  }}
                >
                  {b.slug}
                </div>

                {/* Instructions */}
                <div
                  style={{
                    fontSize: 13,
                    color: "#57534e",
                    lineHeight: 1.8,
                    marginBottom: 6,
                  }}
                >
                  امسح الكود وسلّمه للكاشير لتفعيل بطاقتك.
                  <br />
                  بعد التفعيل تظهر لك قائمة الضيافة.
                </div>

                {/* Bottom flourish */}
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: `1px solid ${accent}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: accent,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: "#a8a29e",
                      letterSpacing: "0.2em",
                      direction: "ltr",
                      wordBreak: "break-all",
                    }}
                  >
                    {welcomeURL.replace(/^https?:\/\//, "")}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: accent,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function HairLine({ color }) {
  return (
    <span
      style={{
        flex: 1,
        height: 1,
        maxWidth: 60,
        background: `linear-gradient(to right, transparent, ${color}66, transparent)`,
      }}
    />
  );
}

function CornerOrnament({ position, color }) {
  // Tiny L-shaped corner brackets — engraved-card feel.
  const styleByPos = {
    "top-left": { top: 14, left: 14 },
    "top-right": { top: 14, right: 14 },
    "bottom-left": { bottom: 14, left: 14 },
    "bottom-right": { bottom: 14, right: 14 },
  };
  // Rotate L based on corner so the open side faces inward.
  const rotation = {
    "top-left": 0,
    "top-right": 90,
    "bottom-right": 180,
    "bottom-left": 270,
  }[position];

  return (
    <div
      style={{
        position: "absolute",
        ...styleByPos[position],
        width: 24,
        height: 24,
        transform: `rotate(${rotation}deg)`,
        pointerEvents: "none",
        opacity: 0.85,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 14,
          height: 2,
          background: color,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 2,
          height: 14,
          background: color,
          borderRadius: 2,
        }}
      />
    </div>
  );
}
