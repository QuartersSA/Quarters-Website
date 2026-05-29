import { Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

// For Transfer ops we now display the moved amount (`transfer_quantity`)
// rather than the post-transfer absolute. The admin wants to see "how
// many units shipped in this transfer", not "what's left at the source".
// Older transfers predating the `transfer_quantity` column fall back to
// the absolute `quantity` value so historical rows still render.
export function OperationItemsList({ operationDetails }) {
  const isTransfer = operationDetails?.inventory_type === "Transfer";

  return (
    <div dir="rtl">
      <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3 tracking-tight">
        <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
          <Package className="w-5 h-5" />
        </div>
        {isTransfer ? "كميات النقل" : "تفاصيل الأصناف"}
      </h4>

      {operationDetails?.items ? (
        <div className="space-y-3">
          {operationDetails.items.map((item, idx) => {
            // Transfer rows: prefer the explicit moved amount; fall back
            // to the absolute quantity for legacy rows where the new
            // column is still NULL.
            const movedRaw =
              item.transfer_quantity !== null &&
              item.transfer_quantity !== undefined
                ? item.transfer_quantity
                : item.quantity;
            const qty = isTransfer
              ? Number(movedRaw) || 0
              : Number(item.quantity) || 0;
            const isZero = qty === 0;

            // For Transfer rows, drop the availability-flavoured styling
            // — colour stays neutral whether qty is 0 or positive.
            const useAvailabilityChrome = !isTransfer;
            const badgeClass =
              useAvailabilityChrome && isZero
                ? `${ws.pill} bg-red-500/10 text-red-700 dark:text-red-200 border-red-500/20`
                : useAvailabilityChrome
                  ? `${ws.pill} bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/20`
                  : `${ws.pill} bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10`;

            const qtyColor =
              useAvailabilityChrome && isZero
                ? "text-red-700 dark:text-red-200"
                : useAvailabilityChrome
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-slate-900 dark:text-white";

            const iconBg =
              useAvailabilityChrome && isZero
                ? "bg-red-500/10"
                : useAvailabilityChrome
                  ? "bg-emerald-500/10"
                  : "bg-slate-100 dark:bg-white/[0.04]";

            const iconColor =
              useAvailabilityChrome && isZero
                ? "text-red-700 dark:text-red-200"
                : useAvailabilityChrome
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-slate-700 dark:text-white/70";

            const badgeText = isTransfer
              ? "كمية النقل"
              : isZero
                ? "غير متوفر"
                : "وحدة متوفرة";

            return (
              <div
                key={item.id ?? `${item.item_id}-${idx}`}
                className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/10 ${iconBg}`}
                  >
                    <Package className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-900 dark:text-white font-semibold">{item.item_name}</p>
                    {item.item_description ? (
                      <p className="text-slate-500 dark:text-white/45 text-sm">
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
        <div className="text-center py-8 text-slate-600 dark:text-white/55">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>لا توجد تفاصيل متاحة</p>
        </div>
      )}
    </div>
  );
}
