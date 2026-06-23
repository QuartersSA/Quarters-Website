"use client";

import React, { useMemo, useState } from "react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { HRBonusModal } from "@/components/HR/HRBonusModal";
import { buildRecentMonthOptions, monthLabel } from "@/utils/payrollFormatters";
import { usePayrollData } from "@/hooks/usePayrollData";
import {
  usePayrollRebuild,
  usePayrollPayment,
  usePayrollClose,
} from "@/hooks/usePayrollMutations";
import {
  useBonusesEmployees,
  useBonuses,
  useCreateBonus,
  useUpdateBonus,
  useDeleteBonus,
} from "@/hooks/usePayrollBonuses";
import { useCurrentAdminName } from "@/hooks/useCurrentAdminName";
import { usePayrollBonusForm } from "@/hooks/usePayrollBonusForm";
import {
  calculatePayrollTotals,
  formatRunCreatedAt,
  getPayrollExportColumns,
} from "@/utils/payrollCalculations";
import { PayrollFilters } from "@/components/Accounting/PayrollFilters";
import { PayrollInfoCard } from "@/components/Accounting/PayrollInfoCard";
import { PayrollTotals } from "@/components/Accounting/PayrollTotals";
import { PayrollTableCard } from "@/components/Accounting/PayrollTableCard";
import { PayrollBonusManagement } from "@/components/Accounting/PayrollBonusManagement";
import {
  MonthEmptyCard,
  LoadingCard,
  ErrorCard,
  NoRunCard,
  LoginCard,
  NotAccountingCard,
} from "@/components/Accounting/PayrollStatusCards";
import {
  PayrollMobileHeader,
  PayrollDesktopHeader,
} from "@/components/Accounting/PayrollHeader";
import { currentRiyadhMonthKey } from "@/utils/dateUtils";

