"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Calculator,
  Lock,
  User,
  ArrowLeft,
  Building2,
  Send,
  LogOut,
  Info,
  Languages,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import {
  SHIFT_CLOSE_TOKEN_KEY,
  shiftCloseFetch,
  clearAdminSession,
} from "@/utils/apiAuth";

function safeMoneyNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function formatMoney(value, lang) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const locale = lang === "en" ? "en-US" : "ar-SA-u-ca-gregory-nu-latn";
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function diffLabel(value, lang) {
  const n = Number(value);
  const isZero = !Number.isFinite(n) || n === 0;
  if (lang === "en") {
    if (isZero) return { label: "Match", tone: "neutral" };
    if (n < 0) return { label: "Short", tone: "bad" };
    return { label: "Over", tone: "good" };
  }

  if (isZero) return { label: "متطابق", tone: "neutral" };
  if (n < 0) return { label: "عجز", tone: "bad" };
  return { label: "زيادة", tone: "good" };
}

function pillClassForTone(tone) {
  if (tone === "good") {
    return `${ws.pill} bg-emerald-400/15 text-emerald-200 border-emerald-400/25`;
  }
  if (tone === "bad") {
    return `${ws.pill} bg-red-500/15 text-red-200 border-red-500/25`;
  }
  return `${ws.pill} bg-white/[0.06] text-white/70 border-white/10`;
}

