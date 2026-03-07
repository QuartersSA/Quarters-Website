"use client";

import { useState } from "react";
import { Lock, User, Shield, AlertCircle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { ADMIN_TOKEN_KEY, clearEmployeeSessions } from "@/utils/apiAuth";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/employees/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = data?.details ? ` (${data.details})` : "";
        const debug = data?.debug_code ? ` [${data.debug_code}]` : "";
        setError(
          (data.error || "اسم المستخدم أو كلمة المرور غير صحيحة") +
            details +
            debug,
        );
        setLoading(false);
        return;
      }

      if (data.employee.role !== "Admin") {
        setError("هذا الحساب ليس له صلاحيات إدارية");
        setLoading(false);
        return;
      }

      // الحل 4: فصل جلسة المدير عن جلسات الموظفين
      clearEmployeeSessions();

      localStorage.setItem("adminAuth", "true");
      localStorage.setItem(
        "adminUser",
        JSON.stringify({
          id: data.employee.id,
          name: data.employee.name,
          username: data.employee.username,
          role: data.employee.role,
          can_access_workspace: !!data.employee.can_access_workspace,
          can_manage_inventory: !!data.employee.can_manage_inventory,
          can_manage_accounting: !!data.employee.can_manage_accounting,
          can_manage_employees: !!data.employee.can_manage_employees,
          can_access_hr:
            data.employee.can_access_hr === undefined ||
            data.employee.can_access_hr === null
              ? !!data.employee.can_manage_employees
              : !!data.employee.can_access_hr,
          // ✅ NEW: deductions-only permission
          can_manage_deductions: !!data.employee.can_manage_deductions,
        }),
      );

      if (data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      }

      // Force re-choose system after fresh login
      localStorage.removeItem("adminMode");
      localStorage.removeItem("workspaceUser");

      window.location.href = "/admin";
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في تسجيل الدخول");
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-[100svh] flex items-center justify-center px-4 ${ws.appBg}`}
      dir="rtl"
    >
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
              className={`${ws.iconBox} w-20 h-20 mx-auto mb-4 text-emerald-200`}
            >
              <Shield className="w-10 h-10" />
            </div>
            <h1 className={`text-3xl font-bold ${ws.title} mb-2`}>
              لوحة التحكم الإدارية
            </h1>
            <p className={ws.muted}>قم بتسجيل الدخول للوصول إلى النظام</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-white/70 mb-2"
              >
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <User className="w-5 h-5 text-white/40" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`${ws.input} px-4 py-3 pl-12`}
                  placeholder="أدخل اسم المستخدم"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-white/70 mb-2"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock className="w-5 h-5 text-white/40" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${ws.input} px-4 py-3 pl-12`}
                  placeholder="أدخل كلمة المرور"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error ? (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3 backdrop-blur-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-200 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? "جاري تسجيل الدخول..." : "دخول"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
