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
            {/* Print-friendly card. White bg + dark text so it prints cleanly. */}
            <div
              className="print-card"
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#ffffff",
                borderRadius: 24,
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                padding: 28,
                color: "#0f172a",
                textAlign: "center",
                fontFamily: '"Segoe UI", Tahoma, sans-serif',
              }}
            >
              {/* Logo */}
              <div
                style={{
                  width: 88,
                  height: 88,
                  margin: "0 auto 20px",
                  borderRadius: 24,
                  background: `linear-gradient(135deg, ${accent}, #0b0b1a)`,
                  color: "#fff",
                  fontSize: 44,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  letterSpacing: "-0.02em",
                }}
              >
                {logoLetter}
              </div>

              <div style={{ fontSize: 18, color: "#475569", marginBottom: 4 }}>
                {cafeName}
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
                دعوة خاصة
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 6,
                  lineHeight: 1.3,
                }}
              >
                {b.name}
              </div>
              {b.handle ? (
                <div style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
                  @{b.handle}
                </div>
              ) : (
                <div style={{ height: 20 }} />
              )}

              {/* QR */}
              <div
                style={{
                  display: "inline-block",
                  padding: 18,
                  background: "#f8fafc",
                  borderRadius: 20,
                  border: `2px solid ${accent}`,
                  marginBottom: 20,
                }}
              >
                <QRCodeSVG
                  value={welcomeURL}
                  size={220}
                  level="M"
                  bgColor="#f8fafc"
                  fgColor="#0f172a"
                  includeMargin={false}
                />
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 16,
                  color: "#0f172a",
                  letterSpacing: "0.1em",
                  background: "#f1f5f9",
                  padding: "10px 14px",
                  borderRadius: 12,
                  marginBottom: 16,
                  direction: "ltr",
                }}
              >
                {b.slug}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.7,
                  marginTop: 14,
                }}
              >
                امسح الكود واطلب من الكاشير تفعيله.
                <br />
                بعد التفعيل تظهر لك ضيافتك.
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 16,
                  borderTop: "1px dashed #cbd5e1",
                  fontSize: 11,
                  color: "#94a3b8",
                  direction: "ltr",
                  wordBreak: "break-all",
                }}
              >
                {welcomeURL}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
