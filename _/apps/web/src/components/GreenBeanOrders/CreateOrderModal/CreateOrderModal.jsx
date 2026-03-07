import { Plus, Save } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { ModalShell } from "../ModalShell";
import { OrderFormFields } from "./OrderFormFields";
import { OrderItemRow } from "./OrderItemRow";

export function CreateOrderModal({
  orderDraft,
  setOrderDraft,
  beanOptions,
  createPreviewRows,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onSubmit,
  onClose,
  isPending,
}) {
  return (
    <ModalShell title="طلب توريد بن أخضر (جديد)" onClose={onClose}>
      <OrderFormFields orderDraft={orderDraft} setOrderDraft={setOrderDraft} />

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-white font-bold tracking-tight">أصناف الطلب</div>
          <div className="text-xs text-white/50 mt-1">
            اكتب السعر والهدر لكل نوع بن داخل هذا الطلب.
          </div>
        </div>
        <button
          type="button"
          onClick={onAddLine}
          className={`${ws.btnNeutral} px-4 py-2`}
        >
          <Plus className="w-4 h-4" />
          إضافة صنف
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {createPreviewRows.map(({ idx, line, computed }) => {
          const canRemove = orderDraft.items.length > 1;

          return (
            <OrderItemRow
              key={idx}
              idx={idx}
              line={line}
              computed={computed}
              beanOptions={beanOptions}
              onUpdate={onUpdateLine}
              onRemove={onRemoveLine}
              canRemove={canRemove}
            />
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${ws.btnNeutral} px-4 py-2`}
          disabled={isPending}
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className={`${ws.btnPrimary} px-4 py-2`}
          disabled={isPending}
        >
          <Save className="w-4 h-4" />
          حفظ الطلب
        </button>
      </div>

      {isPending ? <div className="mt-3 text-white/60">جاري الحفظ…</div> : null}
    </ModalShell>
  );
}
