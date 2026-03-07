"use client";

import React, { useMemo, useState } from "react";
import {
  Receipt,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  Info,
  Banknote,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import {
  buildRecentMonthOptions,
  monthLabel,
  formatMoney,
} from "@/utils/payrollFormatters";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { ExpenseForm } from "@/components/Accounting/ExpenseForm";
import { ExpenseTable } from "@/components/Accounting/ExpenseTable";
import {
  useExpensesData,
  useExpenseTypes,
  useCreateExpense,
  useUpdateExpense,
  useConfirmExpense,
  useDeleteExpense,
  useCreateExpenseType,
} from "@/hooks/useExpensesData";

/* ── Mobile Header ── */
function ExpensesMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
        <Receipt className="w-5 h-5 text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-white tracking-tight">المصروفات</div>
        <div className="text-xs text-white/50">تسجيل وإدارة المصروفات</div>
      </div>
    </div>
  );
}

/* ── Desktop Header ── */
function ExpensesDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Receipt className="w-6 h-6 text-emerald-200" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          المصروفات
        </h1>
        <p className="text-white/50 text-sm mt-0.5">
          تسجيل وإدارة المصروفات الشهرية
        </p>
      </div>
    </div>
  );
}

/* ── Info Card ── */
function ExpensesInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white tracking-tight">ملاحظة</div>
          <div className="text-sm text-white/60 mt-1 leading-6">
            أضف المصروفات من قسم «تسجيل المصروفات» ثم راجعها وأكّدها من قسم «رفع
            المصروفات» حسب الشهر.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stats Cards ── */
