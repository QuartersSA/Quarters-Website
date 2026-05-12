import React, { useCallback, useMemo } from "react";
import { ws } from "@/components/Workspace/ui";
import { computeOrderTotals } from "@/utils/greenBeanOrderCalculations";
import { groupOrderItems } from "@/utils/greenBeanOrderUtils";
import {
  exportGreenBeanOrderExcel,
  exportGreenBeanOrderPDF,
} from "@/utils/greenBeanOrderExport";
import { toast } from "sonner";
import { OrderDetailsHeader } from "./OrderDetailsHeader";
import { OrderInfo } from "./OrderInfo";
import { OrderDetailsTable } from "./OrderDetailsTable";
import { OrderSummary } from "./OrderSummary";
import { DepositModal } from "./DepositModal/DepositModal";
import { useDepositModal } from "@/hooks/useDepositModal";
import { useReceivedQuantity } from "@/hooks/useReceivedQuantity";

export function OrderDetails({
  selectedOrderId,
  orderDetails,
  orderItems,
  isLoading,
  error,
  onRefresh,
  isFetching,
  onEditOrder,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const totals = useMemo(() => computeOrderTotals(orderItems), [orderItems]);

  // Group bags that share the same bean + identical pricing/waste/extra/size
  // params into a single visual row labelled "× N خيشة". DB still stores
  // one row per bag (so per-bag params can diverge); grouping is purely a
  // presentation concern. Same util is used by the export so the printed
  // file matches what's on screen.
  const groupedItems = useMemo(() => groupOrderItems(orderItems), [orderItems]);

  const {
    showDepositModal,
    depositBranchId,
    setDepositBranchId,
    depositNote,
    setDepositNote,
    depositResult,
    branchOptions,
    depositMutation,
    onOpenDepositModal,
    onCloseDepositModal,
    onConfirmDeposit,
  } = useDepositModal();

  const {
    rowError,
    rowSuccess,
    receivedById,
    onChangeReceived,
    onSaveReceived,
    isRowSaving,
  } = useReceivedQuantity(orderItems, selectedOrderId, groupedItems);

  const onExportOrderExcel = useCallback(() => {
    if (!selectedOrderId || !orderDetails?.id) {
      toast.error("اختر طلب أولاً");
      return;
    }
    const items = Array.isArray(orderItems) ? orderItems : [];
    exportGreenBeanOrderExcel(orderDetails, items, totals);
  }, [selectedOrderId, orderDetails, orderItems, totals]);

  const onExportOrderPDF = useCallback(() => {
    if (!selectedOrderId || !orderDetails?.id) {
      toast.error("اختر طلب أولاً");
      return;
    }
    const items = Array.isArray(orderItems) ? orderItems : [];
    exportGreenBeanOrderPDF(orderDetails, items, totals);
  }, [selectedOrderId, orderDetails, orderItems, totals]);

  const handleConfirmDeposit = useCallback(() => {
    onConfirmDeposit(selectedOrderId);
  }, [onConfirmDeposit, selectedOrderId]);

  const depositPreviewItems = useMemo(() => {
    if (!Array.isArray(orderItems)) return [];

    // Aggregate same bean type into one entry
    const beanMap = new Map();
    for (const it of orderItems) {
      const beanId = it.bean_id;
      const beanName = it.bean_name_snapshot || it.bean_name_current || "—";
      const received = Number(it.computed_received_after_waste_kg);
      const hasReceived = Number.isFinite(received) && received > 0;

      const key = String(beanId);
      if (beanMap.has(key)) {
        const existing = beanMap.get(key);
        if (hasReceived) {
          existing.receivedKg += received;
          existing.hasReceived = true;
        }
        existing.bagCount += 1;
      } else {
        beanMap.set(key, {
          beanName,
          receivedKg: hasReceived ? received : 0,
          hasReceived,
          bagCount: 1,
        });
      }
    }

    return Array.from(beanMap.values()).map((item) => ({
      ...item,
      receivedKg: Math.round(item.receivedKg * 1000) / 1000,
    }));
  }, [orderItems]);

  let body = null;
  if (!selectedOrderId) {
    body = <div className="mt-4 text-white/60">اختر طلب من القائمة.</div>;
  } else if (isLoading) {
    body = <div className="mt-4 text-white/60">جاري التحميل…</div>;
  } else if (error) {
    body = <div className="mt-4 text-red-300">{error}</div>;
  } else if (!orderDetails) {
    body = <div className="mt-4 text-white/60">لا يوجد تفاصيل.</div>;
  } else {
    body = (
      <>
        <OrderInfo orderDetails={orderDetails} />
        <OrderDetailsTable
          groupedItems={groupedItems}
          receivedById={receivedById}
          onChangeReceived={onChangeReceived}
          onSaveReceived={onSaveReceived}
          isRowSaving={isRowSaving}
        />
        <OrderSummary totals={totals} />
      </>
    );
  }

  const showHeaderActions = !!selectedOrderId;

  return (
    <div className={cardShell}>
      <OrderDetailsHeader
        showHeaderActions={showHeaderActions}
        orderDetails={orderDetails}
        onOpenDepositModal={onOpenDepositModal}
        onEditOrder={onEditOrder}
        orderItems={orderItems}
        onExportOrderExcel={onExportOrderExcel}
        onExportOrderPDF={onExportOrderPDF}
        onRefresh={onRefresh}
        isFetching={isFetching}
        isLoading={isLoading}
      />

      {rowError ? <div className="mt-3 text-red-300">{rowError}</div> : null}
      {rowSuccess ? (
        <div className="mt-3 text-emerald-200">{rowSuccess}</div>
      ) : null}

      {body}

      <DepositModal
        showDepositModal={showDepositModal}
        orderDetails={orderDetails}
        depositResult={depositResult}
        depositBranchId={depositBranchId}
        setDepositBranchId={setDepositBranchId}
        depositNote={depositNote}
        setDepositNote={setDepositNote}
        branchOptions={branchOptions}
        depositPreviewItems={depositPreviewItems}
        onConfirmDeposit={handleConfirmDeposit}
        onCloseDepositModal={onCloseDepositModal}
        depositMutation={depositMutation}
      />
    </div>
  );
}
