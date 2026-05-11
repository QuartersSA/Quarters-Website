"use client";

import { useMemo } from "react";
import { ScrollText, X, RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useHREmployeeLogs } from "@/hooks/useHREmployeeLogs";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  try {
    return d.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return d.toISOString();
  }
}

function formatDateOnly(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // if it's already like 2026-02-13
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  try {
    return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (e) {
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

  let pillClass = `${ws.pill} bg-white/[0.03] text-white/60 border-white/10`;
  if (action === "created") {
    pillClass = `${ws.pill} bg-emerald-500/10 text-emerald-200 border-emerald-500/20`;
  }
  if (action === "updated") {
    pillClass = `${ws.pill} bg-sky-500/10 text-sky-200 border-sky-500/20`;
  }
  if (action === "deleted") {
    pillClass = `${ws.pill} bg-red-500/10 text-red-200 border-red-500/20`;
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

  if (key === "iqama_expiry_date") {
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
    } catch (e) {
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
  if (!value) return [];
  if (!Array.isArray(value)) return [];
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

  // de-dupe
  const set = new Set(names);
  return Array.from(set);
}

function ChangesPreview({ changes }) {
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
      position: "المنصب",
      base_salary: "الراتب الأساسي",
      other_allowances: "بدلات أخرى",
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

  if (!hasAnything) {
    return null;
  }

  const branchFrom = showBranches ? branches.from : null;
  const branchTo = showBranches ? branches.to : null;

  const branchFromNames = normalizeBranchNames(branchFrom);
  const branchToNames = normalizeBranchNames(branchTo);
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
    <details className="mt-3">
      <summary className="cursor-pointer text-white/70 hover:text-white">
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

              // In RTL text, a right-arrow can *look* backwards. Use a left-arrow for RTL values
              // so the change reads correctly from (قبل) -> (بعد) for Arabic.
              const arrow = valueDir === "ltr" ? "→" : "←";

              return (
                <div key={key} className="text-sm text-white/75">
                  <span className="font-semibold text-white/85">{label}</span>
                  <span className="mx-2 text-white/40">:</span>
                  <span className="text-white/60" dir={valueDir}>
                    {fromText}
                  </span>
                  <span className="mx-2 text-white/40" dir="ltr">
                    {arrow}
                  </span>
                  <span className="text-white/90" dir={valueDir}>
                    {toText}
                  </span>
                </div>
              );
            })
          : null}

        {showBranches ? (
          <div className="text-sm text-white/75">
            <span className="font-semibold text-white/85">
              {fieldLabels.branches}
            </span>
            <span className="mx-2 text-white/40">:</span>
            {hasBranchDelta ? (
              <div className="mt-2 space-y-1">
                {addedBranches.length > 0 ? (
                  <div className="text-emerald-200/90">
                    تمت الإضافة:{" "}
                    <span className="text-white/90">
                      {addedBranches.join("، ")}
                    </span>
                  </div>
                ) : null}
                {removedBranches.length > 0 ? (
                  <div className="text-red-200/90">
                    تمت الإزالة:{" "}
                    <span className="text-white/90">
                      {removedBranches.join("، ")}
                    </span>
                  </div>
                ) : null}
                <div className="text-white/60">
                  قبل:{" "}
                  <span className="text-white/80" dir="ltr">
                    {branchFromText}
                  </span>
                </div>
                <div className="text-white/60">
                  بعد:{" "}
                  <span className="text-white/90" dir="ltr">
                    {branchToText}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <span className="text-white/60" dir="ltr">
                  {branchFromText}
                </span>
                <span className="mx-2 text-white/40" dir="ltr">
                  →
                </span>
                <span className="text-white/90" dir="ltr">
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

export function HREmployeeLogsModal({ isOpen, employee, onClose }) {
  const employeeId = employee?.id;
  const employeeName = employee?.name;

  const { logs, isLoadingLogs, logsError, refetchLogs } = useHREmployeeLogs({
    employeeId,
    enabled: isOpen,
  });

  const logsList = Array.isArray(logs) ? logs : [];

  if (!isOpen) return null;

  const title = employeeName ? `سجل الموظف: ${employeeName}` : "سجل الموظف";

  let content = null;
  if (isLoadingLogs) {
    content = (
      <div className="text-center text-white/60 py-12">جاري تحميل السجل…</div>
    );
  } else if (logsError) {
    content = (
      <div className="text-center text-red-100 py-10">
        تعذر تحميل السجل. حاول مرة ثانية.
      </div>
    );
  } else if (logsList.length === 0) {
    content = (
      <div className="text-center text-white/60 py-12">
        لا يوجد سجل حتى الآن
      </div>
    );
  } else {
    content = (
      <div className="space-y-3">
        {logsList.map((log) => {
          const createdAt = formatDateTime(log.created_at);
          const actor = log.actor_name || "—";
          const summary = log.summary || "";

          return (
            <div
              key={log.id}
              className={`${ws.glass} ${ws.card} p-4 border border-white/10`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ActionPill action={log.action} />
                  <div className="text-white/80 text-sm">
                    بواسطة <span className="font-semibold">{actor}</span>
                  </div>
                </div>

                <div className="text-white/45 text-sm" dir="ltr">
                  {createdAt}
                </div>
              </div>

              {summary ? (
                <div className="mt-2 text-white/75 text-sm">{summary}</div>
              ) : null}

              <ChangesPreview changes={log.changes} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      dir="rtl"
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-3xl max-h-[90svh] overflow-hidden`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-white/85`}>
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{title}</div>
              <div className="text-sm text-white/55">آخر 200 حركة</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchLogs()}
              className={`${ws.iconButton} text-white/70`}
              aria-label="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.iconButton} text-white/70`}
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90svh-84px)]">
          {content}
        </div>
      </div>
    </div>
  );
}
