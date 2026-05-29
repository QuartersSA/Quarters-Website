"use client";

import React, { useMemo, useState } from "react";
import { Clock, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import HRSidebar from "@/components/HR/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";
import {
  buildRecentMonthOptions,
  monthLabel,
  formatMoney,
} from "@/utils/payrollFormatters";
import { useLoanEmployees } from "@/hooks/useEmployeeLoans";
import {
  useOvertime,
  useCreateOvertime,
  useDeleteOvertime,
} from "@/hooks/useOvertime";

function OvertimeMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
        <Clock className="w-5 h-5 text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-white tracking-tight">الأوفر تايم</div>
        <div className="text-xs text-white/50">
          ساعات إضافية تُضاف لمسير الرواتب
        </div>
      </div>
    </div>
  );
}

function OvertimeDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Clock className="w-6 h-6 text-emerald-200" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          الأوفر تايم
        </h1>
        <p className="text-white/50 text-sm mt-0.5">
          يُحسب القسط الإضافي تلقائياً: (الراتب الأساسي ÷ 30) × 1.5 × عدد
          الأيام.
        </p>
      </div>
    </div>
  );
}

function OvertimeInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-200" />
        </div>
        <div className="text-sm text-white/75 leading-relaxed">
          الصيغة:{" "}
          <span className="text-white/90 font-semibold">
            (الراتب الأساسي ÷ 30) × 1.5
          </span>{" "}
          لكل يوم. المبلغ يُضاف على راتب الموظف للشهر المختار ويظهر في
          مسير الرواتب في HR + المحاسبة تلقائياً. الأشهر المُقفلة لا
          تتأثر بالتعديلات اللاحقة.
        </div>
      </div>
    </div>
  );
}

