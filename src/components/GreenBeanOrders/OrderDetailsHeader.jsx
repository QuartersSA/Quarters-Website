import React from "react";
import { Eye, Pencil, Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import ExportMenu from "@/components/GreenBeanOrders/ExportMenu";

export function OrderDetailsHeader({
  showHeaderActions,
  orderDetails,
  onOpenDepositModal,
  onEditOrder,
  orderItems,
  onExportOrderExcel,
  onExportOrderPDF,
  onRefresh,
  isFetching,
  isLoading,
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-slate-900 dark:text-white font-bold tracking-tight">تفاصيل الطلب</div>
        <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
          يظهر لك سعر الكيلو الصافي لكل نوع بن داخل الطلب.
        </div>
      </div>
      {showHeaderActions ? (
        <div className="flex items-center gap-2 flex-wrap">
          {orderDetails?.id ? (
            <button
              type="button"
              onClick={onOpenDepositModal}
              className={`${ws.btnPrimary} px-4 py-2`}
              style={{
                background: "linear-gradient(135deg, #059669, #10b981)",
              }}
              disabled={isFetching || isLoading}
            >
              <Package className="w-4 h-4" />
              الإيداع في المخزون
            </button>
          ) : null}
          {onEditOrder && orderDetails?.id ? (
            <button
              type="button"
              onClick={() => onEditOrder(orderDetails, orderItems)}
              className={`${ws.btnPrimary} px-4 py-2`}
              disabled={isFetching || isLoading}
            >
              <Pencil className="w-4 h-4" />
              تعديل الطلب
            </button>
          ) : null}
          <ExportMenu
            label="تصدير الطلب"
            onExcel={onExportOrderExcel}
            onPDF={onExportOrderPDF}
            disabled={!orderDetails?.id}
          />
          <button
            type="button"
            onClick={onRefresh}
            className={`${ws.btnNeutral} px-4 py-2`}
            disabled={isFetching}
          >
            <Eye className="w-4 h-4" />
            تحديث
          </button>
        </div>
      ) : null}
    </div>
  );
}
