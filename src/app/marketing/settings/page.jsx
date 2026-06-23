"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Palette, Coffee } from "lucide-react";
import MarketingSidebar from "@/components/Marketing/Sidebar";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../../../utils/queryKeys.js";

export default function MarketingSettingsPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_marketing",
  });
  const queryClient = useQueryClient();

  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.marketingSettings(),
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/settings");
      if (!r.ok) throw new Error("فشل تحميل الإعدادات");
      return r.json();
    },
  });

  useEffect(() => {
    if (settingsQuery.data?.settings && !form) {
      setForm(settingsQuery.data.settings);
    }
  }, [settingsQuery.data, form]);

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      const r = await adminFetch("/api/marketing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الحفظ");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketingSettings() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(e.message || "خطأ"),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form) return;
    saveMut.mutate({
      cafe_name: form.cafe_name,
      cafe_name_ar: form.cafe_name_ar,
      cafe_tagline: form.cafe_tagline,
      logo_letter: form.logo_letter,
      accent_color: form.accent_color,
      cream_color: form.cream_color,
      welcome_headline: form.welcome_headline,
      welcome_subtext: form.welcome_subtext,
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <MarketingSidebar active="settings" onLogout={logout} />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className={`${ws.glass} ${ws.card} p-5 sm:p-6 mb-6`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-12 h-12 text-sky-700 dark:text-sky-200`}>
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">إعدادات التسويق</h1>
              <p className="text-slate-600 dark:text-white/55 text-sm mt-1">
                الإعدادات تنطبق على بطاقات الدعوة + شاشة الترحيب.
              </p>
            </div>
          </div>
        </div>

        {settingsQuery.isLoading || !form ? (
          <div className={`${ws.glass} ${ws.card} p-8 text-center text-slate-600 dark:text-white/55`}>
            جاري التحميل…
          </div>
        ) : (
          <form onSubmit={submit} className={`${ws.glass} ${ws.card} p-5 sm:p-6 space-y-5`}>
            {error ? (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm">
                {error}
              </div>
            ) : null}
            {saved ? (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-200 text-sm">
                ✓ تم الحفظ
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  اسم الكوفي (إنجليزي)
                </label>
                <input
                  type="text"
                  value={form.cafe_name || ""}
                  onChange={(e) =>
                    setForm({ ...form, cafe_name: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  اسم الكوفي (عربي)
                </label>
                <input
                  type="text"
                  value={form.cafe_name_ar || ""}
                  onChange={(e) =>
                    setForm({ ...form, cafe_name_ar: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="كوارتـــرز"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  الـ Tagline (مثل BAR)
                </label>
                <input
                  type="text"
                  value={form.cafe_tagline || ""}
                  onChange={(e) =>
                    setForm({ ...form, cafe_tagline: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="BAR"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  حرف الشعار (للأماكن المختصرة)
                </label>
                <input
                  type="text"
                  value={form.logo_letter || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logo_letter: e.target.value.slice(0, 4),
                    })
                  }
                  className={`${ws.input} px-4 py-3 text-center text-2xl font-bold`}
                  maxLength={4}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> اللون الأساسي (Olive)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.accent_color || "#7a8b5f"}
                    onChange={(e) =>
                      setForm({ ...form, accent_color: e.target.value })
                    }
                    className="h-12 w-16 rounded-2xl border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.accent_color || ""}
                    onChange={(e) =>
                      setForm({ ...form, accent_color: e.target.value })
                    }
                    className={`${ws.input} px-4 py-3 flex-1`}
                    placeholder="#7a8b5f"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> لون النص (Cream)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.cream_color || "#e8e9d6"}
                    onChange={(e) =>
                      setForm({ ...form, cream_color: e.target.value })
                    }
                    className="h-12 w-16 rounded-2xl border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.cream_color || ""}
                    onChange={(e) =>
                      setForm({ ...form, cream_color: e.target.value })
                    }
                    className={`${ws.input} px-4 py-3 flex-1`}
                    placeholder="#e8e9d6"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  معاينة الـ Wordmark
                </label>
                <div
                  className="rounded-2xl flex items-center justify-center p-8"
                  style={{
                    background: form.accent_color || "#7a8b5f",
                    color: form.cream_color || "#e8e9d6",
                    minHeight: "120px",
                  }}
                >
                  <div style={{ position: "relative", display: "inline-block", textAlign: "center" }}>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontSize: 44,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}>
                      {form.cafe_name || "QUARTERS"}
                    </span>
                    {form.cafe_tagline ? (
                      <span style={{
                        position: "absolute",
                        top: -2,
                        right: -24,
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                      }}>
                        {form.cafe_tagline}
                      </span>
                    ) : null}
                    {form.cafe_name_ar ? (
                      <div style={{
                        fontFamily: "'El Messiri', 'Cairo', sans-serif",
                        fontSize: 22,
                        fontWeight: 600,
                        marginTop: 4,
                      }}>
                        {form.cafe_name_ar}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  عنوان الترحيب
                </label>
                <input
                  type="text"
                  value={form.welcome_headline || ""}
                  onChange={(e) =>
                    setForm({ ...form, welcome_headline: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مرحباً بك في Quarters"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  نص الترحيب الفرعي
                </label>
                <input
                  type="text"
                  value={form.welcome_subtext || ""}
                  onChange={(e) =>
                    setForm({ ...form, welcome_subtext: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3`}
                  placeholder="استمتع بتجربتك معنا"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saveMut.isPending}
                className={`${ws.btnPrimary} px-6 py-3 justify-center disabled:opacity-50`}
              >
                <Save className="w-5 h-5" />
                <span>{saveMut.isPending ? "جاري الحفظ…" : "حفظ"}</span>
              </button>
              <a
                href="/welcome/preview"
                target="_blank"
                rel="noreferrer"
                className={`${ws.btnNeutral} px-4 py-3 justify-center`}
              >
                <Coffee className="w-5 h-5" />
                <span>معاينة شاشة البلوقر</span>
              </a>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
