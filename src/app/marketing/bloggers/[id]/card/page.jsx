"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Printer, ArrowRight, ExternalLink } from "lucide-react";
import MarketingSidebar from "@/components/Marketing/Sidebar";
import { BloggerInvitationCard } from "@/components/Marketing/BloggerInvitationCard";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";

export default function BloggerCardPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_marketing",
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

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
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
        <MarketingSidebar active="bloggers" onLogout={logout} />
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="no-print mb-6 flex items-center justify-between gap-3 flex-wrap">
          <a
            href="/marketing/bloggers"
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
            <BloggerInvitationCard
              blogger={b}
              settings={settings}
              welcomeURL={welcomeURL}
            />
          </div>
        )}
      </main>
    </div>
  );
}
