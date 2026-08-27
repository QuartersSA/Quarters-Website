"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  FileText,
  ClipboardCheck,
  Info,
  Anchor,
  ListChecks,
} from "lucide-react";
import {
  buildRecentMonthOptions,
  monthLabel,
} from "@/utils/payrollFormatters";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { ExpenseForm } from "@/components/Accounting/ExpenseForm";
import { ExpenseTable } from "@/components/Accounting/ExpenseTable";
import ExpenseFilters from "@/components/Accounting/ExpenseFilters";
import ExpensesExportMenu from "@/components/Accounting/ExpensesExportMenu";
import ExpensesAnalytics from "@/components/Accounting/ExpensesAnalytics";
import FixedPanel from "@/components/Accounting/FixedPanel";
import VariableGrid from "@/components/Accounting/VariableGrid";
import CategoriesManager from "@/components/Accounting/CategoriesManager";
import ReviewTabContent from "@/components/Accounting/ReviewTabContent";
import { QuickAddSheet } from "@/components/Accounting/QuickAddSheet";
import { currentRiyadhMonthKey } from "@/utils/dateUtils";
import {
  useExpensesData,
  useExpenseTypes,
  useCreateExpense,
  useUpdateExpense,
  useConfirmExpense,
  useDeleteExpense,
  useCreateExpenseType,
} from "@/hooks/useExpensesData";
import {
  useFixedExpenses,
  useConfirmFixedExpense,
} from "@/hooks/useFixedExpenses";

/**
 * المصروفات panel — the full expenses workspace (month picker, fixed /
 * variable / review / categories tabs, quick-add sheet).
 *
 * Extracted from the old standalone /accounting/expenses page so it can
 * render as a tab inside قسم المشتريات. The host page owns auth gating
 * and layout (sidebar + headers); this panel only needs employeeId +
 * isAdmin for the data hooks.
 */

function ExpensesInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-700 dark:text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-900 dark:text-white tracking-tight">ملاحظة</div>
          <div className="text-sm text-slate-600 dark:text-white/60 mt-1 leading-6">
            أضف المصروفات من قسم «مصروف متغيّر» ثم راجعها وأكّدها من قسم «رفع
            المصروفات» حسب الشهر.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPanel({ employeeId, isAdmin }) {
  const [month, setMonth] = useState(currentRiyadhMonthKey);
  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthHint = month ? monthLabel(month) : "";

  const [activeTab, setActiveTab] = useState("fixed");
  // Review-tab filter chips: all | confirmed | pending.
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");

  // ── Shared filter/search/sort state for the variable-expense lists ──
  // (register + review tabs). The panel owns it; both tabs derive their
  // displayed rows from `filteredExpenses` below.
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSort, setFilterSort] = useState("amount_desc");
  const resetFilters = () => {
    setFilterType("");
    setFilterStatus("all");
    setFilterSearch("");
    setFilterSort("amount_desc");
  };
  const hasActiveFilters =
    !!filterType ||
    filterStatus !== "all" ||
    !!filterSearch.trim() ||
    filterSort !== "amount_desc";
  const [editingExpense, setEditingExpense] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const expensesQuery = useExpensesData(month, employeeId, isAdmin);
  const typesQuery = useExpenseTypes(employeeId, isAdmin);
  const fixedExpensesQuery = useFixedExpenses(employeeId, isAdmin);
  const createExpenseMutation = useCreateExpense(month);
  const updateExpenseMutation = useUpdateExpense(month);
  const confirmExpenseMutation = useConfirmExpense(month);
  const deleteExpenseMutation = useDeleteExpense(month);
  const createTypeMutation = useCreateExpenseType();
  const confirmFixedMutation = useConfirmFixedExpense();

  const expenses = Array.isArray(expensesQuery.data?.expenses)
    ? expensesQuery.data.expenses
    : [];
  const pendingFixed = Array.isArray(expensesQuery.data?.pending_fixed)
    ? expensesQuery.data.pending_fixed
    : [];
  const types = Array.isArray(typesQuery.data) ? typesQuery.data : [];
  const fixedExpenses = Array.isArray(fixedExpensesQuery.data)
    ? fixedExpensesQuery.data
    : [];

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

  const handleConfirmFixedExpense = (data) => {
    confirmFixedMutation.mutate(data);
  };

  // Type options for the filter bar — every distinct type name present
  // in the current month's expenses (so empty types don't clutter the
  // list). Sorted alphabetically.
  const filterTypeOptions = useMemo(() => {
    const names = new Set();
    for (const e of expenses) {
      if (e.expense_type_name) names.add(e.expense_type_name);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((n) => ({ value: n, label: n }));
  }, [expenses]);

  // Derived, filtered + sorted view of the month's expenses. Shared by
  // the register tab's list AND the review tab (composes with the review
  // tab's own all/confirmed/pending chips). Does NOT touch pending_fixed
  // rows — those flow through untouched.
  const filteredExpenses = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    let out = expenses.filter((e) => {
      if (filterType && e.expense_type_name !== filterType) return false;
      if (filterStatus === "confirmed" && !e.is_confirmed) return false;
      if (filterStatus === "pending" && e.is_confirmed) return false;
      if (q) {
        const name = String(e.expense_name || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    out = out.slice().sort((a, b) => {
      switch (filterSort) {
        case "amount_asc":
          return num(a.amount) - num(b.amount);
        case "name_asc":
          return String(a.expense_name || "").localeCompare(
            String(b.expense_name || ""),
            "ar",
          );
        case "status":
          // Pending first (false sorts before true).
          return Number(!!a.is_confirmed) - Number(!!b.is_confirmed);
        case "amount_desc":
        default:
          return num(b.amount) - num(a.amount);
      }
    });
    return out;
  }, [expenses, filterType, filterStatus, filterSearch, filterSort]);

  const todayRiyadh = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
    [],
  );

  const handleQuickAddSubmit = (data) => {
    createExpenseMutation.mutate(data);
  };

  // ── Keyboard shortcuts ──
  // Ctrl+N (or Cmd+N on Mac) opens the quick-add sheet from any tab.
  // Enter inside the form submits — handled natively by <form onSubmit>.
  useEffect(() => {
    function onKey(e) {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (!isCmdOrCtrl) return;
      const key = e.key?.toLowerCase();
      if (key !== "n") return;
      // Skip when the user is typing in another field — opening the
      // quick-add while focused inside the inline form steals focus mid-
      // type and the keypress feels broken. tagName + contenteditable
      // covers all common text-entry surfaces.
      const tgt = e.target;
      const tag = (tgt?.tagName || "").toUpperCase();
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tgt?.isContentEditable;
      if (isEditable) return;
      // Browser default for Ctrl+N is "new window"; we override it while
      // the expenses panel is mounted.
      e.preventDefault();
      setQuickAddOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isRegisterTab = activeTab === "register";
  const isReviewTab = activeTab === "review";
  const isFixedTab = activeTab === "fixed";
  const isCategoriesTab = activeTab === "categories";

  // Types filtered by scope. Fixed tab uses 'fixed' OR 'both';
  // variable tab uses 'variable' OR 'both'. Legacy rows without a scope
  // (column was added later) are treated as 'both' via the COALESCE on
  // the API side.
  const fixedTypes = (types || []).filter((t) =>
    ["fixed", "both"].includes(t.scope || "both"),
  );
  const variableTypes = (types || []).filter((t) =>
    ["variable", "both"].includes(t.scope || "both"),
  );

  return (
    <>
      {/* Month picker — minimal, replaces the old QuickAddBar
          top strip (which mixed month picker + quick-add CTA +
          monthly total and made the header feel noisy). */}
      <div className={`${ws.glassSoft} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-slate-600 dark:text-white/55 text-xs">الشهر</div>
          <div className="w-44">
            <GlassSelect
              value={month}
              onChange={setMonth}
              options={monthOptions}
              placeholder="اختر الشهر"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
        </div>
      </div>

      <ExpensesInfoCard />

      {/* Tabs */}
      <div className={`${ws.segWrap} relative z-10`}>
        <button
          type="button"
          onClick={() => setActiveTab("fixed")}
          className={`${ws.segBtn} ${isFixedTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
        >
          <Anchor className="w-4 h-4" />
          مصروف ثابت
          {fixedExpenses.length > 0 && (
            <span className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {fixedExpenses.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("register")}
          className={`${ws.segBtn} ${isRegisterTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
        >
          <FileText className="w-4 h-4" />
          مصروف متغيّر
          {variableTypes.length > 0 && (
            <span className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {variableTypes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`${ws.segBtn} ${isReviewTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
        >
          <ClipboardCheck className="w-4 h-4" />
          تقارير ومراجعة
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`${ws.segBtn} ${isCategoriesTab ? ws.segActive : ws.segInactive} flex items-center gap-2`}
        >
          <ListChecks className="w-4 h-4" />
          البنود
          {types.length > 0 && (
            <span className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/70 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {types.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════ Variable Expenses Tab ═══════ */}
      {isRegisterTab && (
        <>
          <VariableGrid
            types={variableTypes}
            monthExpenses={expenses}
            month={month}
            onMutate={() => expensesQuery.refetch()}
          />
          {/* Legacy register form kept hidden under details to
              preserve access to the older "add arbitrary expense"
              workflow (e.g. one-off items without a category). */}
          <details className={`${ws.glassSoft} ${ws.card} p-4`}>
            <summary className="text-slate-600 dark:text-white/55 text-xs cursor-pointer select-none">
              إضافة مصروف خارج البنود (متقدم)
            </summary>
            <div className="mt-4">
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
          </details>

          {/* Analytics — month-over-month + by-category breakdown.
              Complements the review tab's charts. */}
          {month && expenses.length > 0 && (
            <ExpensesAnalytics month={month} expenses={expenses} />
          )}

          {/* Quick expenses list for current month — variable only.
              Fixed-template entries belong to the "مصروف ثابت"
              tab, so we filter them out here. Variable rows are
              those that DON'T carry a fixed_expense_id link. The
              shared filter/search/sort bar drives the displayed
              rows via `filteredExpenses`, then we drop fixed links. */}
          {month &&
            (() => {
              const allVariable = (expenses || []).filter(
                (e) =>
                  e.fixed_expense_id === null ||
                  e.fixed_expense_id === undefined,
              );
              if (allVariable.length === 0) return null;
              // Apply the shared filters/sort, then keep variable-only.
              const variableExpenses = filteredExpenses.filter(
                (e) =>
                  e.fixed_expense_id === null ||
                  e.fixed_expense_id === undefined,
              );
              return (
                <>
                  <ExpenseFilters
                    typeFilter={filterType}
                    onTypeFilterChange={setFilterType}
                    statusFilter={filterStatus}
                    onStatusFilterChange={setFilterStatus}
                    search={filterSearch}
                    onSearchChange={setFilterSearch}
                    sort={filterSort}
                    onSortChange={setFilterSort}
                    typeOptions={filterTypeOptions}
                    onReset={resetFilters}
                    hasActiveFilters={hasActiveFilters}
                  />
                  <div className={`${ws.glassSoft} ${ws.card} p-5`}>
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={ws.iconBox}>
                          <Receipt className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                            المصروفات المضافة
                          </div>
                          <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                            {monthHint} — {variableExpenses.length} من{" "}
                            {allVariable.length} مصروف متغير
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ExpensesExportMenu
                          expenses={variableExpenses}
                          month={month}
                          todayRiyadh={todayRiyadh}
                        />
                        {/* Month quick-switch */}
                        <div className="w-40">
                          <GlassSelect
                            value={month}
                            onChange={setMonth}
                            options={monthOptions}
                            placeholder="الشهر"
                            buttonClassName="text-xs py-2 px-2.5"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <ExpenseTable
                        expenses={variableExpenses}
                        month={month}
                        onConfirm={handleConfirmExpense}
                        onDelete={handleDeleteExpense}
                        onEdit={handleEditExpense}
                      />
                    </div>
                  </div>
                </>
              );
            })()}

          {/* If no month selected, prompt to select */}
          {!month && (
            <div className={`${ws.glassSoft} ${ws.card} p-5`}>
              <div className="flex items-center gap-3">
                <div className={ws.iconBox}>
                  <Receipt className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                    المصروفات المضافة
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
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
          {/* Shared filters compose with the review tab's own
              all/confirmed/pending status chips. Export reflects the
              currently filtered set. */}
          {month && expenses.length > 0 && (
            <>
              <ExpenseFilters
                typeFilter={filterType}
                onTypeFilterChange={setFilterType}
                statusFilter={filterStatus}
                onStatusFilterChange={setFilterStatus}
                search={filterSearch}
                onSearchChange={setFilterSearch}
                sort={filterSort}
                onSortChange={setFilterSort}
                typeOptions={filterTypeOptions}
                onReset={resetFilters}
                hasActiveFilters={hasActiveFilters}
              />
              <div className="flex items-center justify-end">
                <ExpensesExportMenu
                  expenses={filteredExpenses}
                  month={month}
                  todayRiyadh={todayRiyadh}
                />
              </div>
            </>
          )}
          <ReviewTabContent
            month={month}
            monthHint={monthHint}
            expenses={filteredExpenses}
            pendingFixed={pendingFixed}
            expensesQuery={expensesQuery}
            statusFilter={reviewStatusFilter}
            onStatusFilterChange={setReviewStatusFilter}
            onConfirm={handleConfirmExpense}
            onDelete={handleDeleteExpense}
            onEdit={handleEditExpense}
            onConfirmFixed={handleConfirmFixedExpense}
          />
        </>
      )}

      {/* ═══════ Fixed Expenses Tab ═══════ */}
      {isFixedTab && (
        <FixedPanel
          templates={fixedExpenses}
          monthExpenses={expenses}
          types={fixedTypes}
          month={month}
          onMutate={() => {
            fixedExpensesQuery.refetch();
            expensesQuery.refetch();
          }}
        />
      )}

      {/* ═══════ Categories Tab ═══════ */}
      {isCategoriesTab && <CategoriesManager />}

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        types={types}
        onSubmit={handleQuickAddSubmit}
        isSubmitting={createExpenseMutation.isPending}
        onCreateType={handleCreateType}
        month={month}
      />
    </>
  );
}
