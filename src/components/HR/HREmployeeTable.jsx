"use client";

import { Users, User, Pencil, Trash2, ScrollText, Ban } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatHijriLabel } from "@/utils/hijri";

function formatIsoDate(value) {
  if (!value) return "-";
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

/* Expiry date display. When the operator entered the date in the Hijri
 * (umalqura) calendar, the Hijri label leads with the Gregorian ISO in
 * a small muted sub-line. Otherwise the Gregorian date is primary. The
 * expiry status/tint is always driven by the Gregorian value upstream,
 * so display calendar never affects the alerts. `tintClass` styles the
 * primary line (carries the expired/soon color). */
function ExpiryDateDisplay({ gregorian, calendar, hijri, tintClass }) {
  const gregText = formatIsoDate(gregorian);
  const isHijri = calendar === "umalqura" && hijri;

  if (isHijri) {
    return (
      <span className="inline-flex flex-col leading-tight">
        <span className={tintClass} dir="rtl">
          {formatHijriLabel(hijri)}
        </span>
        <span
          className="text-[10px] text-slate-400 dark:text-white/40"
          dir="ltr"
        >
          {gregText}
        </span>
      </span>
    );
  }

  return (
    <span className={tintClass} dir="ltr">
      {gregText}
    </span>
  );
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

/* Bucket an ISO date against the Riyadh today / +30d windows. */
function expiryStatus(dateStr, todayRiyadh, soonRiyadh) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  if (d < todayRiyadh) return "expired";
  if (d <= soonRiyadh) return "soon";
  return null;
}

function ExpiryBadge({ status, dateStr }) {
  if (!status) return null;
  const expired = status === "expired";
  const cls = expired
    ? "bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300"
    : "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}
      title={
        expired
          ? `انتهى في ${String(dateStr).slice(0, 10)}`
          : `ينتهي في ${String(dateStr).slice(0, 10)}`
      }
    >
      {expired ? "منتهي" : "قريب الانتهاء"}
    </span>
  );
}

function YesNoPill({ value }) {
  const yes = !!value;
  const label = yes ? "نعم" : "لا";
  const pillClass = yes
    ? `${ws.pill} bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20`
    : `${ws.pill} bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10`;

  return <span className={pillClass}>{label}</span>;
}

/* Riyadh "today" / "+30d" as plain YYYY-MM-DD strings (lexicographic
 * compare works for ISO dates). Computed once per render. */
function riyadhWindows() {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Riyadh",
  });
  const soonRiyadh = new Date(Date.now() + 30 * 864e5).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Riyadh" },
  );
  return { todayRiyadh, soonRiyadh };
}

function branchLabelFor(employee) {
  const branches = Array.isArray(employee.branches) ? employee.branches : [];
  const firstBranchName = branches?.[0]?.name;
  const extra = Math.max(0, branches.length - 1);
  if (!firstBranchName) return "-";
  return extra > 0 ? `${firstBranchName} +${extra}` : firstBranchName;
}

function displayNameFor(employee) {
  return employee.display_name || employee.name || "-";
}

