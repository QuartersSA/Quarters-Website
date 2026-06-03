"use client";

import { useState } from "react";
import { User, Lock, Building2, Globe, CheckCircle2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import {
  EMPLOYEE_INVENTORY_TOKEN_KEY,
  clearAdminSession,
} from "@/utils/apiAuth";

export default function EmployeeLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("employeeLanguage") || "ar"
      : "ar",
  );

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("employeeLanguage", lang);
    }
  };

  const completeLogin = (employee, branchId, token) => {
    // الحل 4: فصل جلسة الموظف عن جلسة المدير
    clearAdminSession();

    // new explicit session keys (avoid mixing with other employee flows)
    localStorage.setItem(
      "employeeInventorySession",
      JSON.stringify({
        id: employee.id,
        username: employee.name,
        branchId,
      }),
    );

    if (token) {
      localStorage.setItem(EMPLOYEE_INVENTORY_TOKEN_KEY, token);
    }

    // keep language
    localStorage.setItem("employeeLanguage", language);

    window.location.href = "/employee/inventory";
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData?.details) {
          console.error("Login error details:", errorData.details);
        }
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

      // Gate inventory access
      if (!employee?.can_do_inventory) {
        setError(
          language === "ar"
            ? "هذا الحساب غير مخول لتسجيل الجرد. تواصل مع الإدارة"
            : "This account is not allowed to do inventory. Contact admin",
        );
        setLoading(false);
        return;
      }

      if (!employee.branches || employee.branches.length === 0) {
        setError(
          language === "ar"
            ? "لا توجد فروع مرتبطة بهذا الحساب. يرجى التواصل مع المدير"
            : "No branches linked to this account. Please contact admin",
        );
        setLoading(false);
        return;
      }

      if (employee.branches.length === 1) {
        completeLogin(employee, employee.branches[0].id, token);
        return;
      }

      setEmployeeData({ ...employee, __token: token });
      setShowBranchModal(true);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(
        language === "ar" ? "حدث خطأ في تسجيل الدخول" : "Login error occurred",
      );
      setLoading(false);
    }
  };

  const handleBranchSelection = () => {
    if (!selectedBranch) {
      setError(
        language === "ar" ? "الرجاء اختيار الفرع" : "Please select a branch",
      );
      return;
    }

    const token = employeeData?.__token;
    completeLogin(employeeData, selectedBranch, token);
  };

  const t = {
    ar: {
      title: "تسجيل دخول الموظفين",
      subtitle: "قم بتسجيل الدخول لبدء عملية الجرد",
      username: "اسم المستخدم",
      password: "كلمة المرور",
      login: "دخول",
      loggingIn: "جاري تسجيل الدخول...",
      usernamePlaceholder: "أدخل اسم المستخدم",
      passwordPlaceholder: "أدخل كلمة المرور",
      selectBranch: "اختر فرع الجرد",
      welcome: "مرحباً",
      selectBranchDesc: "اختر الفرع الذي تريد الجرد فيه",
      continue: "متابعة للجرد",
    },
    en: {
      title: "Employee Login",
      subtitle: "Login to start inventory process",
      username: "Username",
      password: "Password",
      login: "Login",
      loggingIn: "Logging in...",
      usernamePlaceholder: "Enter username",
      passwordPlaceholder: "Enter password",
      selectBranch: "Select Inventory Branch",
      welcome: "Welcome",
      selectBranchDesc: "Choose the branch for inventory",
      continue: "Continue to Inventory",
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
              <User className="w-8 h-8" />
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

      {/* Branch selection modal */}
      {showBranchModal && employeeData ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className={`${ws.glass} ${ws.card} w-full max-w-md p-6`}
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            <div className="text-center mb-6">
              <div
                className={`${ws.iconBox} w-16 h-16 mx-auto mb-4 text-sky-200`}
              >
                <Building2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {text.selectBranch}
              </h2>
              <p className="text-white/55">
                {text.welcome} {employeeData.name}، {text.selectBranchDesc}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {employeeData.branches.map((branch) => {
                const active = selectedBranch === branch.id;
                const btnClass = active
                  ? "bg-white/10 border-white/20"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]";

                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranch(branch.id)}
                    className={`w-full text-right ${ws.card} rounded-2xl border p-4 transition-colors ${btnClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`${ws.iconBox} w-10 h-10 text-emerald-200 flex-shrink-0`}
                      >
                        {active ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">
                          {branch.name}
                        </div>
                        {branch.location ? (
                          <div className="text-sm text-white/50 mt-1">
                            {branch.location}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3 text-red-200 text-sm text-center mb-4">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleBranchSelection}
              disabled={!selectedBranch}
              className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {text.continue}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
