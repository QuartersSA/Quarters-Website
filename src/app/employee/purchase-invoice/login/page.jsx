"use client";

import { useState } from "react";
import { User, Lock, Globe, ReceiptText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { PURCHASE_INVOICE_TOKEN_KEY, clearAdminSession } from "@/utils/apiAuth";

// Field login for رفع فاتورة مشتريات: employees with the dedicated
// can_add_purchase_invoices permission get ONLY the invoice entry
// editor — no accounting pages, no invoice ledger.
export default function PurchaseInvoiceLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("employeeLanguage") || "ar"
      : "ar",
  );

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("employeeLanguage", lang);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!username || !password) {
        setError(
          language === "ar"
            ? "الرجاء ملء جميع الحقول"
            : "Please fill all fields",
        );
        setLoading(false);
        return;
      }

      const response = await fetch("/api/employees/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(
          errorData.error ||
            (language === "ar"
              ? "حدث خطأ في تسجيل الدخول"
              : "Login error occurred"),
        );
        setLoading(false);
        return;
      }

      const data = await response.json();
      const employee = data.employee;
      const token = data.token;

      // Admin accounting managers may also enter from here.
      const allowed =
        !!employee?.can_add_purchase_invoices ||
        (employee?.role === "Admin" && !!employee?.can_manage_accounting);
      if (!allowed) {
        setError(
          language === "ar"
            ? "هذا الحساب غير مخول لرفع فواتير المشتريات. تواصل مع الإدارة"
            : "This account is not allowed to add purchase invoices. Contact admin",
        );
        setLoading(false);
        return;
      }

      // Separate the field session from any admin session.
      clearAdminSession();
      localStorage.setItem(
        "purchaseInvoiceSession",
        JSON.stringify({ id: employee.id, username: employee.name }),
      );
      if (token) {
        localStorage.setItem(PURCHASE_INVOICE_TOKEN_KEY, token);
      }
      localStorage.setItem("employeeLanguage", language);

      window.location.href = "/employee/purchase-invoice";
    } catch (err) {
      console.error(err);
      setError(
        language === "ar" ? "حدث خطأ في تسجيل الدخول" : "Login error occurred",
      );
      setLoading(false);
    }
  };

  const t = {
    ar: {
      title: "رفع فاتورة مشتريات",
      subtitle: "سجّل الدخول لإدخال فواتير المشتريات ومسحها ذكياً",
      username: "اسم المستخدم",
      password: "كلمة المرور",
      login: "دخول",
      loggingIn: "جاري تسجيل الدخول...",
      usernamePlaceholder: "أدخل اسم المستخدم",
      passwordPlaceholder: "أدخل كلمة المرور",
    },
    en: {
      title: "Purchase Invoice Entry",
      subtitle: "Login to add and smart-scan purchase invoices",
      username: "Username",
      password: "Password",
      login: "Login",
      loggingIn: "Logging in...",
      usernamePlaceholder: "Enter username",
      passwordPlaceholder: "Enter password",
    },
  };

  const text = t[language];

  return (
    <div
      className={`dark min-h-[100svh] flex items-center justify-center px-4 ${ws.appBg}`}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Language toggle */}
      <div
        className={`absolute top-6 ${language === "ar" ? "left-6" : "right-6"} ${ws.glassSoft} rounded-2xl p-2 border border-white/10 flex items-center gap-2`}
      >
        <button
          type="button"
          onClick={() => handleLanguageChange("ar")}
          className={`${language === "ar" ? ws.btnPrimary : ws.btnNeutral} px-4 py-2 justify-center`}
        >
          <Globe className="w-4 h-4" />
          <span className="font-semibold">عربي</span>
        </button>
        <button
          type="button"
          onClick={() => handleLanguageChange("en")}
          className={`${language === "en" ? ws.btnPrimary : ws.btnNeutral} px-4 py-2 justify-center`}
        >
          <Globe className="w-4 h-4" />
          <span className="font-semibold">English</span>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
            alt="Quarters Coffee Bar"
            className="h-24 sm:h-28 w-auto mx-auto"
          />
        </div>

        <div className={`${ws.glass} ${ws.card} p-8`}>
          <div className="text-center mb-8">
            <div
              className={`${ws.iconBox} w-16 h-16 mx-auto mb-4 text-emerald-200`}
            >
              <ReceiptText className="w-8 h-8" />
            </div>
            <h1 className={`text-3xl font-bold ${ws.title} mb-2`}>
              {text.title}
            </h1>
            <p className={ws.muted}>{text.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-white/70 mb-2"
              >
                {text.username}
              </label>
              <div className="relative">
                <div
                  className={`absolute ${language === "ar" ? "left-3" : "right-3"} top-1/2 -translate-y-1/2`}
                >
                  <User className="w-5 h-5 text-slate-400 dark:text-white/40" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`${ws.input} px-4 py-3 ${language === "ar" ? "pl-12" : "pr-12"}`}
                  placeholder={text.usernamePlaceholder}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-white/70 mb-2"
              >
                {text.password}
              </label>
              <div className="relative">
                <div
                  className={`absolute ${language === "ar" ? "left-3" : "right-3"} top-1/2 -translate-y-1/2`}
                >
                  <Lock className="w-5 h-5 text-slate-400 dark:text-white/40" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${ws.input} px-4 py-3 ${language === "ar" ? "pl-12" : "pr-12"}`}
                  placeholder={text.passwordPlaceholder}
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
              {loading ? text.loggingIn : text.login}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
