"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useHREmployeeLogs } from "@/hooks/useHREmployeeLogs";

// Reusable activity-log renderer for a single employee. Used both
// by the standalone HREmployeeLogsModal (opened from the table) and
// embedded inline inside HREmployeeModal so the operator sees the
// employee's full change history in the same popup they edit from.

// Build a fixed "YYYY/MM/DD HH:mm" string in Asia/Riyadh. The old
// `toLocaleString("ar-SA-…")` produced an Arabic-comma'd string whose
// day/month/year got reordered by RTL rendering into garbage like
// "25، 09:38 ·2026/05/". formatToParts lets us assemble the pieces
// ourselves in a stable LTR order, and the caller renders it dir=ltr.
function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Riyadh",
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const y = get("year");
    const mo = get("month");
    const da = get("day");
    let hh = get("hour");
    if (hh === "24") hh = "00"; // some engines emit 24 for midnight
    const mi = get("minute");
    if (!y || !mo || !da) return d.toISOString().slice(0, 16).replace("T", " ");
    return `${y}/${mo}/${da} ${hh}:${mi}`;
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function formatDateOnly(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  try {
    return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function actionToLabel(action) {
  if (action === "created") return "إنشاء";
  if (action === "updated") return "تحديث";
  if (action === "deleted") return "حذف";
  return action || "-";
}

function ActionPill({ action }) {
  const label = actionToLabel(action);
  let pillClass = `${ws.pill} bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10`;
  if (action === "created") {
    pillClass = `${ws.pill} bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20`;
  }
  if (action === "updated") {
    pillClass = `${ws.pill} bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/20`;
  }
  if (action === "deleted") {
    pillClass = `${ws.pill} bg-red-500/10 text-red-700 dark:text-red-200 border-red-500/20`;
  }
  return <span className={pillClass}>{label}</span>;
}

function safeText(value) {
  if (value === null || value === undefined) return "-";
  if (value === "") return "-";
  return String(value);
}

function formatValueForField(key, value) {
  if (value === null || value === undefined || value === "") return "-";

  const booleanKeys = new Set([
    "sponsorship_transferred",
    "work_card_issued",
    "medical_check_issued",
    "health_card_issued",
  ]);

  if (booleanKeys.has(key)) {
    return value ? "نعم" : "لا";
  }

  if (key === "iqama_expiry_date" || key === "health_card_expiry_date") {
    return formatDateOnly(value);
  }

  if (key === "base_salary" || key === "other_allowances") {
    const n = Number(value);
    if (!Number.isFinite(n)) return safeText(value);
    try {
      return n.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } catch {
      return String(n);
    }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    const first = value[0];
    const isObj = first && typeof first === "object";
    if (isObj) {
      const names = value
        .map((v) => (v?.name ? String(v.name) : (v?.id ?? null)))
        .filter((v) => v !== null && v !== undefined);
      if (names.length === 0) return "-";
      return names.join("، ");
    }
    return value.map((v) => safeText(v)).join("، ");
  }

  return safeText(value);
}

function normalizeBranchNames(value) {
  if (!value || !Array.isArray(value)) return [];
  const names = value
    .map((v) => {
      if (v && typeof v === "object") {
        if (v.name) return String(v.name);
        if (v.id !== undefined && v.id !== null) return `#${v.id}`;
        return null;
      }
      if (typeof v === "number") return `#${v}`;
      if (typeof v === "string") return v;
      return null;
    })
    .filter(Boolean);
  return Array.from(new Set(names));
}

function ChangesPreview({ changes, defaultOpen = false }) {
  const fieldLabels = useMemo(
    () => ({
      name: "الاسم",
      phone: "الجوال",
      iqama_number: "رقم الإقامة",
      iqama_expiry_date: "انتهاء الإقامة",
      sponsorship_transferred: "تم نقل الكفالة",
      work_card_issued: "تم إصدار كرت عمل",
      medical_check_issued: "تم إصدار كشف طبي",
      health_card_issued: "تم إصدار كرت صحي",
      health_card_expiry_date: "انتهاء الكرت الصحي",
      position: "المنصب",
      base_salary: "الراتب الأساسي",
      other_allowances: "بدلات أخرى",
      start_date: "تاريخ المباشرة",
      branches: "الفرع",
    }),
    [],
  );

  const fields = changes && typeof changes === "object" ? changes.fields : null;
  const fieldEntries =
    fields && typeof fields === "object" ? Object.entries(fields) : [];

  const branches =
    changes && typeof changes === "object" ? changes.branches : null;
  const showBranches = branches && typeof branches === "object";

  const hasFields = fieldEntries.length > 0;
  const hasAnything = hasFields || showBranches;
  if (!hasAnything) return null;

  const branchFromNames = normalizeBranchNames(
    showBranches ? branches.from : null,
  );
  const branchToNames = normalizeBranchNames(
    showBranches ? branches.to : null,
  );
  const branchFromText =
    branchFromNames.length > 0 ? branchFromNames.join("، ") : "-";
  const branchToText =
    branchToNames.length > 0 ? branchToNames.join("، ") : "-";

  const branchFromSet = new Set(branchFromNames);
  const branchToSet = new Set(branchToNames);
  const addedBranches = branchToNames.filter((n) => !branchFromSet.has(n));
  const removedBranches = branchFromNames.filter((n) => !branchToSet.has(n));
  const hasBranchDelta = addedBranches.length > 0 || removedBranches.length > 0;

  return (
    <details className="mt-3" open={defaultOpen}>
      <summary className="cursor-pointer text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white">
        عرض التفاصيل
      </summary>
      <div className="mt-3 space-y-2">
        {hasFields
          ? fieldEntries.map(([key, v]) => {
              const label = fieldLabels[key] || key;
              const fromValue = v && typeof v === "object" ? v.from : null;
              const toValue = v && typeof v === "object" ? v.to : null;
              const fromText = formatValueForField(key, fromValue);
              const toText = formatValueForField(key, toValue);
              const valueDir =
                key === "phone" || key === "iqama_number" ? "ltr" : "rtl";
              const arrow = valueDir === "ltr" ? "→" : "←";

              return (
                <div key={key} className="text-sm text-slate-700 dark:text-white/75">
                  <span className="font-semibold text-slate-800 dark:text-white/85">
                    {label}
                  </span>
                  <span className="mx-2 text-slate-500 dark:text-white/40">:</span>
                  <span className="text-slate-600 dark:text-white/60" dir={valueDir}>
                    {fromText}
                  </span>
                  <span className="mx-2 text-slate-500 dark:text-white/40" dir="ltr">
                    {arrow}
                  </span>
                  <span className="text-slate-900 dark:text-white/90" dir={valueDir}>
                    {toText}
                  </span>
                </div>
              );
            })
          : null}

        {showBranches ? (
          <div className="text-sm text-slate-700 dark:text-white/75">
            <span className="font-semibold text-slate-800 dark:text-white/85">
              {fieldLabels.branches}
            </span>
            <span className="mx-2 text-slate-500 dark:text-white/40">:</span>
            {hasBranchDelta ? (
              <div className="mt-2 space-y-1">
                {addedBranches.length > 0 ? (
                  <div className="text-emerald-700 dark:text-emerald-200/90">
                    تمت الإضافة:{" "}
                    <span className="text-slate-900 dark:text-white/90">
                      {addedBranches.join("، ")}
                    </span>
                  </div>
                ) : null}
                {removedBranches.length > 0 ? (
                  <div className="text-red-700 dark:text-red-200/90">
                    تمت الإزالة:{" "}
                    <span className="text-slate-900 dark:text-white/90">
                      {removedBranches.join("، ")}
                    </span>
                  </div>
                ) : null}
                <div className="text-slate-600 dark:text-white/60">
                  قبل:{" "}
                  <span className="text-slate-800 dark:text-white/80" dir="ltr">
                    {branchFromText}
                  </span>
                </div>
                <div className="text-slate-600 dark:text-white/60">
                  بعد:{" "}
                  <span className="text-slate-900 dark:text-white/90" dir="ltr">
                    {branchToText}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <span className="text-slate-600 dark:text-white/60" dir="ltr">
                  {branchFromText}
                </span>
                <span className="mx-2 text-slate-500 dark:text-white/40" dir="ltr">
                  →
                </span>
                <span className="text-slate-900 dark:text-white/90" dir="ltr">
                  {branchToText}
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Body content of an employee's activity log. Self-fetches via
 * useHREmployeeLogs. `enabled` gates the query (e.g. only while the
 * containing modal is open). `compact` tightens spacing for the
 * embedded-in-edit-modal case.
 */
export function HREmployeeLogPanel({ employeeId, enabled = true, compact = false }) {
  const { logs, isLoadingLogs, logsError, refetchLogs } = useHREmployeeLogs({
    employeeId,
    enabled,
  });

  const logsList = Array.isArray(logs) ? logs : [];

  if (isLoadingLogs) {
    return (
      <div className="text-center text-slate-600 dark:text-white/60 py-8">
        جاري تحميل السجل…
      </div>
    );
  }
  if (logsError) {
    return (
      <div className="text-center text-red-800 dark:text-red-100 py-6">
        <div>تعذر تحميل السجل.</div>
        <button
          type="button"
          onClick={() => refetchLogs()}
          className={`${ws.btnNeutral} mt-3 px-4 py-2 inline-flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </button>
      </div>
    );
  }
  if (logsList.length === 0) {
    return (
      <div className="text-center text-slate-600 dark:text-white/60 py-8">
        لا يوجد سجل حتى الآن
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {logsList.map((log) => {
        const createdAt = formatDateTime(log.created_at);
        const actor = log.actor_name || "—";
        const summary = log.summary || "";
        return (
          <div
            key={log.id}
            className={`${ws.glassSoft} ${ws.card} ${compact ? "p-3" : "p-4"} border border-slate-200 dark:border-white/10`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <ActionPill action={log.action} />
                <div className="text-slate-800 dark:text-white/80 text-sm">
                  بواسطة <span className="font-semibold">{actor}</span>
                </div>
              </div>
              <div className="text-slate-500 dark:text-white/45 text-sm" dir="ltr">
                {createdAt}
              </div>
            </div>
            {summary ? (
              <div className="mt-2 text-slate-700 dark:text-white/75 text-sm">
                {summary}
              </div>
            ) : null}
            <ChangesPreview changes={log.changes} />
          </div>
        );
      })}
    </div>
  );
}

export default HREmployeeLogPanel;
