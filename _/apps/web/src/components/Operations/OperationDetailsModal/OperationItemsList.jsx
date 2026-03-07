import { Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function OperationItemsList({ operationDetails }) {
  return (
    <div dir="rtl">
      <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-tight">
        <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
          <Package className="w-5 h-5" />
        </div>
        تفاصيل الأصناف
      </h4>

      {operationDetails?.items ? (
        <div className="space-y-3">
          {operationDetails.items.map((item, idx) => {
            const qty = Number(item.quantity) || 0;
            const isZero = qty === 0;
            const badgeClass = isZero
              ? `${ws.pill} bg-red-500/10 text-red-200 border-red-500/20`
              : `${ws.pill} bg-emerald-500/10 text-emerald-200 border-emerald-500/20`;

            const qtyColor = isZero ? "text-red-200" : "text-emerald-200";

            return (
              <div
                key={item.id ?? `${item.item_id}-${idx}`}
                className={`${ws.glassSoft} border border-white/10 rounded-3xl p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 ${
                      isZero ? "bg-red-500/10" : "bg-emerald-500/10"
                    }`}
                  >
                    <Package
                      className={`w-5 h-5 ${
                        isZero ? "text-red-200" : "text-emerald-200"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{item.item_name}</p>
                    {item.item_description ? (
                      <p className="text-white/45 text-sm">
                        {item.item_description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isZero ? (
                    <span className={badgeClass}>غير متوفر</span>
                  ) : (
                    <>
                      <span className={`text-2xl font-bold ${qtyColor}`}>
                        {qty}
                      </span>
                      <span className={badgeClass}>وحدة متوفرة</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-white/55">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>لا توجد تفاصيل متاحة</p>
        </div>
      )}
    </div>
  );
}
