import React from "react";

export function OrderInfo({ orderDetails }) {
  const orderIdText = orderDetails?.id ? String(orderDetails.id) : "—";
  const orderDateText = orderDetails?.order_date
    ? String(orderDetails.order_date)
    : "—";
  const supplierText = orderDetails?.supplier_name
    ? String(orderDetails.supplier_name)
    : "";
  const noteText = orderDetails?.note ? String(orderDetails.note) : "";

  return (
    <>
      <div className="mt-4 text-slate-800 dark:text-white/80">
        <div className="text-sm">
          <span className="text-slate-600 dark:text-white/55">رقم الطلب:</span> {orderIdText}
        </div>
        <div className="text-sm mt-1">
          <span className="text-slate-600 dark:text-white/55">التاريخ:</span> {orderDateText}
        </div>
        {supplierText ? (
          <div className="text-sm mt-1">
            <span className="text-slate-600 dark:text-white/55">المورّد:</span> {supplierText}
          </div>
        ) : null}
      </div>

      {noteText ? (
        <div className="mt-4 text-sm text-slate-700 dark:text-white/70">
          <span className="text-slate-600 dark:text-white/55">ملاحظة:</span> {noteText}
        </div>
      ) : null}
    </>
  );
}
