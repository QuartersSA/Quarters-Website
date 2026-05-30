"use client";

import React, { useMemo, useState } from "react";
import { Wallet, Plus, Filter, Info } from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { formatMoney } from "@/utils/payrollFormatters";
import LoanModal from "@/components/Accounting/LoanModal";
import LoansList from "@/components/Accounting/LoansList";
import {
  useEmployeeLoans,
  useLoanEmployees,
  useCreateLoan,
  useUpdateLoan,
  useDeleteLoan,
} from "@/hooks/useEmployeeLoans";

/* ── Mobile Header ── */
function LoansMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">السلف والقروض</div>
        <div className="text-xs text-slate-500 dark:text-white/50">إدارة سلف الموظفين</div>
      </div>
    </div>
  );
}

/* ── Desktop Header ── */
function LoansDesktopHeader({ onAdd }) {
  return (
    <div className="hidden lg:flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={ws.iconBox}>
          <Wallet className="w-6 h-6 text-emerald-700 dark:text-emerald-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            السلف والقروض
          </h1>
          <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">
            تقسيم القرض على أقساط شهرية تُخصم تلقائياً من مسير الرواتب.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className={`${ws.btnPrimary} px-4 py-2`}
      >
        <Plus className="w-4 h-4" />
        إضافة قرض
      </button>
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

function LoansInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-700 dark:text-sky-200" />
        </div>
        <div className="min-w-0 text-sm text-slate-700 dark:text-white/75 leading-relaxed">
          مبلغ القرض يُقسم على عدد الأقساط، ويُخصم القسط الشهري تلقائياً من
          صافي راتب الموظف ابتداءً من شهر البدء المحدد ولمدة الأقساط فقط.
          إيقاف القرض يوقف الخصم في الأشهر القادمة ولا يؤثر على المسير
          المُقفل.
        </div>
      </div>
    </div>
  );
}

export default function LoansPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [filterEmployee, setFilterEmployee] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const employeesQuery = useLoanEmployees(employeeId, isAdmin);
  const employees = employeesQuery.data || [];

  const loansQuery = useEmployeeLoans({
    employeeId,
    isAdmin,
    filterEmployeeId: filterEmployee || null,
    includeInactive,
  });
  const loans = loansQuery.data || [];

  const createMutation = useCreateLoan();
  const updateMutation = useUpdateLoan();
  const deleteMutation = useDeleteLoan();

  const employeeFilterOptions = useMemo(
    () => [
      { value: "", label: "كل الموظفين" },
      ...employees.map((e) => ({ value: String(e.id), label: e.name })),
    ],
    [employees],
  );

  const totals = useMemo(() => {
    let outstanding = 0;
    let monthly = 0;
    let activeCount = 0;
    for (const l of loans) {
      const total = Number(l.total_amount || 0);
      const inst = Number(l.installments_count || 0);
      const paid = Math.max(
        0,
        Math.min(inst, Number(l.paid_months_to_date || 0)),
      );
      const monthlyAmt = Number(l.monthly_amount || 0);
      const remainingMonths = Math.max(0, inst - paid);
      if (l.is_active !== false) {
        outstanding += monthlyAmt * remainingMonths;
        monthly += monthlyAmt;
        activeCount += 1;
      }
    }
    return { outstanding, monthly, activeCount, total: loans.length };
  }, [loans]);

  const handleSubmit = (payload) => {
    if (editing) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          setEditing(null);
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setShowAdd(false);
        },
      });
    }
  };

  const handleEdit = (loan) => {
    setEditing(loan);
  };

  const handleToggleActive = (loan) => {
    const nextActive = !(loan.is_active !== false);
    updateMutation.mutate({ id: loan.id, is_active: nextActive });
  };

  const handleDelete = (loan) => {
    const monthly = Number(loan.monthly_amount || 0);
    const confirmed = window.confirm(
      `حذف القرض نهائياً لـ ${loan.employee_name || "هذا الموظف"}؟\n\nسيُحذف من القائمة بالكامل، وتُمسح الاستقطاعات (${formatMoney(monthly)}/شهر) من مسير الرواتب لأي شهر لم يُقفل بعد.\nالأشهر المُقفلة تحتفظ بقيمها كما هي.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate({ id: loan.id, force: true });
  };

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = <LoginCard />;
  } else if (!isAdmin) {
    body = <NotAccountingCard />;
  } else {
    body = (
      <>
        <LoansInfoCard />

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`${ws.glass} ${ws.card} p-4`}>
            <div className="text-xs text-slate-600 dark:text-white/55">قروض نشطة</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {totals.activeCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/40 mt-1">
              من إجمالي {totals.total}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-4`}>
            <div className="text-xs text-slate-600 dark:text-white/55">إجمالي الخصم الشهري</div>
            <div
              className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 mt-1"
              dir="ltr"
            >
              {formatMoney(totals.monthly)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/40 mt-1">
              يُطرح من المسير
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-4 col-span-2`}>
            <div className="text-xs text-slate-600 dark:text-white/55">المتبقي للسداد</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1" dir="ltr">
              {formatMoney(totals.outstanding)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/40 mt-1">
              للقروض النشطة فقط
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-slate-600 dark:text-white/55 text-xs">
              <Filter className="w-4 h-4" />
              تصفية
            </div>
            <div className="min-w-[200px]">
              <GlassSelect
                value={filterEmployee}
                onChange={setFilterEmployee}
                options={employeeFilterOptions}
                buttonClassName="text-sm py-2 px-3"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="accent-emerald-400"
              />
              تضمين القروض الموقوفة
            </label>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className={`${ws.btnPrimary} px-4 py-2 lg:hidden`}
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
          </div>
        </div>

        <LoansList
          loans={loans}
          isLoading={loansQuery.isLoading}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="loans" />

      <LoansMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <LoansDesktopHeader onAdd={() => setShowAdd(true)} />
          {body}
        </div>
      </main>

      <LoanModal
        open={showAdd || !!editing}
        loan={editing}
        employees={employees}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
