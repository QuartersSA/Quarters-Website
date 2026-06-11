"use client";

import { Users, User, Pencil, Trash2, ScrollText, Ban } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function formatIsoDate(value) {
  if (!value) return "-";
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";

  try {
    return new Intl.NumberFormat("ar-SA-u-ca-gregory-nu-latn", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch (e) {
    return String(n);
  }
}

function YesNoPill({ value }) {
  const yes = !!value;
  const label = yes ? "نعم" : "لا";
  const pillClass = yes
    ? `${ws.pill} bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20`
    : `${ws.pill} bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10`;

  return <span className={pillClass}>{label}</span>;
}

export function HREmployeeTable({
  employees,
  isLoading,
  onEdit,
  onDelete,
  onViewLogs,
  onSuspend,
}) {
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  const headerCells = [
    "الاسم",
    "الجوال",
    "رقم الإقامة",
    "انتهاء الإقامة",
    "تم نقل الكفالة",
    "كرت عمل",
    "كشف طبي",
    "كرت صحي",
    "المنصب",
    "الفرع",
    "الراتب الأساسي",
    "بدلات أخرى",
    "الإجراءات",
  ];

  if (isLoading) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-white/[0.04]">
                {headerCells.map((h) => (
                  <th
                    key={h}
                    className="text-right px-5 py-4 text-sm font-semibold text-slate-600 dark:text-white/55 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={headerCells.length}
                  className="px-6 py-12 text-center text-slate-600 dark:text-white/55"
                >
                  جاري التحميل…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-white/[0.04]">
                {headerCells.map((h) => (
                  <th
                    key={h}
                    className="text-right px-5 py-4 text-sm font-semibold text-slate-600 dark:text-white/55 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={headerCells.length}
                  className="px-6 py-12 text-center text-slate-500 dark:text-white/45"
                >
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>لا يوجد موظفين</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={sectionCard}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-white/[0.04]">
              {headerCells.map((h) => (
                <th
                  key={h}
                  className="text-right px-5 py-4 text-sm font-semibold text-slate-600 dark:text-white/55 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {employees.map((employee) => {
              const phoneValue = employee.phone || "-";
              const iqamaNumberValue = employee.iqama_number || "-";
              const iqamaExpiryValue = formatIsoDate(
                employee.iqama_expiry_date,
              );
              const positionValue = employee.position || "-";

              const branches = Array.isArray(employee.branches)
                ? employee.branches
                : [];
              const firstBranchName = branches?.[0]?.name;
              const extraBranchesCount = Math.max(0, branches.length - 1);
              const branchLabel = firstBranchName
                ? extraBranchesCount > 0
                  ? `${firstBranchName} +${extraBranchesCount}`
                  : firstBranchName
                : "-";

              const baseSalaryValue = formatMoney(employee.base_salary);
              const otherAllowancesValue = formatMoney(
                employee.other_allowances,
              );

              return (
                <tr
                  key={employee.id}
                  className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/85`}>
                        <User className="w-5 h-5" />
                      </div>
                      <span className="text-slate-900 dark:text-white font-medium truncate">
                        {employee.name}
                      </span>
                    </div>
                  </td>

                  <td
                    className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {phoneValue}
                  </td>

                  <td
                    className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {iqamaNumberValue}
                  </td>

                  <td
                    className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {iqamaExpiryValue}
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <YesNoPill value={employee.sponsorship_transferred} />
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <YesNoPill value={employee.work_card_issued} />
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <YesNoPill value={employee.medical_check_issued} />
                  </td>

                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <YesNoPill value={employee.health_card_issued} />
                      {employee.health_card_issued &&
                      employee.health_card_expiry_date &&
                      String(employee.health_card_expiry_date).slice(0, 10) <
                        new Date().toLocaleDateString("en-CA", {
                          timeZone: "Asia/Riyadh",
                        }) ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300"
                          title={`انتهى في ${String(employee.health_card_expiry_date).slice(0, 10)}`}
                        >
                          منتهي
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap">
                    {positionValue}
                  </td>

                  <td className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap">
                    {branchLabel}
                  </td>

                  <td
                    className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {baseSalaryValue}
                  </td>

                  <td
                    className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {otherAllowancesValue}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewLogs?.(employee)}
                        className={`${ws.iconButton} text-slate-700 dark:text-white/70`}
                        aria-label="السجل"
                        title="السجل"
                      >
                        <ScrollText className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSuspend?.(employee)}
                        className={`${ws.iconButton} text-amber-700 dark:text-amber-200`}
                        aria-label="إيقاف"
                        title="إيقاف موظف"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(employee)}
                        className={`${ws.iconButton} text-sky-700 dark:text-sky-200`}
                        aria-label="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(employee.id)}
                        className={`${ws.iconButton} text-red-700 dark:text-red-200`}
                        aria-label="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
