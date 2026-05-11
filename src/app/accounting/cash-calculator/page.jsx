"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  CalendarDays,
  Save,
  History,
  RefreshCw,
  Check,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import GlassSelect from "@/components/Workspace/GlassSelect";

/* ─── helpers ─── */

const DENOMINATIONS = [
  { key: "d500", label: "500", value: 500 },
  { key: "d200", label: "200", value: 200 },
  { key: "d100", label: "100", value: 100 },
  { key: "d50", label: "50", value: 50 },
  { key: "d20", label: "20", value: 20 },
  { key: "d10", label: "10", value: 10 },
  { key: "d5", label: "5", value: 5 },
  { key: "d1", label: "1", value: 1 },
];

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currentMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(m) {
  if (!m) return "—";
  try {
    const [y, mo] = m.split("-");
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "long",
    });
  } catch {
    return m;
  }
}

function generateMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const val = `${y}-${m}`;
    opts.push({ value: val, label: monthLabel(val) });
  }
  return opts;
}

function formatDateTime(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dt).replace("T", " ").slice(0, 16);
  }
}

/* ─── component ─── */

export default function CashCalculatorPage() {
  const { ready, isAuthenticated, user, employeeId } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const queryClient = useQueryClient();

  // Always fetch branches from cash-counts API (doesn't require can_manage_inventory)
  const allBranchesQuery = useQuery({
    queryKey: ["cashCalcBranches"],
    enabled: ready && isAuthenticated && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/cash-counts?branchId=list");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching branches, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return Array.isArray(data.branches) ? data.branches : [];
    },
  });

  const branches = useMemo(() => {
    return allBranchesQuery.data || [];
  }, [allBranchesQuery.data]);

  const defaultBranchId = useMemo(() => {
    if (branches.length === 1) return String(branches[0].id);
    if (branches.length > 0) return String(branches[0].id);
    return "";
  }, [branches]);

  const [branchId, setBranchId] = useState("");
  const [month, setMonth] = useState(currentMonth);

  // Denomination counts (local state)
  const [counts, setCounts] = useState({
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    d5: 0,
    d1: 0,
  });

  const [note, setNote] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [saved, setSaved] = useState(false);
  const logsRef = useRef(null);

  useEffect(() => {
    if (!branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [branchId, defaultBranchId]);

  // Fetch existing record for selected branch + month
  const recordQuery = useQuery({
    queryKey: ["cashCount", branchId, month],
    enabled: !!branchId && !!month,
    queryFn: async () => {
      const qs = new URLSearchParams({ branchId, month });
      const res = await adminFetch(
        `/api/accounting/cash-counts?${qs.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/cash-counts, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  // When record changes, populate the form
  useEffect(() => {
    const rec = recordQuery.data?.record;
    if (rec) {
      setCounts({
        d500: Number(rec.d500) || 0,
        d200: Number(rec.d200) || 0,
        d100: Number(rec.d100) || 0,
        d50: Number(rec.d50) || 0,
        d20: Number(rec.d20) || 0,
        d10: Number(rec.d10) || 0,
        d5: Number(rec.d5) || 0,
        d1: Number(rec.d1) || 0,
      });
      setNote(rec.note || "");
    } else if (recordQuery.data && !rec) {
      setCounts({
        d500: 0,
        d200: 0,
        d100: 0,
        d50: 0,
        d20: 0,
        d10: 0,
        d5: 0,
        d1: 0,
      });
      setNote("");
    }
    setSaved(false);
  }, [recordQuery.data]);

  // Calculate totals
  const denomTotals = useMemo(() => {
    const result = {};
    let grand = 0;
    for (const d of DENOMINATIONS) {
      const c = Number(counts[d.key]) || 0;
      const t = c * d.value;
      result[d.key] = t;
      grand += t;
    }
    result.grand = grand;
    return result;
  }, [counts]);

  const totalNotes = useMemo(() => {
    return DENOMINATIONS.reduce(
      (sum, d) => sum + (Number(counts[d.key]) || 0),
      0,
    );
  }, [counts]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/accounting/cash-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: Number(branchId),
          month,
          d500: counts.d500,
          d200: counts.d200,
          d100: counts.d100,
          d50: counts.d50,
          d20: counts.d20,
          d10: counts.d10,
          d5: counts.d5,
          d1: counts.d1,
          note,
          employeeId,
          employeeName: user?.name || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل في الحفظ");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cashCount", branchId, month],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleCountChange = useCallback((key, rawValue) => {
    const v = rawValue === "" ? 0 : parseInt(rawValue, 10);
    if (isNaN(v) || v < 0) return;
    setCounts((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleToggleLogs = useCallback(() => {
    setShowLogs((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          logsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
      return next;
    });
  }, []);

  const branchOptions = useMemo(() => {
    return branches.map((b) => ({ value: String(b.id), label: b.name }));
  }, [branches]);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const logs = recordQuery.data?.logs || [];

  const branchesLoading = isAdmin && branches.length === 0;
  const topBarClass = ws.topBar;
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const isSaving = saveMutation.isPending;
  const saveIcon = isSaving ? (
    <RefreshCw className="w-4 h-4" />
  ) : saved ? (
    <Check className="w-4 h-4" />
  ) : (
    <Save className="w-4 h-4" />
  );
  const saveLabel = isSaving ? "جاري الحفظ…" : saved ? "تم الحفظ" : "حفظ";
  const saveBtnExtra = saved
    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
    : "";

  /* ─── access guard ─── */
  if (ready && isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="cash-calculator" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[900px] space-y-4">
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/80`}>
              هذه الصفحة خاصة بالمحاسبة.
              <div className="mt-3">
                <a
                  href="/"
                  className={`${ws.btnNeutral} px-4 py-2 inline-flex`}
                >
                  رجوع
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ─── main render ─── */
  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="cash-calculator" />

      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Banknote className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white tracking-tight truncate">
                المحاسبة
              </div>
              <div className="text-xs text-white/50 truncate">حاسبة الكاش</div>
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
                <Banknote className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  حاسبة الكاش
                </div>
                <div className="text-white/55 mt-1">
                  حساب وتخزين فئات الكاش حسب الفرع والشهر
                </div>
              </div>
            </div>
          </div>

          {!ready ? (
            <div className={`${cardShell} text-white/70`}>جاري التحميل…</div>
          ) : !employeeId ? (
            <div className={`${cardShell} text-white/70`}>
              لازم تسجيل دخول الإدارة أولاً.
              <div className="mt-2">
                <a
                  href="/admin/login"
                  className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
                >
                  تسجيل دخول الإدارة
                </a>
              </div>
            </div>
          ) : branchesLoading && allBranchesQuery.isLoading ? (
            <div className={`${cardShell} text-white/70`}>
              جاري تحميل الفروع…
            </div>
          ) : branches.length === 0 ? (
            <div className={`${cardShell} text-white/70`}>
              لا يوجد فروع مرتبطة بهذا الحساب.
            </div>
          ) : (
            <>
              {/* Filters: Branch + Month */}
              <div className={cardShell}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`${ws.iconBox} w-10 h-10`}>
                    <Building2 className="w-5 h-5 text-white/70" />
                  </div>
                  <div>
                    <div className="font-bold text-white tracking-tight">
                      اختر الفرع والشهر
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      يتم حفظ الحاسبة لكل فرع وشهر بشكل منفصل
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-white/70 mb-2">
                      الفرع
                    </label>
                    <GlassSelect
                      value={branchId}
                      onChange={setBranchId}
                      options={branchOptions}
                      placeholder="اختر الفرع"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white/70 mb-2">
                      <CalendarDays className="inline w-4 h-4 ml-1 text-white/50" />
                      الشهر
                    </label>
                    <GlassSelect
                      value={month}
                      onChange={setMonth}
                      options={monthOptions}
                      placeholder="اختر الشهر"
                    />
                  </div>
                </div>
              </div>

              {/* Loading state */}
              {recordQuery.isLoading ? (
                <div
                  className={`${cardShell} text-white/70 flex items-center gap-2`}
                >
                  <RefreshCw className="w-4 h-4" />
                  جاري التحميل…
                </div>
              ) : recordQuery.error ? (
                <div className={`${cardShell} text-red-300`}>
                  {recordQuery.error?.message || "فشل تحميل البيانات"}
                </div>
              ) : (
                <>
                  {/* Calculator Table */}
                  <div className={cardShell}>
                    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                      <div className="font-bold text-white tracking-tight text-lg">
                        فئات الكاش
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleLogs}
                          className={`${showLogs ? "bg-sky-400/15 text-sky-200 border-sky-400/25" : ""} ${ws.btnNeutral} px-4 py-2.5 text-sm`}
                        >
                          <History className="w-4 h-4" />
                          {showLogs ? "إخفاء السجل" : "عرض السجل"}
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving || !branchId}
                          className={`${saveBtnExtra} ${ws.btnPrimary} px-5 py-2.5 text-sm`}
                        >
                          {saveIcon}
                          {saveLabel}
                        </button>
                      </div>
                    </div>

                    {saveMutation.error ? (
                      <div className="text-red-300 text-sm mb-3">
                        {saveMutation.error?.message || "فشل في الحفظ"}
                      </div>
                    ) : null}

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/70 border-b border-white/10">
                            <th className="text-right font-semibold py-3 px-3 w-[140px]">
                              الفئة (ريال)
                            </th>
                            <th className="text-right font-semibold py-3 px-3 w-[200px]">
                              العدد
                            </th>
                            <th className="text-right font-semibold py-3 px-3">
                              الإجمالي
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {DENOMINATIONS.map((d) => {
                            const total = denomTotals[d.key];
                            return (
                              <tr
                                key={d.key}
                                className="border-b border-white/[0.06] hover:bg-white/[0.03]"
                              >
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/15 flex items-center justify-center">
                                      <span className="text-emerald-200 font-bold text-xs">
                                        {d.label}
                                      </span>
                                    </div>
                                    <span className="text-white font-semibold">
                                      {d.label} ريال
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <input
                                    type="number"
                                    min="0"
                                    value={
                                      counts[d.key] === 0 ? "" : counts[d.key]
                                    }
                                    onChange={(e) =>
                                      handleCountChange(d.key, e.target.value)
                                    }
                                    placeholder="0"
                                    className={`${ws.input} px-4 py-2.5 max-w-[160px] text-center tabular-nums`}
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-white font-bold tabular-nums">
                                    {formatMoney(total)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-emerald-400/20">
                            <td className="py-4 px-3">
                              <span className="text-emerald-200 font-extrabold text-base">
                                المجموع الكلي
                              </span>
                            </td>
                            <td className="py-4 px-3">
                              <span className="text-white/60 font-semibold tabular-nums">
                                {totalNotes} ورقة
                              </span>
                            </td>
                            <td className="py-4 px-3">
                              <span className="text-emerald-200 font-extrabold text-xl tabular-nums">
                                {formatMoney(denomTotals.grand)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-3">
                      {DENOMINATIONS.map((d) => {
                        const total = denomTotals[d.key];
                        return (
                          <div
                            key={d.key}
                            className={`${ws.glass} ${ws.card} p-4`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-400/15 flex items-center justify-center">
                                  <span className="text-emerald-200 font-bold text-xs">
                                    {d.label}
                                  </span>
                                </div>
                                <span className="text-white font-semibold">
                                  {d.label} ريال
                                </span>
                              </div>
                              <span className="text-white font-bold tabular-nums">
                                {formatMoney(total)}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={counts[d.key] === 0 ? "" : counts[d.key]}
                              onChange={(e) =>
                                handleCountChange(d.key, e.target.value)
                              }
                              placeholder="0"
                              className={`${ws.input} px-4 py-2.5 text-center tabular-nums`}
                            />
                          </div>
                        );
                      })}

                      {/* Mobile total */}
                      <div
                        className={`${ws.glass} ${ws.card} p-4 border-2 !border-emerald-400/20`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-emerald-200 font-extrabold text-base">
                              المجموع الكلي
                            </div>
                            <div className="text-white/50 text-xs mt-1">
                              {totalNotes} ورقة
                            </div>
                          </div>
                          <span className="text-emerald-200 font-extrabold text-xl tabular-nums">
                            {formatMoney(denomTotals.grand)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Note */}
                    <div className="mt-5">
                      <label className="block text-sm font-semibold text-white/70 mb-2">
                        ملاحظة (اختياري)
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => {
                          setNote(e.target.value);
                          setSaved(false);
                        }}
                        placeholder="أضف ملاحظة…"
                        rows={2}
                        className={`${ws.input} px-4 py-3 resize-none`}
                      />
                    </div>
                  </div>

                  {/* Logs section - now right after calculator */}
                  {showLogs ? (
                    <div ref={logsRef} className={cardShell}>
                      <div className="flex items-center gap-2 mb-4">
                        <History className="w-5 h-5 text-white/60" />
                        <div className="font-bold text-white tracking-tight">
                          سجل التعديلات
                        </div>
                      </div>

                      {logs.length === 0 ? (
                        <div className="text-white/60 text-sm">
                          لا يوجد سجل تعديلات بعد لهذا الشهر.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {logs.map((log) => {
                            const isCreated = log.action === "created";
                            const actionText = isCreated ? "إنشاء" : "تعديل";
                            const actionPill = isCreated
                              ? `${ws.pill} bg-emerald-400/15 text-emerald-200 border-emerald-400/25`
                              : `${ws.pill} bg-sky-400/15 text-sky-200 border-sky-400/25`;

                            const vals =
                              typeof log.new_values === "string"
                                ? JSON.parse(log.new_values)
                                : log.new_values || {};

                            return (
                              <div
                                key={log.id}
                                className={`${ws.glass} ${ws.card} p-4`}
                              >
                                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className={actionPill}>
                                      {actionText}
                                    </span>
                                    <span className="text-white/80 font-semibold text-sm">
                                      {log.actor_name || "—"}
                                    </span>
                                  </div>
                                  <span className="text-white/50 text-xs">
                                    {formatDateTime(log.created_at)}
                                  </span>
                                </div>

                                {log.summary ? (
                                  <div className="text-white/60 text-sm mb-2">
                                    {log.summary}
                                  </div>
                                ) : null}

                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                  {DENOMINATIONS.map((d) => {
                                    const v = Number(vals[d.key]) || 0;
                                    return (
                                      <div
                                        key={d.key}
                                        className="bg-white/[0.04] rounded-xl p-2 text-center"
                                      >
                                        <div className="text-white/40 text-[10px]">
                                          {d.label}
                                        </div>
                                        <div className="text-white font-bold text-sm tabular-nums">
                                          {v}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-2 text-left">
                                  <span className="text-emerald-200 font-extrabold tabular-nums">
                                    {formatMoney(vals.total_amount || 0)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {DENOMINATIONS.map((d) => {
                      const c = Number(counts[d.key]) || 0;
                      const t = denomTotals[d.key];
                      return (
                        <div
                          key={d.key}
                          className={`${ws.glassSoft} ${ws.card} p-4 text-center`}
                        >
                          <div className="text-white/50 text-xs mb-1">
                            {d.label} ريال
                          </div>
                          <div className="text-white font-bold tabular-nums">
                            {c} <span className="text-white/40">×</span>
                          </div>
                          <div className="text-emerald-200 font-extrabold tabular-nums mt-1">
                            {formatMoney(t)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