function ExpensesStatsCards({ expenses }) {
  const stats = useMemo(() => {
    const totalCount = expenses.length;
    const confirmedCount = expenses.filter((e) => e.is_confirmed).length;
    const pendingCount = totalCount - confirmedCount;
    const totalAmount = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const confirmedAmount = expenses
      .filter((e) => e.is_confirmed)
      .reduce((s, e) => s + Number(e.confirmed_amount || e.amount || 0), 0);
    const pendingAmount = totalAmount - confirmedAmount;

    // Group by type
    const byType = {};
    for (const e of expenses) {
      const tName = e.expense_type_name || "أخرى";
      if (!byType[tName]) byType[tName] = 0;
      byType[tName] += Number(e.amount || 0);
    }

    // Find top type
    let topTypeName = "—";
    let topTypeAmount = 0;
    for (const [name, amt] of Object.entries(byType)) {
      if (amt > topTypeAmount) {
        topTypeName = name;
        topTypeAmount = amt;
      }
    }

    return {
      totalCount,
      confirmedCount,
      pendingCount,
      totalAmount,
      confirmedAmount,
      pendingAmount,
      topTypeName,
      topTypeAmount,
    };
  }, [expenses]);

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="flex items-center gap-1 text-xs text-white/55">
            <Banknote className="w-3 h-3 text-emerald-400" />
            إجمالي المصروفات
          </div>
          <div className="text-white font-extrabold mt-1" dir="ltr">
            {formatMoney(stats.totalAmount)}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            {stats.totalCount} مصروف
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="flex items-center gap-1 text-xs text-white/55">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            تم التأكيد
          </div>
          <div className="text-emerald-200 font-extrabold mt-1" dir="ltr">
            {formatMoney(stats.confirmedAmount)}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            {stats.confirmedCount} / {stats.totalCount}
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="flex items-center gap-1 text-xs text-white/55">
            <Clock className="w-3 h-3 text-amber-400" />
            بانتظار التأكيد
          </div>
          <div className="text-amber-200 font-extrabold mt-1" dir="ltr">
            {formatMoney(stats.pendingAmount)}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            {stats.pendingCount} مصروف
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="flex items-center gap-1 text-xs text-white/55">
            <TrendingUp className="w-3 h-3 text-sky-400" />
            أعلى نوع مصروف
          </div>
          <div className="text-white font-extrabold mt-1 text-sm truncate">
            {stats.topTypeName}
          </div>
          <div className="text-xs text-white/40 mt-0.5" dir="ltr">
            {formatMoney(stats.topTypeAmount)}
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="text-xs text-white/55">نسبة التأكيد</div>
          <div className="text-white font-extrabold mt-1">
            {stats.totalCount > 0
              ? `${Math.round((stats.confirmedCount / stats.totalCount) * 100)}%`
              : "—"}
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-400 h-1.5 rounded-full transition-all"
              style={{
                width:
                  stats.totalCount > 0
                    ? `${Math.round((stats.confirmedCount / stats.totalCount) * 100)}%`
                    : "0%",
              }}
            />
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="text-xs text-white/55">الفرق (مؤكد - أصلي)</div>
          {(() => {
            const diff = stats.confirmedAmount - stats.totalAmount;
            const isPositive = diff > 0;
            const isNeg = diff < 0;
            const color = isPositive
              ? "text-emerald-200"
              : isNeg
                ? "text-red-300"
                : "text-white/70";
            return (
              <div className={`font-extrabold mt-1 ${color}`} dir="ltr">
                {formatMoney(diff)}
              </div>
            );
          })()}
          <div className="text-xs text-white/40 mt-0.5">
            {stats.confirmedCount > 0 ? "بعد التأكيد" : "لا يوجد مؤكد"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ExpensesPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [month, setMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthHint = month ? monthLabel(month) : "";

  const [activeTab, setActiveTab] = useState("register");
  const [editingExpense, setEditingExpense] = useState(null);

  const expensesQuery = useExpensesData(month, employeeId, isAdmin);
  const typesQuery = useExpenseTypes(employeeId, isAdmin);
  const createExpenseMutation = useCreateExpense(month);
  const updateExpenseMutation = useUpdateExpense(month);
  const confirmExpenseMutation = useConfirmExpense(month);
  const deleteExpenseMutation = useDeleteExpense(month);
  const createTypeMutation = useCreateExpenseType();

  const expenses = Array.isArray(expensesQuery.data?.expenses)
    ? expensesQuery.data.expenses
    : [];
  const types = Array.isArray(typesQuery.data) ? typesQuery.data : [];

  const handleCreateExpense = (data) => {
    createExpenseMutation.mutate(data);
  };

  const handleUpdateExpense = (data) => {
    updateExpenseMutation.mutate(data, {
      onSuccess: () => {
        setEditingExpense(null);
      },
    });
  };

  const handleConfirmExpense = (data) => {
    confirmExpenseMutation.mutate(data);
  };

  const handleDeleteExpense = (id) => {
    deleteExpenseMutation.mutate(id);
  };

  const handleCreateType = (data) => {
    createTypeMutation.mutate(data);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setActiveTab("register");
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
  };

  // Loading / Auth states
  if (!ready) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="expenses" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
            <div className="text-white/60">جاري التحميل…</div>
          </div>
        </main>
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="expenses" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
            <div className="text-white/60">يرجى تسجيل الدخول</div>
            <div className="mt-3">
              <a
                href="/admin/login"
                className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
              >
                تسجيل دخول الإدارة
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="expenses" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
            <div className="text-white/60">غير مصرح لك بالوصول</div>
          </div>
        </main>
      </div>
    );
  }

  const isRegisterTab = activeTab === "register";
  const isReviewTab = activeTab === "review";

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="expenses" />

      <ExpensesMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <ExpensesDesktopHeader />

          <ExpensesInfoCard />

          {/* Tabs */}
          <div className={`${ws.segWrap} relative z-10`}>
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={`${ws.segBtn} ${isRegisterTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
            >
              <FileText className="w-4 h-4" />
              تسجيل المصروفات
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`${ws.segBtn} ${isReviewTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
            >
              <ClipboardCheck className="w-4 h-4" />
              رفع المصروفات
              {expenses.length > 0 && (
                <span className="bg-white/10 text-white/70 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {expenses.length}
                </span>
              )}
            </button>
          </div>

          {/* ═══════ Register Tab ═══════ */}
          {isRegisterTab && (
            <>
              {/* Form Card — always visible, no month dependency */}
              <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={ws.iconBox}>
                    <FileText className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <div className="font-bold text-white tracking-tight">
                      {editingExpense ? "تعديل المصروف" : "تسجيل مصروف جديد"}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {editingExpense
                        ? "عدّل بيانات المصروف ثم اضغط حفظ"
                        : "اختر الشهر والنوع ثم أضف المصروف"}
                    </div>
                  </div>
                </div>

                <ExpenseForm
                  types={types}
                  onSubmit={
                    editingExpense ? handleUpdateExpense : handleCreateExpense
                  }
                  isSubmitting={
                    editingExpense
                      ? updateExpenseMutation.isPending
                      : createExpenseMutation.isPending
                  }
                  onCreateType={handleCreateType}
                  editingExpense={editingExpense}
                  onCancelEdit={handleCancelEdit}
                />
              </div>

              {/* Quick expenses list for current month */}
              {month && expenses.length > 0 && (
                <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={ws.iconBox}>
                        <Receipt className="w-5 h-5 text-emerald-200" />
                      </div>
                      <div>
                        <div className="font-bold text-white tracking-tight">
                          المصروفات المضافة
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">
                          {monthHint} — {expenses.length} مصروف
                        </div>
                      </div>
                    </div>
                    {/* Month quick-switch */}
                    <div className="w-44">
                      <GlassSelect
                        value={month}
                        onChange={setMonth}
                        options={monthOptions}
                        placeholder="الشهر"
                        buttonClassName="text-xs py-2 px-2.5"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {expenses.map((e) => {
                      const confirmedClass = e.is_confirmed
                        ? "border-emerald-400/20 bg-emerald-400/5"
                        : "border-white/10 bg-white/[0.02]";
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${confirmedClass}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-white/40 text-xs shrink-0">
                              {e.expense_type_name}
                            </span>
                            <span className="text-white text-sm font-semibold truncate">
                              {e.expense_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className="text-white/70 text-sm font-semibold"
                              dir="ltr"
                            >
                              {formatMoney(e.amount)}
                            </span>
                            {e.is_confirmed && (
                              <span className="text-emerald-300 text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                            {!e.is_confirmed && (
                              <button
                                type="button"
                                onClick={() => handleEditExpense(e)}
                                className="text-sky-300 text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md hover:bg-sky-500/20 transition-colors"
                              >
                                تعديل
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* If no month selected, prompt to select */}
              {!month && (
                <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className={ws.iconBox}>
                      <Receipt className="w-5 h-5 text-emerald-200" />
                    </div>
                    <div>
                      <div className="font-bold text-white tracking-tight">
                        المصروفات المضافة
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        اختر الشهر في نموذج الإضافة أعلاه لعرض المصروفات
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════ Review Tab ═══════ */}
          {isReviewTab && (
            <>
              {/* Month Filter */}
              <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-white tracking-tight">
                      فلترة المصروفات
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      اختر الشهر لمراجعة وتأكيد المصروفات
                    </div>
                  </div>
                  <div className="w-full sm:w-[280px]">
                    <GlassSelect
                      value={month}
                      onChange={setMonth}
                      options={monthOptions}
                      placeholder="اختر الشهر"
                      buttonClassName="text-sm py-2.5 px-3"
                    />
                  </div>
                </div>
              </div>

              {!month && (
                <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
                  <div className="text-white/40 text-sm">
                    اختر الشهر لعرض المصروفات
                  </div>
                </div>
              )}

              {month && (
                <>
                  {/* Stats Cards */}
                  {expenses.length > 0 && (
                    <ExpensesStatsCards expenses={expenses} />
                  )}

                  {/* Review Table */}
                  <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className={ws.iconBox}>
                        <ClipboardCheck className="w-5 h-5 text-emerald-200" />
                      </div>
                      <div>
                        <div className="font-bold text-white tracking-tight">
                          رفع المصروفات
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">
                          مراجعة وتأكيد المصروفات لشهر {monthHint}
                        </div>
                      </div>
                    </div>

                    {expensesQuery.isLoading && (
                      <div className="text-center py-8">
                        <div className="text-white/60 text-sm">
                          جاري التحميل…
                        </div>
                      </div>
                    )}

                    {expensesQuery.error && (
                      <div className="text-center py-8">
                        <div className="text-red-300 text-sm">
                          {String(expensesQuery.error.message)}
                        </div>
                      </div>
                    )}

                    {!expensesQuery.isLoading && !expensesQuery.error && (
                      <div className="overflow-x-auto">
                        <ExpenseTable
                          expenses={expenses}
                          onConfirm={handleConfirmExpense}
                          onDelete={handleDeleteExpense}
                          onEdit={handleEditExpense}
                        />
                      </div>
                    )}
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