export default function PayrollPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  // Default to the current calendar month so first paint shows usable data
  // instead of a "اختر الشهر" empty card — matches the expenses page.
  const [month, setMonth] = useState(currentRiyadhMonthKey);
  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthHint = month ? monthLabel(month) : "";

  const currentAdminName = useCurrentAdminName();

  const payrollQuery = usePayrollData(month, employeeId, isAdmin);
  const payrollRebuildMutation = usePayrollRebuild();
  const payrollPaymentMutation = usePayrollPayment(month);
  const payrollCloseMutation = usePayrollClose(month);

  const bonusesEmployeesQuery = useBonusesEmployees(employeeId, isAdmin);
  const bonusesQuery = useBonuses(month, employeeId, isAdmin);

  const bonuses = Array.isArray(bonusesQuery.data) ? bonusesQuery.data : [];
  const bonusEmployees = Array.isArray(bonusesEmployeesQuery.data)
    ? bonusesEmployeesQuery.data
    : [];

  const createBonusMutation = useCreateBonus(month, payrollRebuildMutation);
  const updateBonusMutation = useUpdateBonus(month, payrollRebuildMutation);
  const deleteBonusMutation = useDeleteBonus(month, payrollRebuildMutation);

  const {
    bonusFormData,
    setBonusFormData,
    editingBonus,
    showBonusModal,
    handleOpenBonusModal,
    handleCloseBonusModal,
    handleSubmitBonus,
    handleDeleteBonus,
  } = usePayrollBonusForm(month);

  const entries = Array.isArray(payrollQuery.data?.entries)
    ? payrollQuery.data.entries
    : [];
  const run = payrollQuery.data?.run || null;

  const exportColumns = useMemo(() => getPayrollExportColumns(), []);

  const payrollErrorMessage = payrollQuery.error?.message
    ? String(payrollQuery.error.message)
    : "فشل تحميل مسير الرواتب";

  const runCreatedAtText = useMemo(
    () => formatRunCreatedAt(run?.created_at),
    [run?.created_at],
  );

  const totals = useMemo(() => calculatePayrollTotals(entries), [entries]);

  const modalSourceDisplay = editingBonus
    ? editingBonus.source || editingBonus.created_by_employee_name || "-"
    : currentAdminName || "-";

  const handlePaymentSave = (paymentData) => {
    payrollPaymentMutation.mutate(paymentData);
  };

  const handleCloseMonth = () => {
    if (!month) return;
    const isClosed = !!run?.is_closed;
    const msg = isClosed
      ? "هل تريد فتح الشهر مرة أخرى؟"
      : "هل تريد تقفيل الشهر؟ لن يمكن تعديل حالة الدفع بعد التقفيل.";
    if (window.confirm(msg)) {
      payrollCloseMutation.mutate();
    }
  };

  const bonusManageCard = (
    <PayrollBonusManagement
      month={month}
      monthHint={monthHint}
      bonuses={bonuses}
      bonusesQuery={bonusesQuery}
      bonusEmployees={bonusEmployees}
      bonusesEmployeesQuery={bonusesEmployeesQuery}
      onOpenBonusModal={handleOpenBonusModal}
      onDeleteBonus={(id) => handleDeleteBonus(id, deleteBonusMutation)}
      onRebuildPayroll={() => payrollRebuildMutation.mutate({ month })}
      isRebuilding={payrollRebuildMutation.isPending}
    />
  );

  let payrollSection = null;
  if (!month) {
    payrollSection = <MonthEmptyCard />;
  } else if (payrollQuery.isLoading) {
    payrollSection = <LoadingCard />;
  } else if (payrollQuery.error) {
    payrollSection = <ErrorCard message={payrollErrorMessage} />;
  } else if (!run) {
    payrollSection = (
      <>
        <NoRunCard
          monthHint={monthHint}
          onRebuild={() => payrollRebuildMutation.mutate({ month })}
          isRebuilding={payrollRebuildMutation.isPending}
        />
        {bonusManageCard}
      </>
    );
  } else {
    payrollSection = (
      <>
        <PayrollTotals
          totals={totals}
          monthHint={monthHint}
          runCreatedAtText={runCreatedAtText}
          run={run}
          entries={entries}
        />

        <PayrollTableCard
          entries={entries}
          exportColumns={exportColumns}
          month={month}
          monthHint={monthHint}
          run={run}
          onRebuildPayroll={() => payrollRebuildMutation.mutate({ month })}
          isRebuilding={payrollRebuildMutation.isPending}
          onPaymentSave={handlePaymentSave}
          onCloseMonth={handleCloseMonth}
          isClosingMonth={payrollCloseMutation.isPending}
        />

        {bonusManageCard}
      </>
    );
  }

  const filtersAndPayroll = (
    <>
      <PayrollFilters
        month={month}
        monthOptions={monthOptions}
        onMonthChange={setMonth}
      />
      {payrollSection}
    </>
  );

  let pageBody = null;
  if (!ready) {
    pageBody = <LoadingCard />;
  } else if (!employeeId) {
    pageBody = <LoginCard />;
  } else if (!isAdmin) {
    pageBody = <NotAccountingCard />;
  } else {
    pageBody = filtersAndPayroll;
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="payroll" />

      <PayrollMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <PayrollDesktopHeader />

          <PayrollInfoCard />

          {pageBody}
        </div>
      </main>

      <HRBonusModal
        isOpen={showBonusModal}
        isEditing={!!editingBonus}
        formData={bonusFormData}
        setFormData={setBonusFormData}
        employees={bonusEmployees}
        sourceDisplay={modalSourceDisplay}
        monthValue={month}
        monthHint={monthHint}
        onSubmit={(e) =>
          handleSubmitBonus(e, createBonusMutation, updateBonusMutation)
        }
        onClose={handleCloseBonusModal}
        isSubmitting={
          createBonusMutation.isPending ||
          updateBonusMutation.isPending ||
          payrollRebuildMutation.isPending
        }
      />
    </div>
  );
}
