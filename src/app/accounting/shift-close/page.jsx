"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Building2, Info } from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function diffLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0)
    return { label: "متطابق", tone: "neutral" };
  if (n < 0) return { label: "عجز", tone: "bad" };
  return { label: "زيادة", tone: "good" };
}

function pillClassForTone(tone) {
  if (tone === "good") {
    return `${ws.pill} bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/25`;
  }
  if (tone === "bad") {
    return `${ws.pill} bg-red-500/15 text-red-700 dark:text-red-200 border-red-500/25`;
  }
  return `${ws.pill} bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10`;
}

export default function ShiftClosePage() {
  const { ready, employeeId, user, isAuthenticated } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const branchesFromUser = Array.isArray(user?.branches) ? user.branches : [];

  const allBranchesQuery = useQuery({
    queryKey: ["allBranchesForShiftClose"],
    enabled: isAdmin && branchesFromUser.length === 0,
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/branches, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return Array.isArray(data) ? data : [];
    },
  });

  const branches = useMemo(() => {
    if (branchesFromUser.length > 0) {
      return branchesFromUser;
    }
    if (isAdmin) {
      return allBranchesQuery.data || [];
    }
    return [];
  }, [branchesFromUser, isAdmin, allBranchesQuery.data]);

  const defaultBranchId = useMemo(() => {
    // Admin: default to all branches so they instantly see the latest closings.
    if (isAdmin) return "all";
    if (branches.length === 1) return String(branches[0].id);
    if (branches.length > 0) return String(branches[0].id);
    return "";
  }, [branches, isAdmin]);

  const [branchId, setBranchId] = useState(defaultBranchId);

  React.useEffect(() => {
    if (!branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [branchId, defaultBranchId]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const closingsQuery = useQuery({
    queryKey: ["shiftClosings_admin", employeeId, branchId, from, to],
    enabled: !!employeeId && isAdmin && (!!branchId || branchId === "all"),
    queryFn: async () => {
      const qs = new URLSearchParams({
        employeeId: String(employeeId),
      });

      // For admins: allow querying all branches by omitting branchId
      if (branchId && branchId !== "all") {
        qs.set("branchId", String(branchId));
      }

      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const res = await adminFetch(
        `/api/accounting/shift-closings?${qs.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/shift-closings, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  const closings = closingsQuery.data?.closings || [];

  const branchOptions = useMemo(() => {
    const options = branches.map((b) => ({
      value: String(b.id),
      label: b.name,
    }));

    // Admin has an "All branches" option
    const adminAll = isAdmin ? [{ value: "all", label: "كل الفروع" }] : [];
    const requiredPlaceholder = isAdmin ? [] : [{ value: "", label: "—" }];

    return [...requiredPlaceholder, ...adminAll, ...options];
  }, [branches, isAdmin]);

  const tableRows = useMemo(() => {
    return closings.map((c) => {
      const cashDiff = Number(c.cash_diff);
      const cardDiff = Number(c.card_diff);
      const totalDiff = Number(c.total_diff);

      return {
        id: c.id,
        shift_date: c.shift_date,
        shift_label: c.shift_label || "—",
        branch_name: c.branch_name || "—",
        employee_name: c.employee_name || "—",
        actual_cash: formatMoney(c.actual_cash),
        actual_card: formatMoney(c.actual_card),
        foodics_cash: formatMoney(c.foodics_cash),
        foodics_card: formatMoney(c.foodics_card),
        cashDiff,
        cardDiff,
        totalDiff,
        note: c.note || "",
      };
    });
  }, [closings]);

  const topBarClass = ws.topBar;
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const infoCard = (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-700 dark:text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900 dark:text-white tracking-tight">ملاحظة</div>
          <div className="text-sm text-slate-600 dark:text-white/60 mt-1 leading-6">
            هذه الصفحة للمحاسبة فقط، وتعرض تقفيلات الشفت المرسلة من صفحة الكاشير
            (
            <a className="underline" href="/shift-close/login">
              /shift-close/login
            </a>
            ).
          </div>
        </div>
      </div>
    </div>
  );

  const branchesLoading = isAdmin && branchesFromUser.length === 0;

  if (ready && isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="shift-close" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[900px] space-y-4">
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-800 dark:text-white/80`}>
              هذه الصفحة خاصة بالمحاسبة.
              <div className="mt-3">
                <a
                  href="/shift-close/login"
                  className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
                >
                  الذهاب لصفحة الكاشير
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="shift-close" />

      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Calculator className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
                المحاسبة
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 truncate">
                تقفيلة الشفت — السجل
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={ws.iconBox}>
                <Calculator className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  المحاسبة
                </div>
                <div className="text-slate-600 dark:text-white/55 mt-1">تقفيلة الشفت — السجل</div>
              </div>
            </div>
          </div>

          {infoCard}

          {!ready ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
              جاري التحميل…
            </div>
          ) : !employeeId ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
              لازم تسجيل دخول الإدارة أولًا.
              <div className="mt-2">
                <a
                  href="/admin/login"
                  className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
                >
                  تسجيل دخول الإدارة
                </a>
              </div>
            </div>
          ) : !isAdmin ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
              هذه الصفحة للمحاسبة فقط.
            </div>
          ) : branchesLoading && allBranchesQuery.isLoading ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
              جاري تحميل الفروع…
            </div>
          ) : branchesLoading && allBranchesQuery.error ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-red-700 dark:text-red-300`}>
              {allBranchesQuery.error?.message || "فشل تحميل الفروع"}
            </div>
          ) : branches.length === 0 ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
              لا يوجد فروع مرتبطة بهذا الحساب.
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className={cardShell}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className={`${ws.iconBox} w-10 h-10`}>
                      <Building2 className="w-5 h-5 text-slate-700 dark:text-white/70" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                        فلترة السجل
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
                        حسب الفرع — آخر 250 سجل
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="w-full sm:w-[220px]">
                      <GlassDatePicker
                        value={from}
                        onChange={setFrom}
                        placeholder="من"
                        allowClear
                      />
                    </div>
                    <div className="w-full sm:w-[220px]">
                      <GlassDatePicker
                        value={to}
                        onChange={setTo}
                        placeholder="إلى"
                        allowClear
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFrom("");
                        setTo("");
                      }}
                      className={`${ws.btnNeutral} px-4 py-2.5 justify-center`}
                    >
                      مسح
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                    الفرع
                  </label>
                  <div className="relative">
                    <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/35" />

                    {/* Use themed GlassSelect everywhere (matches "تحليل الجرد حسب الصنف") */}
                    <GlassSelect
                      value={branchId}
                      onChange={setBranchId}
                      options={branchOptions}
                      buttonClassName="pr-11"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className={cardShell}>
                <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                  جدول تقفيلات الشفت
                </div>

                <div className="mt-4 overflow-x-auto">
                  {closingsQuery.isLoading ? (
                    <div className="text-slate-600 dark:text-white/60">جاري التحميل…</div>
                  ) : closingsQuery.error ? (
                    <div className="text-red-700 dark:text-red-300">
                      {closingsQuery.error?.message || "فشل تحميل السجل"}
                    </div>
                  ) : tableRows.length === 0 ? (
                    <div className="text-slate-600 dark:text-white/60">لا يوجد سجلات بعد.</div>
                  ) : (
                    <table className="min-w-[1200px] w-full text-sm">
                      <thead>
                        <tr className="text-slate-700 dark:text-white/70">
                          <th className="text-right font-semibold py-2 px-3">
                            التاريخ
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الفرع
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الشفت
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الموظف
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الكاش الفعلي
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الشبكة الفعلية
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            كاش فودكس
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            شبكة فودكس
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            فرق الكاش
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            فرق الشبكة
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            الإجمالي
                          </th>
                          <th className="text-right font-semibold py-2 px-3">
                            ملاحظة
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((r) => {
                          const cash = diffLabel(r.cashDiff);
                          const card = diffLabel(r.cardDiff);
                          const total = diffLabel(r.totalDiff);

                          return (
                            <tr
                              key={r.id}
                              className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                            >
                              <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                                {r.shift_date || "—"}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.branch_name}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.shift_label}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.employee_name}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.actual_cash}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.actual_card}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.foodics_cash}
                              </td>
                              <td className="py-3 px-3 text-slate-700 dark:text-white/70">
                                {r.foodics_card}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-800 dark:text-white/85 font-semibold">
                                    {formatMoney(r.cashDiff)}
                                  </span>
                                  <span className={pillClassForTone(cash.tone)}>
                                    {cash.label}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-800 dark:text-white/85 font-semibold">
                                    {formatMoney(r.cardDiff)}
                                  </span>
                                  <span className={pillClassForTone(card.tone)}>
                                    {card.label}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-900 dark:text-white font-extrabold">
                                    {formatMoney(r.totalDiff)}
                                  </span>
                                  <span
                                    className={pillClassForTone(total.tone)}
                                  >
                                    {total.label}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-white/55 max-w-[240px] truncate">
                                {r.note || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
