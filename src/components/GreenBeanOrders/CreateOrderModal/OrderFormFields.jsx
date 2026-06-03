import { ws } from "@/components/Workspace/ui";

export function OrderFormFields({ orderDraft, setOrderDraft }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            تاريخ الطلب
          </label>
          <input
            type="date"
            className={`${ws.input} px-4 py-2.5`}
            value={orderDraft.orderDate}
            onChange={(e) =>
              setOrderDraft((d) => ({ ...d, orderDate: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            المورّد (اختياري)
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            value={orderDraft.supplierName}
            onChange={(e) =>
              setOrderDraft((d) => ({ ...d, supplierName: e.target.value }))
            }
            placeholder="مثال: مورد البن"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
          ملاحظة (اختياري)
        </label>
        <textarea
          className={`${ws.input} px-4 py-3 min-h-[90px]`}
          value={orderDraft.note}
          onChange={(e) =>
            setOrderDraft((d) => ({ ...d, note: e.target.value }))
          }
          placeholder="أي تفاصيل تخص الطلب…"
        />
      </div>
    </>
  );
}