/* ── Mobile stacked card ── */
function EmployeeCard({
  employee,
  todayRiyadh,
  soonRiyadh,
  onEdit,
  onDelete,
  onViewLogs,
  onSuspend,
}) {
  const iqamaStatus = expiryStatus(
    employee.iqama_expiry_date,
    todayRiyadh,
    soonRiyadh,
  );
  const healthStatus = employee.health_card_issued
    ? expiryStatus(employee.health_card_expiry_date, todayRiyadh, soonRiyadh)
    : null;

  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/85`}>
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-slate-900 dark:text-white font-semibold truncate">
              {displayNameFor(employee)}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 truncate">
              {[employee.position || null, branchLabelFor(employee)]
                .filter((x) => x && x !== "-")
                .join(" · ") || "-"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <div className="text-[11px] text-slate-500 dark:text-white/45">رقم الإقامة</div>
          <div className="text-slate-800 dark:text-white/85" dir="ltr">
            {employee.iqama_number || "-"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-white/45">انتهاء الإقامة</div>
          <div className="flex items-center gap-1.5">
            <ExpiryDateDisplay
              gregorian={employee.iqama_expiry_date}
              calendar={employee.iqama_expiry_calendar}
              hijri={employee.iqama_expiry_hijri}
              tintClass="text-slate-800 dark:text-white/85"
            />
            <ExpiryBadge status={iqamaStatus} dateStr={employee.iqama_expiry_date} />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-white/45">كرت صحي</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <YesNoPill value={employee.health_card_issued} />
            {employee.health_card_issued && employee.health_card_expiry_date ? (
              <ExpiryDateDisplay
                gregorian={employee.health_card_expiry_date}
                calendar={employee.health_card_expiry_calendar}
                hijri={employee.health_card_expiry_hijri}
                tintClass="text-slate-800 dark:text-white/85 text-xs"
              />
            ) : null}
            <ExpiryBadge
              status={healthStatus}
              dateStr={employee.health_card_expiry_date}
            />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-white/45">الراتب الأساسي</div>
          <div className="text-slate-800 dark:text-white/85" dir="ltr">
            {formatMoney(employee.base_salary)}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
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
    </div>
  );
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
  const { todayRiyadh, soonRiyadh } = riyadhWindows();

  const headerCells = [
    "الاسم الرسمي",
    "الاسم الدارج",
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
        <div className="px-6 py-12 text-center text-slate-500 dark:text-white/45">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>لا يوجد موظفين</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (below lg) */}
      <div className="lg:hidden space-y-3">
        {employees.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            todayRiyadh={todayRiyadh}
            soonRiyadh={soonRiyadh}
            onEdit={onEdit}
            onDelete={onDelete}
            onViewLogs={onViewLogs}
            onSuspend={onSuspend}
          />
        ))}
      </div>

      {/* Desktop: full table (lg+) */}
      <div className={`hidden lg:block ${sectionCard}`}>
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
                const positionValue = employee.position || "-";
                const branchLabel = branchLabelFor(employee);

                const baseSalaryValue = formatMoney(employee.base_salary);
                const otherAllowancesValue = formatMoney(
                  employee.other_allowances,
                );

                const iqamaStatus = expiryStatus(
                  employee.iqama_expiry_date,
                  todayRiyadh,
                  soonRiyadh,
                );
                const healthStatus = employee.health_card_issued
                  ? expiryStatus(
                      employee.health_card_expiry_date,
                      todayRiyadh,
                      soonRiyadh,
                    )
                  : null;

                // Row tint: red if anything expired, amber if anything
                // expiring soon, otherwise the default hover surface.
                const anyExpired =
                  iqamaStatus === "expired" || healthStatus === "expired";
                const anySoon =
                  iqamaStatus === "soon" || healthStatus === "soon";
                const rowTint = anyExpired
                  ? "bg-red-500/[0.04] dark:bg-red-500/[0.07]"
                  : anySoon
                    ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.07]"
                    : "";

                const iqamaCellTint =
                  iqamaStatus === "expired"
                    ? "text-red-700 dark:text-red-300 font-semibold"
                    : iqamaStatus === "soon"
                      ? "text-amber-700 dark:text-amber-300 font-semibold"
                      : "text-slate-700 dark:text-white/75";

                return (
                  <tr
                    key={employee.id}
                    className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors ${rowTint}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/85`}>
                          <User className="w-5 h-5" />
                        </div>
                        <span className="text-slate-900 dark:text-white font-medium truncate">
                          {employee.name || "-"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-700 dark:text-white/75 whitespace-nowrap">
                      {displayNameFor(employee)}
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

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <ExpiryDateDisplay
                          gregorian={employee.iqama_expiry_date}
                          calendar={employee.iqama_expiry_calendar}
                          hijri={employee.iqama_expiry_hijri}
                          tintClass={iqamaCellTint}
                        />
                        <ExpiryBadge
                          status={iqamaStatus}
                          dateStr={employee.iqama_expiry_date}
                        />
                      </div>
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
                        employee.health_card_expiry_date ? (
                          <ExpiryDateDisplay
                            gregorian={employee.health_card_expiry_date}
                            calendar={employee.health_card_expiry_calendar}
                            hijri={employee.health_card_expiry_hijri}
                            tintClass="text-slate-700 dark:text-white/75 text-xs"
                          />
                        ) : null}
                        <ExpiryBadge
                          status={healthStatus}
                          dateStr={employee.health_card_expiry_date}
                        />
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
    </>
  );
}