export default function ShiftCloseLoginPage() {
  const STORAGE_KEY = "shiftCloseUser";
  const LANG_KEY = "appLang";

  const [lang, setLang] = useState("ar"); // ar | en

  React.useEffect(() => {
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
          back: "رجوع",
          pageTitle: "تقفيلة الشفت (للكاشير)",
          loginSubtitle:
            "ادخل اسم المستخدم وكلمة المرور، وبعدها تقدر تدخل مبالغ الكاش والشبكة (الفعلي وفودكس) ويظهر لك العجز/الزيادة.",
          noteTitle: "ملاحظة",
          noteBody: "الفرع يظهر تلقائيًا حسب الفروع المرتبطة بحسابك.",
          username: "اسم المستخدم",
          usernamePh: "أدخل اسم المستخدم",
          password: "كلمة المرور",
          passwordPh: "أدخل كلمة المرور",
          loginBtn: "دخول",
          loginLoading: "جاري تسجيل الدخول...",
          footerHint:
            "إذا ما عندك صلاحية أو ما يظهر فرع، تواصل مع الإدارة لتحديث بيانات الحساب.",
          employee: "الموظف",
          logout: "تسجيل خروج",
          howCalcTitle: "طريقة الحساب",
          howCalcBody:
            "الفرق = (الفعلي − فودكس). إذا طلع رقم بالسالب فهذا عجز، وإذا طلع موجب فهذا زيادة.",
          entryTitle: "إدخال البيانات",
          entryHint:
            "بعد الحفظ، تظهر التقفيلة في قسم المحاسبة (Accounting) في جدول تقفيلة الشفت.",
          branch: "الفرع",
          shiftDate: "تاريخ تقفيلة الشفت",
          shiftType: "نوع الشفت (إجباري)",
          morning: "صباحي",
          evening: "مسائي",
          noteOpt: "ملاحظة (اختياري)",
          noteOptPh: "أي توضيح…",
          actualCash: "الكاش الفعلي",
          actualCard: "الشبكة الفعلية",
          foodicsCash: "كاش فودكس",
          foodicsCard: "شبكة فودكس",
          cashDiff: "فرق الكاش",
          cardDiff: "فرق الشبكة",
          total: "الإجمالي",
          saveSend: "حفظ وإرسال",
          saving: "جاري الحفظ…",
          savedPrefix: "تم حفظ وإرسال تقفيلة الشفت — النتيجة:",
          requiredShiftType: "اختر نوع الشفت (صباحي / مسائي)",
          language: "اللغة",
          arabic: "عربي",
          english: "English",
          loading: "جاري التحميل…",
          noBranches: "لا يوجد فروع مرتبطة بهذا الحساب.",
        },
        en: {
          back: "Back",
          pageTitle: "Shift Close (Cashier)",
          loginSubtitle:
            "Enter your username and password. Then submit cash/card amounts (actual vs Foodics) and the variance will be shown.",
          noteTitle: "Note",
          noteBody: "Your branch is shown automatically based on your account.",
          username: "Username",
          usernamePh: "Enter username",
          password: "Password",
          passwordPh: "Enter password",
          loginBtn: "Sign in",
          loginLoading: "Signing in...",
          footerHint:
            "If you don't have access or no branch appears, contact admin to update your account.",
          employee: "Employee",
          logout: "Sign out",
          howCalcTitle: "How it’s calculated",
          howCalcBody:
            "Difference = (Actual − Foodics). Negative means Short, positive means Over.",
          entryTitle: "Enter amounts",
          entryHint:
            "After saving, the closing will appear in Accounting → Shift Close table.",
          branch: "Branch",
          shiftDate: "Shift close date",
          shiftType: "Shift type (required)",
          morning: "Morning",
          evening: "Evening",
          noteOpt: "Note (optional)",
          noteOptPh: "Any details…",
          actualCash: "Actual cash",
          actualCard: "Actual card",
          foodicsCash: "Foodics cash",
          foodicsCard: "Foodics card",
          cashDiff: "Cash diff",
          cardDiff: "Card diff",
          total: "Total",
          saveSend: "Save & send",
          saving: "Saving…",
          savedPrefix: "Saved and sent — result:",
          requiredShiftType: "Choose shift type (Morning / Evening)",
          language: "Language",
          arabic: "Arabic",
          english: "English",
          loading: "Loading…",
          noBranches: "No branches linked to this account.",
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

  const languagePicker = (
    <div className="flex items-center justify-end">
      <div
        className={`${ws.glassSoft} ${ws.card} px-3 py-2 inline-flex items-center gap-2`}
      >
        <Languages className="w-4 h-4 text-white/70" />
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
  );

  const backArrowIcon =
    dir === "rtl" ? (
      <ArrowLeft className="w-4 h-4" />
    ) : (
      <ArrowLeft className="w-4 h-4 rotate-180" />
    );

  const [stage, setStage] = useState("checking"); // checking | login | form
  const [userData, setUserData] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    // Migrate from sessionStorage to localStorage (one-time)
    try {
      const migrationKeys = [STORAGE_KEY, SHIFT_CLOSE_TOKEN_KEY];
      for (const key of migrationKeys) {
        if (!localStorage.getItem(key)) {
          const old = sessionStorage.getItem(key);
          if (old) {
            localStorage.setItem(key, old);
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const token = localStorage.getItem(SHIFT_CLOSE_TOKEN_KEY);
      if (existing && token) {
        const parsed = JSON.parse(existing);
        if (parsed?.id) {
          const allowed = !!parsed?.can_close_shift;
          if (!allowed) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SHIFT_CLOSE_TOKEN_KEY);
          } else {
            setUserData(parsed);
            setStage("form");
            return;
          }
        }
      }
    } catch {
      // ignore
    }

    setStage("login");
  }, []);

  const branches = useMemo(() => {
    if (!userData) return [];
    const raw = Array.isArray(userData.branches) ? userData.branches : [];
    return raw.filter((b) => b && b.id);
  }, [userData]);

  const defaultBranchId = useMemo(() => {
    if (branches.length > 0) return String(branches[0].id);
    return "";
  }, [branches]);

  const [branchId, setBranchId] = useState("");

  React.useEffect(() => {
    if (stage !== "form") return;
    if (!branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [stage, branchId, defaultBranchId]);

  const [shiftDate, setShiftDate] = useState("");
  const [shiftLabel, setShiftLabel] = useState(""); // required

  const [actualCash, setActualCash] = useState("");
  const [actualCard, setActualCard] = useState("");
  const [foodicsCash, setFoodicsCash] = useState("");
  const [foodicsCard, setFoodicsCard] = useState("");
  const [note, setNote] = useState("");

  const [successMsg, setSuccessMsg] = useState(null);
  const [formError, setFormError] = useState(null);

  const employeeId = userData?.id ? Number(userData.id) : null;

  const money = useMemo(() => {
    const aCash = safeMoneyNumber(actualCash) ?? 0;
    const aCard = safeMoneyNumber(actualCard) ?? 0;
    const fCash = safeMoneyNumber(foodicsCash) ?? 0;
    const fCard = safeMoneyNumber(foodicsCard) ?? 0;

    const cashDiff = aCash - fCash;
    const cardDiff = aCard - fCard;
    const totalDiff = cashDiff + cardDiff;

    return {
      aCash,
      aCard,
      fCash,
      fCard,
      cashDiff,
      cardDiff,
      totalDiff,
    };
  }, [actualCash, actualCard, foodicsCash, foodicsCard]);

  const cashPill = useMemo(
    () => diffLabel(money.cashDiff, lang),
    [money.cashDiff, lang],
  );
  const cardPill = useMemo(
    () => diffLabel(money.cardDiff, lang),
    [money.cardDiff, lang],
  );
  const totalPill = useMemo(
    () => diffLabel(money.totalDiff, lang),
    [money.totalDiff, lang],
  );

  const canSubmit = useMemo(() => {
    if (!employeeId) return false;
    if (!branchId) return false;
    if (!shiftDate) return false;
    if (!shiftLabel) return false;

    const aCash = safeMoneyNumber(actualCash);
    const aCard = safeMoneyNumber(actualCard);
    const fCash = safeMoneyNumber(foodicsCash);
    const fCard = safeMoneyNumber(foodicsCard);

    return aCash !== null && aCard !== null && fCash !== null && fCard !== null;
  }, [
    employeeId,
    branchId,
    shiftDate,
    shiftLabel,
    actualCash,
    actualCard,
    foodicsCash,
    foodicsCard,
  ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employeeId,
        branchId: Number(branchId),
        shiftDate,
        // Store Arabic values in DB (Accounting UI is Arabic)
        shiftLabel: shiftLabel === "morning" ? "صباحي" : "مسائي",
        actualCash: safeMoneyNumber(actualCash),
        actualCard: safeMoneyNumber(actualCard),
        foodicsCash: safeMoneyNumber(foodicsCash),
        foodicsCard: safeMoneyNumber(foodicsCard),
        note: note.trim() || null,
      };

      const res = await shiftCloseFetch("/api/accounting/shift-closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save shift closing");
      }

      return data;
    },
    onSuccess: (data) => {
      const totalDiff = Number(data?.closing?.total_diff);
      const pill = diffLabel(totalDiff, lang);
      setSuccessMsg(
        `${t("savedPrefix")} ${pill.label} (${formatMoney(totalDiff, lang)})`,
      );
      setFormError(null);

      setShiftLabel("");
      setActualCash("");
      setActualCard("");
      setFoodicsCash("");
      setFoodicsCard("");
      setNote("");
    },
    onError: (e) => {
      console.error(e);
      setSuccessMsg(null);
      setFormError(e?.message || "Failed to save shift closing");
    },
  });

  const onSubmitLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/employees/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.details) {
            console.error("Shift-close login details:", data.details);
          }
          throw new Error(data?.error || "Invalid username or password");
        }

        const employee = data?.employee;
        const token = data?.token;
        if (!employee?.id || !token) {
          throw new Error("Login failed");
        }

        // Gate cashier access
        if (!employee?.can_close_shift) {
          throw new Error(
            lang === "en"
              ? "This account is not allowed to close shift. Contact admin."
              : "هذا الحساب غير مخول لتقفيلة الشفت. تواصل مع الإدارة",
          );
        }

        const employeeBranches = Array.isArray(employee.branches)
          ? employee.branches
          : [];
        if (employeeBranches.length === 0) {
          throw new Error(
            lang === "en"
              ? "No branches linked to this account. Contact admin."
              : "لا يوجد فروع مرتبطة بهذا الحساب. يرجى التواصل مع الإدارة",
          );
        }

        // الحل 4: فصل جلسة الكاشير (الموظف) عن جلسة المدير
        clearAdminSession();

        localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
        localStorage.setItem(SHIFT_CLOSE_TOKEN_KEY, token);

        // keep systems isolated
        try {
          localStorage.removeItem("employee");
          localStorage.removeItem("employeeInventorySession");
          localStorage.removeItem("employeeInventoryToken");
        } catch {
          // ignore
        }

        setUserData(employee);
        setStage("form");
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(
          err?.message ||
            (lang === "en" ? "Login error" : "حدث خطأ أثناء تسجيل الدخول"),
        );
        setLoading(false);
      }
    },
    [username, password, lang],
  );

  const onSubmitForm = useCallback(() => {
    setSuccessMsg(null);
    setFormError(null);

    if (!shiftLabel) {
      setFormError(t("requiredShiftType"));
      return;
    }

    createMutation.mutate();
  }, [createMutation, shiftLabel, t]);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SHIFT_CLOSE_TOKEN_KEY);
    } catch {
      // ignore
    }
    setUserData(null);
    setStage("login");
    setUsername("");
    setPassword("");
    setError("");
    setSuccessMsg(null);
    setFormError(null);
  }, []);

  const inputClass = `${ws.input} px-4 py-3`;

  const branchOptions = useMemo(() => {
    const options = branches.map((b) => ({
      value: String(b.id),
      label: b.name || `Branch ${b.id}`,
    }));
    return options;
  }, [branches]);

  const shiftTypeOptions = useMemo(() => {
    return [
      { value: "morning", label: t("morning") },
      { value: "evening", label: t("evening") },
    ];
  }, [t]);

  const branchIconPos = dir === "rtl" ? "right-4" : "left-4";
  const branchBtnPadding = dir === "rtl" ? "pr-11" : "pl-11";

  const selectedBranchName = useMemo(() => {
    const idNum = Number(branchId);
    const found = branches.find((b) => Number(b.id) === idNum);
    return found?.name || "";
  }, [branches, branchId]);

  const summaryCards = useMemo(() => {
    return [
      {
        key: "cash",
        title: t("cashDiff"),
        value: formatMoney(money.cashDiff, lang),
        pill: cashPill,
      },
      {
        key: "card",
        title: t("cardDiff"),
        value: formatMoney(money.cardDiff, lang),
        pill: cardPill,
      },
      {
        key: "total",
        title: t("total"),
        value: formatMoney(money.totalDiff, lang),
        pill: totalPill,
      },
    ];
  }, [
    money.cashDiff,
    money.cardDiff,
    money.totalDiff,
    cashPill,
    cardPill,
    totalPill,
    t,
    lang,
  ]);

  const dateDisplayLocale = lang === "en" ? "en-US" : "ar-SA-u-ca-gregory-nu-latn";

  if (stage === "checking") {
    return (
      <div
        className={`min-h-[100svh] flex items-center justify-center px-4 ${ws.appBg}`}
        dir={dir}
      >
        <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
          {t("loading")}
        </div>
      </div>
    );
  }

  if (stage === "login") {
    const subtitle = t("loginSubtitle");

    const loginInputClass = `${ws.input} px-4 py-3 pl-12`;

    return (
      <div
        className={`min-h-[100svh] flex items-center justify-center px-4 ${ws.appBg}`}
        dir={dir}
      >
        <div className="w-full max-w-md">
          {languagePicker}

          <a
            href="/"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 mt-4"
          >
            {backArrowIcon}
            {t("back")}
          </a>

          <div className="text-center mb-6">
            <img
              src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
              alt="Quarters Coffee Bar"
              className="h-24 sm:h-28 w-auto mx-auto"
            />
          </div>

          <div className={`${ws.glass} ${ws.card} p-8`}>
            <div className="text-center mb-7">
              <div className={`${ws.iconBox} w-20 h-20 mx-auto mb-4`}>
                <Calculator className="w-10 h-10 text-fuchsia-200" />
              </div>
              <h1 className={`text-3xl font-bold ${ws.title} mb-2`}>
                {t("pageTitle")}
              </h1>
              <p className={`${ws.muted} leading-6`}>{subtitle}</p>

              <div className={`mt-4 ${ws.glassSoft} ${ws.card} p-3`}>
                <div className="flex items-start gap-3">
                  <div className={`${ws.iconBox} w-10 h-10`}>
                    <Building2 className="w-5 h-5 text-sky-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/80">
                      {t("noteTitle")}
                    </div>
                    <div className="text-xs text-white/55 mt-1 leading-5">
                      {t("noteBody")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmitLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("username")}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <User className="w-5 h-5 text-white/40" />
                  </div>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={loginInputClass}
                    placeholder={t("usernamePh")}
                    required
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("password")}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Lock className="w-5 h-5 text-white/40" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={loginInputClass}
                    placeholder={t("passwordPh")}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error ? (
                <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3 text-red-200 text-sm text-center">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? t("loginLoading") : t("loginBtn")}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-white/45 leading-5">
            {t("footerHint")}
          </div>
        </div>
      </div>
    );
  }

  // stage === "form"
  const infoCard = (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white tracking-tight">
            {t("howCalcTitle")}
          </div>
          <div className="text-sm text-white/60 mt-1 leading-6">
            {t("howCalcBody")}
          </div>
        </div>
      </div>
    </div>
  );

  const cardShell = `${ws.glass} ${ws.card} p-6 sm:p-7`;

  return (
    <div className={`min-h-[100svh] px-4 py-8 ${ws.appBg}`} dir={dir}>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        {languagePicker}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-12 h-12 text-fuchsia-200`}>
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {t("pageTitle")}
              </div>
              <div className="text-sm text-white/55 mt-0.5">
                {userData?.name ? `${t("employee")}: ${userData.name}` : ""}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`${ws.btnNeutral} px-4 py-2.5 justify-center`}
          >
            <LogOut className="w-4 h-4" />
            {t("logout")}
          </button>
        </div>

        {infoCard}

        {branches.length === 0 ? (
          <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
            {t("noBranches")}
          </div>
        ) : (
          <div className={cardShell}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`${ws.iconBox} w-10 h-10`}>
                <Send className="w-5 h-5 text-white/70" />
              </div>
              <div>
                <div className="font-bold text-white tracking-tight">
                  {t("entryTitle")}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {t("entryHint")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("branch")}
                </label>
                <div className="relative">
                  <Building2
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 ${branchIconPos}`}
                  />
                  {branches.length === 1 ? (
                    <input
                      value={selectedBranchName}
                      disabled
                      className={`${inputClass} ${branchBtnPadding} opacity-80`}
                    />
                  ) : (
                    <GlassSelect
                      value={branchId}
                      onChange={setBranchId}
                      options={branchOptions}
                      dir={dir}
                      buttonClassName={branchBtnPadding}
                      placeholder={t("branch")}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("shiftDate")}
                </label>

                <GlassDatePicker
                  value={shiftDate}
                  onChange={setShiftDate}
                  placeholder={t("shiftDate")}
                  allowClear
                  dir={dir}
                  displayLocale={dateDisplayLocale}
                />

                {!shiftDate ? (
                  <div className="mt-2 text-xs text-white/45">
                    {lang === "en"
                      ? "Date is empty until you pick one."
                      : "التاريخ يبقى فارغ حتى تختار تاريخ."}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("shiftType")}
                </label>
                <GlassSelect
                  value={shiftLabel}
                  onChange={setShiftLabel}
                  options={shiftTypeOptions}
                  dir={dir}
                  placeholder="—"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  {t("noteOpt")}
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={inputClass}
                  placeholder={t("noteOptPh")}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-semibold text-white/70 mb-2">
                  {t("actualCash")}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-white/70 mb-2">
                  {t("actualCard")}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={actualCard}
                  onChange={(e) => setActualCard(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-white/70 mb-2">
                  {t("foodicsCash")}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={foodicsCash}
                  onChange={(e) => setFoodicsCash(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-white/70 mb-2">
                  {t("foodicsCard")}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={foodicsCard}
                  onChange={(e) => setFoodicsCard(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summaryCards.map((c) => (
                <div key={c.key} className={`${ws.glassSoft} ${ws.card} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-white/50">{c.title}</div>
                      <div className="text-lg font-extrabold text-white tracking-tight mt-1">
                        {c.value}
                      </div>
                    </div>
                    <span className={pillClassForTone(c.pill.tone)}>
                      {c.pill.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {formError ? (
              <div className="mt-4 text-sm text-red-300">{formError}</div>
            ) : null}

            {successMsg ? (
              <div className="mt-4 text-sm text-emerald-200">{successMsg}</div>
            ) : null}

            <div className="mt-5">
              <button
                type="button"
                onClick={onSubmitForm}
                disabled={!canSubmit || createMutation.isPending}
                className={`${ws.btnPrimary} px-5 py-3 disabled:opacity-50`}
              >
                {createMutation.isPending ? t("saving") : t("saveSend")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
