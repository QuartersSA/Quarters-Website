"use client";

import React, { useMemo, useEffect, useState, useCallback } from "react";
import {
  Shield,
  ClipboardList,
  ArrowLeft,
  Calculator,
  Languages,
  Trash2,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const BRAND = {
  name: "QuartersSA",
  logoUrl:
    "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/",
};

export default function HomePage() {
  const LANG_KEY = "appLang";
  const [lang, setLang] = useState("ar"); // ar | en

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "ar" || stored === "en") {
        setLang(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";

  const t = useCallback(
    (key) => {
      const dict = {
        ar: {
          heading: "أنظمة Quarters",
          subheading: "اختر نوع الدخول للمتابعة.",
          adminTitle: "تسجيل دخول الإدارة",
          adminDesc: "لوحة التحكم: الفروع، الأصناف، الموظفين، وعمليات الجرد.",
          adminBtn: "دخول الإدارة",
          invTitle: "تسجيل دخول الجرد",
          invDesc: "للموظفين: بدء الجرد وإدخال الكميات حسب الفرع.",
          invBtn: "دخول الجرد",
          shiftTitle: "تسجيل دخول تقفيلة الشفت",
          shiftDesc:
            "للكاشير: رفع تقرير الكاش والشبكة (الفعلي وفودكس) وحساب العجز/الزيادة.",
          shiftBtn: "دخول تقفيلة الشفت",
          wasteTitle: "تسجيل دخول الهدر",
          wasteDesc: "للموظفين: تسجيل هدر المخبوزات والحلويات حسب الفرع.",
          wasteBtn: "دخول الهدر",
          hint: "إذا كنت موظف وتحتاج تغيير اللغة أو اختيار الفرع، بتظهر لك الخيارات بعد تسجيل الدخول.",
          language: "اللغة",
          arabic: "عربي",
          english: "English",
        },
        en: {
          heading: "Quarters Systems",
          subheading: "Choose a login type to continue.",
          adminTitle: "Admin Login",
          adminDesc:
            "Control panel: branches, items, employees, and inventory operations.",
          adminBtn: "Enter Admin",
          invTitle: "Inventory Login",
          invDesc:
            "For employees: start inventory and enter quantities by branch.",
          invBtn: "Enter Inventory",
          shiftTitle: "Shift Close Login",
          shiftDesc:
            "For cashiers: submit cash/card report (actual vs Foodics) and calculate variance.",
          shiftBtn: "Enter Shift Close",
          wasteTitle: "Waste Logging Login",
          wasteDesc: "For employees: log bakery & sweets waste by branch.",
          wasteBtn: "Enter Waste",
          hint: "If you're an employee and need to change language or branch, you'll see those options after login.",
          language: "Language",
          arabic: "Arabic",
          english: "English",
        },
      };

      const table = dict[lang] || dict.ar;
      return table[key] || key;
    },
    [lang],
  );

  const onChangeLang = useCallback((next) => {
    const normalized = next === "en" ? "en" : "ar";
    setLang(normalized);
    try {
      localStorage.setItem(LANG_KEY, normalized);
    } catch {
      // ignore
    }
  }, []);

  const cards = useMemo(() => {
    return [
      {
        title: t("adminTitle"),
        description: t("adminDesc"),
        href: "/admin/login",
        icon: Shield,
        accent: "text-emerald-200",
        buttonLabel: t("adminBtn"),
      },
      {
        title: t("invTitle"),
        description: t("invDesc"),
        href: "/employee/login",
        icon: ClipboardList,
        accent: "text-sky-200",
        buttonLabel: t("invBtn"),
      },
      {
        title: t("shiftTitle"),
        description: t("shiftDesc"),
        href: "/shift-close/login",
        icon: Calculator,
        accent: "text-fuchsia-200",
        buttonLabel: t("shiftBtn"),
      },
      {
        title: t("wasteTitle"),
        description: t("wasteDesc"),
        href: "/waste/login",
        icon: Trash2,
        accent: "text-amber-200",
        buttonLabel: t("wasteBtn"),
      },
    ];
  }, [t]);

  const arrowIcon =
    dir === "rtl" ? (
      <ArrowLeft className="w-4 h-4" />
    ) : (
      <ArrowLeft className="w-4 h-4 rotate-180" />
    );

  return (
    <div
      className={`dark min-h-[100svh] flex items-center justify-center px-4 py-10 ${ws.appBg}`}
      dir={dir}
    >
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-end">
          <div
            className={`${ws.glassSoft} ${ws.card} px-3 py-2 inline-flex items-center gap-2`}
          >
            <Languages className="w-4 h-4 text-slate-600 dark:text-white/70" />
            <div className="text-xs text-white/60">{t("language")}</div>

            <div className={ws.segWrap}>
              <button
                type="button"
                onClick={() => onChangeLang("ar")}
                className={`${ws.segBtn} ${lang === "ar" ? ws.segActive : ws.segInactive}`}
              >
                {t("arabic")}
              </button>
              <button
                type="button"
                onClick={() => onChangeLang("en")}
                className={`${ws.segBtn} ${lang === "en" ? ws.segActive : ws.segInactive}`}
              >
                {t("english")}
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <div className="mx-auto inline-flex items-center justify-center rounded-[28px] bg-white p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              className="h-20 sm:h-24 md:h-28 w-auto"
              loading="eager"
            />
          </div>

          <h1 className="mt-6 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {t("heading")}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-white/60 max-w-2xl mx-auto">
            {t("subheading")}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cards.map((c) => {
            const Icon = c.icon;
            const iconClassName = `${ws.iconBox} ${c.accent}`;
            const buttonClassName = `${ws.btnPrimary} px-5 py-3 justify-center w-full`;

            return (
              <a
                key={c.href}
                href={c.href}
                className={`${ws.glass} ${ws.card} p-6 sm:p-7 border border-white/10 hover:border-white/20 transition-colors block`}
              >
                <div className="flex items-start gap-4">
                  <div className={iconClassName}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-lg sm:text-xl font-bold text-white">
                      {c.title}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {c.description}
                    </div>

                    <div className="mt-5">
                      <div className={buttonClassName}>
                        <span className="font-semibold">{c.buttonLabel}</span>
                        {arrowIcon}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-8 text-center text-xs text-white/45">
          {t("hint")}
        </div>
      </div>
    </div>
  );
}
