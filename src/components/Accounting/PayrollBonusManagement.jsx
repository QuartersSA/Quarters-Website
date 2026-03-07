import { Plus, Send } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { HRBonusesTable } from "@/components/HR/HRBonusesTable";

export function PayrollBonusManagement({
  month,
  monthHint,
  bonuses,
  bonusesQuery,
  bonusEmployees,
  bonusesEmployeesQuery,
  onOpenBonusModal,
  onDeleteBonus,
  onRebuildPayroll,
  isRebuilding,
}) {
  if (!month) return null;

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="font-bold text-white tracking-tight">
            البونص ({monthHint})
          </div>
          <div className="text-xs text-white/50 mt-1">
            إضافة/تعديل/حذف بونص لهذا الشهر (يتم تحديث المسير بعد كل تغيير)
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onOpenBonusModal()}
            className={`${ws.btnPrimary} px-4 py-2 justify-center`}
            disabled={
              bonusEmployees.length === 0 || bonusesEmployeesQuery.isLoading
            }
          >
            <Plus className="w-4 h-4" />
            <span className="font-semibold">إضافة بونص</span>
          </button>

          <button
            type="button"
            onClick={onRebuildPayroll}
            className={`${ws.btnNeutral} px-4 py-2 justify-center`}
            disabled={isRebuilding}
          >
            <Send className="w-4 h-4" />
            <span className="font-semibold">
              {isRebuilding ? "جاري التحديث…" : "تحديث المسير"}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <HRBonusesTable
          bonuses={bonuses}
          isLoading={bonusesQuery.isLoading}
          onEdit={onOpenBonusModal}
          onDelete={onDeleteBonus}
        />
      </div>
    </div>
  );
}
