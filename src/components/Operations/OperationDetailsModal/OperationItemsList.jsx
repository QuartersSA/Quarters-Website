import { Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

// For Transfer ops, the stored qty is the post-transfer absolute at THIS
// branch (not the transferred amount). A 0 here legitimately means
// "branch fully drained that item via the transfer", not "the item is
// unavailable". Suppress the متوفر/غير متوفر vocabulary entirely for
// Transfer ops so the UI doesn't lie about availability — show the raw
// post-transfer qty with a neutral label instead.
export function OperationItemsList({ operationDetails }) {
  const isTransfer = operationDetails?.inventory_type === "Transfer";

  return (
    <div dir="rtl">
      <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-3 tracking-tight">
        <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
          <Package className="w-5 h-5" />
        </div>
        {isTransfer ? "الكميات بعد التحويل" : "تفاصيل الأصناف"}
      </h4>

      {operationDetails?.items ? (
        <div className="space-y-3">
          {operationDetails.items.map((item, idx) => {
            const qty = Number(item.quantity) || 0;
            const isZero = qty === 0;

            // For Transfer rows, drop the availability-flavoured styling
            // — colour stays neutral whether qty is 0 or positive.
            const useAvailabilityChrome = !isTransfer;
            const badgeClass =
              useAvailabilityChrome && isZero
                ? `${ws.pill} bg-red-500/10 text-red-200 border-red-500/20`
                : useAvailabilityChrome
                  ? `${ws.pill} bg-emerald-500/10 text-emerald-200 border-emerald-500/20`
                  : `${ws.pill} bg-white/[0.06] text-white/70 border-white/10`;

            const qtyColor =
              useAvailabilityChrome && isZero
                ? "text-red-200"
                : useAvailabilityChrome
                  ? "text-emerald-200"
                  : "text-white";

            const iconBg =
              useAvailabilityChrome && isZero
                ? "bg-red-500/10"
                : useAvailabilityChrome
                  ? "bg-emerald-500/10"
                  : "bg-white/[0.04]";

            const iconColor =
              useAvailabilityChrome && isZero
                ? "text-red-200"
                : useAvailabilityChrome
                  ? "text-emerald-200"
                  : "text-white/70";

            const badgeText = isTransfer
              ? "كمية بعد التحويل"
              : isZero
                ? "غير متوفر"
                : "وحدة متوفرة";

            return (
              <div
                key={item.id ?? `${item.item_id}-${idx}`}
                className={`${ws.glassSoft} border border-white/10 rounded-3xl p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 ${iconBg}`}
                  >
                    <Package className={`w-5 h-5 ${iconColor}`} />
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
                  {isTransfer ? (
                    <>
                      <span className={`text-2xl font-bold ${qtyColor}`}>
                        {qty}
                      </span>
                      <span className={badgeClass}>{badgeText}</span>
                    </>
                  ) : isZero ? (
                    <span className={badgeClass}>{badgeText}</span>
                  ) : (
                    <>
                      <span className={`text-2xl font-bold ${qtyColor}`}>
                        {qty}
                      </span>
                      <span className={badgeClass}>{badgeText}</span>
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
