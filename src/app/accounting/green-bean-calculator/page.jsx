"use client";

import React from "react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import { ws } from "@/components/Workspace/ui";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { useGreenBeanCalculator } from "@/hooks/useGreenBeanCalculator";
import {
  MobileHeader,
  DesktopHeader,
} from "@/components/GreenBeanCalculator/PageHeader";
import { BeanSelector } from "@/components/GreenBeanCalculator/BeanSelector";
import { CalculatorCard } from "@/components/GreenBeanCalculator/CalculatorCard";

export default function GreenBeanCalculatorPage() {
  const { ready, employeeId, user, isAuthenticated } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const canInteract = !!ready && !!isAuthenticated && !!isAdmin && !!employeeId;

  const {
    calculatorMode,
    setCalculatorMode,
    newName,
    selectedId,
    setSelectedId,
    error,
    success,
    roastInputMode,
    setRoastInputMode,
    draft,
    beansQuery,
    beans,
    selectedBean,
    selectedUpdatedAtText,
    createBeanMutation,
    updateBeanMutation,
    createSupplyMutation,
    handleRefresh,
    onAdd,
    onSave,
    onCopyFinalPrice,
    handleChangePriceKgExclTax,
    handleChangeBagSizeKg,
    handleChangeRoastCostExclTax,
    handleChangeRoastCostInclTax,
    handleChangeReceivedKg,
    handleChangeNewName,
    beanOptions,
    computed,
  } = useGreenBeanCalculator({ ready, isAuthenticated, isAdmin });

  if (ready && isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="green-bean" />
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

  const loadingOrAuth = !ready ? (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      جاري التحميل…
    </div>
  ) : !employeeId ? (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
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
  ) : null;

  const beansErrorText = beansQuery.error
    ? String(beansQuery.error?.message || "فشل تحميل البن")
    : "";

  let beansStatusBlock = null;
  if (beansQuery.isLoading) {
    beansStatusBlock = <div className="mt-4 text-white/60">جاري التحميل…</div>;
  } else if (beansQuery.error) {
    beansStatusBlock = (
      <div className="mt-4 text-red-300">{beansErrorText}</div>
    );
  } else if (beans.length === 0) {
    beansStatusBlock = (
      <div className="mt-4 text-white/60">لا يوجد بن مضاف بعد.</div>
    );
  }

  const errorBlock = error ? (
    <div className="mt-4 text-red-300">{error}</div>
  ) : null;
  const successBlock = success ? (
    <div className="mt-4 text-emerald-200">{success}</div>
  ) : null;

  const refreshDisabled = beansQuery.isFetching || !canInteract;
  const addDisabled = createBeanMutation.isPending || !canInteract;

  const saveDisabled =
    !canInteract ||
    calculatorMode !== "register" ||
    !selectedBean ||
    updateBeanMutation.isPending ||
    createSupplyMutation.isPending;

  const savingBlock =
    updateBeanMutation.isPending || createSupplyMutation.isPending ? (
      <div className="mt-3 text-white/60">جاري الحفظ…</div>
    ) : null;

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="green-bean" />

      <MobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          <DesktopHeader />

          {loadingOrAuth}

          <BeanSelector
            calculatorMode={calculatorMode}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            newName={newName}
            handleChangeNewName={handleChangeNewName}
            onAdd={onAdd}
            handleRefresh={handleRefresh}
            refreshDisabled={refreshDisabled}
            addDisabled={addDisabled}
            beanOptions={beanOptions}
            beansStatusBlock={beansStatusBlock}
            errorBlock={errorBlock}
            successBlock={successBlock}
          />

          <CalculatorCard
            calculatorMode={calculatorMode}
            setCalculatorMode={setCalculatorMode}
            onSave={onSave}
            onCopyFinalPrice={onCopyFinalPrice}
            saveDisabled={saveDisabled}
            selectedBean={selectedBean}
            selectedUpdatedAtText={selectedUpdatedAtText}
            draft={draft}
            handleChangePriceKgExclTax={handleChangePriceKgExclTax}
            handleChangeBagSizeKg={handleChangeBagSizeKg}
            roastInputMode={roastInputMode}
            setRoastInputMode={setRoastInputMode}
            handleChangeRoastCostExclTax={handleChangeRoastCostExclTax}
            handleChangeRoastCostInclTax={handleChangeRoastCostInclTax}
            handleChangeReceivedKg={handleChangeReceivedKg}
            computed={computed}
            savingBlock={savingBlock}
          />
        </div>
      </main>
    </div>
  );
}
