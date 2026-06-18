"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trash2,
  Filter,
  ChevronDown,
  Building2,
  User,
  Clock,
  StickyNote,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney } from "@/utils/payrollFormatters";

/* Riyadh-local timestamp. Avoid toLocaleString("ar-SA") — it scrambles in RTL. */
function fmtDateTime(value) {
  if (!value) return "—";
  try {
    const p = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Riyadh",
    }).formatToParts(new Date(value));
    const g = (t) => p.find((x) => x.type === t)?.value || "";
    let h = g("hour");
    if (h === "24") h = "00";
    return `${g("year")}/${g("month")}/${g("day")} ${h}:${g("minute")}`;
  } catch {
    return String(value);
  }
}

/* ── Mobile Header ── */
function WasteMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <Trash2 className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">
          تقرير الهدر
        </div>
        <div className="text-xs text-slate-500 dark:text-white/50">
          عمليات هدر المخزون وتكلفتها
        </div>
      </div>
    </div>
  );
}

/* ── Desktop Header ── */
function WasteDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={ws.iconBox}>
          <Trash2 className="w-6 h-6 text-emerald-700 dark:text-emerald-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            تقرير الهدر
          </h1>
          <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">
            كل عملية هدر مسجلة مع الأصناف وتكلفتها بسعر التكلفة وقت التسجيل.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotAccountingCard() {
  return (
    <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
      هذا القسم متاح فقط لمستخدمي المحاسبة.
    </div>
  );
}

function LoginCard() {
  return (
    <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
      الرجاء تسجيل الدخول.
    </div>
  );
}

/* ── Single waste operation card (expandable) ── */
function WasteOperationCard({ op }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(op?.items) ? op.items : [];

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-right p-4 flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              <Building2 className="w-4 h-4 text-slate-400 dark:text-white/40" />
              {op.branch_name || "—"}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-white/70">
              <User className="w-4 h-4 text-slate-400 dark:text-white/40" />
              {op.employee_name || "—"}
            </div>
            <div
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50"
              dir="ltr"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
              {fmtDateTime(op.created_at)}
            </div>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-white/45">
            عدد الأصناف: {Number(op.items_count || 0)}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-left">
            <div className="text-[11px] text-slate-500 dark:text-white/40">التكلفة</div>
            <div
              className="text-base font-bold text-emerald-700 dark:text-emerald-200"
              dir="ltr"
            >
              {formatMoney(op.total_cost)} ر.س
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 dark:text-white/40 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-white/10">
          {op.note ? (
            <div className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-white/75">
              <StickyNote className="w-4 h-4 mt-0.5 text-slate-400 dark:text-white/40 flex-shrink-0" />
              <span>{op.note}</span>
            </div>
          ) : null}

          <div className={`${ws.innerCard} mt-3 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-white/45 border-b border-slate-200 dark:border-white/10">
                    <th className="text-right font-semibold px-3 py-2">الصنف</th>
                    <th className="text-left font-semibold px-3 py-2">الكمية</th>
                    <th className="text-left font-semibold px-3 py-2">تكلفة الوحدة</th>
                    <th className="text-left font-semibold px-3 py-2">التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-slate-500 dark:text-white/45"
                      >
                        لا توجد أصناف
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-slate-200/60 dark:border-white/[0.06] last:border-0"
                      >
                        <td className="px-3 py-2 text-slate-800 dark:text-white/85">
                          {it.item_name || "—"}
                        </td>
                        <td className="px-3 py-2 text-left text-slate-700 dark:text-white/70" dir="ltr">
                          {formatMoney(it.quantity)}
                        </td>
                        <td className="px-3 py-2 text-left text-slate-700 dark:text-white/70" dir="ltr">
                          {formatMoney(it.unit_cost)} ر.س
                        </td>
                        <td className="px-3 py-2 text-left font-semibold text-emerald-700 dark:text-emerald-200" dir="ltr">
                          {formatMoney(it.cost)} ر.س
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WastePage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const canManage = isAdmin && user?.can_manage_accounting !== false;

  const [branchFilter, setBranchFilter] = useState("");

  const branchesQuery = useQuery({
    queryKey: ["accounting-waste-branches"],
    enabled: !!employeeId && canManage,
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الفروع");
      }
      return Array.isArray(data) ? data : [];
    },
  });
  const branches = branchesQuery.data || [];

  const wasteQuery = useQuery({
    queryKey: ["accounting-waste", branchFilter || null],
    enabled: !!employeeId && canManage,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (branchFilter) qs.set("branchId", String(branchFilter));
      const url = qs.toString() ? `/api/waste?${qs.toString()}` : "/api/waste";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل تقارير الهدر");
      }
      return data;
    },
  });

  const operations = wasteQuery.data?.operations || [];
  const summary = wasteQuery.data?.summary || {
    operations_count: 0,
    total_cost: 0,
  };

  const branchOptions = useMemo(
    () => [
      { value: "", label: "جميع الفروع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = <LoginCard />;
  } else if (!canManage) {
    body = <NotAccountingCard />;
  } else {
    body = (
      <>
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`${ws.glass} ${ws.card} p-4`}>
            <div className="text-xs text-slate-600 dark:text-white/55">عدد عمليات الهدر</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {Number(summary.operations_count || 0)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-4`}>
            <div className="text-xs text-slate-600 dark:text-white/55">إجمالي تكلفة الهدر</div>
            <div
              className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 mt-1"
              dir="ltr"
            >
              {formatMoney(summary.total_cost)} ر.س
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-slate-600 dark:text-white/55 text-xs">
              <Filter className="w-4 h-4" />
              تصفية
            </div>
            <div className="min-w-[200px]">
              <GlassSelect
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchOptions}
                buttonClassName="text-sm py-2 px-3"
              />
            </div>
          </div>
        </div>

        {/* Operations list */}
        {wasteQuery.isLoading ? (
          <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
            جاري التحميل…
          </div>
        ) : wasteQuery.isError ? (
          <div className={`${ws.glass} ${ws.card} p-6 text-red-600 dark:text-red-300`}>
            {wasteQuery.error?.message || "حدث خطأ أثناء تحميل البيانات."}
          </div>
        ) : operations.length === 0 ? (
          <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
            لا توجد عمليات هدر
          </div>
        ) : (
          <div className="space-y-3">
            {operations.map((op) => (
              <WasteOperationCard key={op.id} op={op} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="waste" />

      <WasteMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <WasteDesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