export default function HROvertimePage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [filterEmployee, setFilterEmployee] = useState("");

  // Form state — multi-employee.
  // Storing IDs as strings so they round-trip through
  // GlassMultiSelect's Set comparison cleanly.
  const [formEmployees, setFormEmployees] = useState([]);
  const [formMonth, setFormMonth] = useState(filterMonth);
  const [formDays, setFormDays] = useState("");
  const [formReason, setFormReason] = useState("");

  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthOptionsForm = useMemo(() => {
    const base = buildRecentMonthOptions(30).filter((o) => o.value !== "");
    // Allow a few future months for scheduled overtime
    const now = new Date();
    for (let i = 1; i <= 3; i += 1) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1),
      );
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const value = `${y}-${m}`;
      if (!base.find((o) => o.value === value)) {
        base.unshift({ value, label: monthLabel(value) });
      }
    }
    return [{ value: "", label: "اختر الشهر" }, ...base];
  }, []);

  const employeesQuery = useLoanEmployees(employeeId, isAdmin);
  const employees = employeesQuery.data || [];

  const overtimeQuery = useOvertime({
    month: filterMonth || null,
    employeeId: filterEmployee || null,
  });
  const overtimeRows = overtimeQuery.data || [];

  const createMutation = useCreateOvertime();
  const deleteMutation = useDeleteOvertime();

  const formatEmployeeLabel = (e) =>
    e.branch_name ? `${e.name} — ${e.branch_name}` : e.name;

  const employeeFormMultiOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: String(e.id),
        label: formatEmployeeLabel(e),
      })),
    [employees],
  );

  const employeeFilterOptions = useMemo(
    () => [
      { value: "", label: "كل الموظفين" },
      ...employees.map((e) => ({
        value: String(e.id),
        label: formatEmployeeLabel(e),
      })),
    ],
    [employees],
  );

  const canSubmit =
    !createMutation.isPending &&
    formEmployees.length > 0 &&
    !!formMonth &&
    Number(formDays) > 0;

  const handleSelectAllEmployees = () => {
    setFormEmployees(employees.map((e) => String(e.id)));
  };

  const handleClearEmployees = () => {
    setFormEmployees([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const ids = formEmployees
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return;

    const days = Number(formDays);
    const month = formMonth;
    const reason = formReason ? formReason.trim() : null;

    // Sequential POSTs so each one carries its own toast / cache
    // invalidation through the existing useCreateOvertime hook.
    // mutateAsync returns the resolved value so we can count
    // successes.
    let succeeded = 0;
    for (const employee_id of ids) {
      try {
        await createMutation.mutateAsync({
          employee_id,
          month,
          days,
          reason,
        });
        succeeded += 1;
      } catch {
        // toast is already raised inside the hook's onError
      }
    }

    if (succeeded > 0) {
      setFormDays("");
      setFormReason("");
      // Keep employee selection + month so the admin can record
      // another batch quickly without re-picking everyone.
    }
  };

  const handleDelete = (row) => {
    const confirmed = window.confirm(
      `حذف سجل الأوفر تايم لـ ${row.employee_name || "هذا الموظف"} (${row.days} يوم) لشهر ${monthLabel(String(row.month).slice(0, 7))}؟`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(row.id);
  };

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/70`}>
        الرجاء تسجيل الدخول.
      </div>
    );
  } else if (!isAdmin) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/70`}>
        متاح لمسؤولي HR فقط.
      </div>
    );
  } else {
    body = (
      <>
        <OvertimeInfoCard />

        {/* Add form */}
        <div className={`${ws.glass} ${ws.card} p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Plus className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight">
                تسجيل أوفر تايم
              </div>
              <div className="text-xs text-white/50 mt-0.5">
                يُضاف للموظف على راتب الشهر المختار
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs text-white/55">
                  الموظفون{" "}
                  {formEmployees.length > 0 ? (
                    <span className="text-white/40">
                      ({formEmployees.length})
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllEmployees}
                    disabled={
                      employees.length === 0 ||
                      formEmployees.length === employees.length
                    }
                    className={`${ws.btnNeutral} px-2.5 py-1 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={handleClearEmployees}
                    disabled={formEmployees.length === 0}
                    className={`${ws.btnNeutral} px-2.5 py-1 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    مسح
                  </button>
                </div>
              </div>
              <GlassMultiSelect
                values={formEmployees}
                onChange={(vals) =>
                  setFormEmployees(Array.isArray(vals) ? vals : [])
                }
                options={employeeFormMultiOptions}
                placeholder="اختر موظف أو أكثر"
              />
            </div>
            <div>
              <div className="text-xs text-white/55 mb-1">الشهر</div>
              <GlassSelect
                value={formMonth}
                onChange={setFormMonth}
                options={monthOptionsForm}
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>
            <div>
              <div className="text-xs text-white/55 mb-1">
                عدد أيام الأوفر تايم
              </div>
              <input
                type="number"
                value={formDays}
                onChange={(e) => setFormDays(e.target.value)}
                className={`${ws.input} px-3 py-2 text-right`}
                placeholder="مثلاً: 2 أو 0.5"
                step="0.5"
                min="0"
                dir="ltr"
              />
            </div>
            <div>
              <div className="text-xs text-white/55 mb-1">
                ملاحظة <span className="text-white/35">(اختياري)</span>
              </div>
              <input
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                className={`${ws.input} px-3 py-2`}
                placeholder="سبب أو وصف"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending
                  ? "جاري التسجيل…"
                  : formEmployees.length > 1
                    ? `إضافة لـ ${formEmployees.length} موظف`
                    : "إضافة"}
              </button>
              <div className="text-xs text-white/45">
                الصيغة: (الراتب ÷ 30) × 1.5 × {formDays || "0"} يوم — تُطبَّق
                لكل موظف
              </div>
            </div>
          </form>
        </div>

        {/* Filters */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[180px]">
              <div className="text-xs text-white/55 mb-1">الشهر</div>
              <GlassSelect
                value={filterMonth}
                onChange={setFilterMonth}
                options={monthOptions}
                placeholder="كل الأشهر"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>
            <div className="min-w-[200px]">
              <div className="text-xs text-white/55 mb-1">الموظف</div>
              <GlassSelect
                value={filterEmployee}
                onChange={setFilterEmployee}
                options={employeeFilterOptions}
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          {overtimeQuery.isLoading ? (
            <div className="p-6 text-white/60 text-sm">جاري التحميل…</div>
          ) : overtimeRows.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <div className={`${ws.iconBox} w-12 h-12 mx-auto mb-3`}>
                <Clock className="w-5 h-5 text-white/50" />
              </div>
              <div className="text-sm font-semibold text-white/75">
                لا توجد سجلات أوفر تايم
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/70 text-xs">
                    <th className="text-right font-semibold py-3 px-3">
                      الموظف
                    </th>
                    <th className="text-right font-semibold py-3 px-3">
                      الشهر
                    </th>
                    <th className="text-right font-semibold py-3 px-3">
                      الأيام
                    </th>
                    <th className="text-right font-semibold py-3 px-3">
                      الراتب الأساسي
                    </th>
                    <th className="text-right font-semibold py-3 px-3">
                      المبلغ
                    </th>
                    <th className="text-right font-semibold py-3 px-3">
                      الملاحظة
                    </th>
                    <th className="py-3 px-3" style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {overtimeRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-white/10 hover:bg-white/[0.04]"
                    >
                      <td className="py-3 px-3 font-semibold text-white">
                        {r.employee_name || `#${r.employee_id}`}
                      </td>
                      <td className="py-3 px-3 text-white/75">
                        {monthLabel(String(r.month).slice(0, 7))}
                      </td>
                      <td
                        className="py-3 px-3 text-white/85 text-right"
                        dir="ltr"
                      >
                        {Number(r.days || 0)}
                      </td>
                      <td
                        className="py-3 px-3 text-white/55 text-right"
                        dir="ltr"
                      >
                        {formatMoney(r.base_salary)}
                      </td>
                      <td
                        className="py-3 px-3 text-emerald-200 font-bold text-right"
                        dir="ltr"
                      >
                        {formatMoney(r.amount)}
                      </td>
                      <td
                        className="py-3 px-3 text-white/60 text-xs"
                        style={{ maxWidth: 240 }}
                      >
                        <div className="truncate" title={r.reason || ""}>
                          {r.reason || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className={`${ws.iconButton} w-8 h-8 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-200`}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <HRSidebar active="overtime" />
      <OvertimeMobileHeader />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <OvertimeDesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
