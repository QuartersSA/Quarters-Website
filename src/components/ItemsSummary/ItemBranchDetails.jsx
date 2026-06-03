import {
  Hash,
  Calendar,
  User,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { getStockStatus } from "@/utils/itemsSummaryCalculations";
import { formatDateTime } from "@/utils/exportUtils";

const StatusIcon = ({ iconName }) => {
  if (iconName === "CheckCircle") return <CheckCircle className="w-3 h-3" />;
  if (iconName === "XCircle") return <XCircle className="w-3 h-3" />;
  if (iconName === "TrendingDown") return <TrendingDown className="w-3 h-3" />;
  return null;
};

export function ItemBranchDetails({ branch, minThreshold }) {
  const status = getStockStatus(branch.current_quantity, minThreshold);

  return (
    <div className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-3xl p-4`}>
      {/* Branch Header */}
      <div
        className={`flex items-start justify-between mb-3 pb-3 border-b ${ws.divider}`}
      >
        <div className="flex-1">
          <h5 className="text-slate-900 dark:text-slate-900 dark:text-white font-semibold mb-1">
            {branch.branch_name}
          </h5>
          {branch.branch_location ? (
            <p className="text-slate-500 dark:text-slate-500 dark:text-white/45 text-xs">{branch.branch_location}</p>
          ) : null}
        </div>
        <span
          className={`${ws.pill} inline-flex items-center gap-1 text-xs font-semibold border ${status.color}`}
        >
          <StatusIcon iconName={status.icon} />
          {status.label}
        </span>
      </div>

      {/* Stock Info */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm">الكمية الحالية</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">
            {branch.current_quantity}
          </span>
        </div>
        {Number(branch.receipts_since_last_inventory) > 0 ? (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-500 dark:text-slate-500 dark:text-white/45">
              آخر جرد: {branch.last_inventory_quantity} · وارد بعده: +
              {branch.receipts_since_last_inventory}
            </span>
          </div>
        ) : null}
      </div>

      {/* Last Inventory Details */}
      {branch.operation_id ? (
        <div className={`space-y-2 pt-3 border-t ${ws.divider}`}>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
            آخر عملية جرد:
          </p>

          <div className="flex items-center gap-2">
            <Hash className="w-3 h-3 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">رقم الجرد:</span>
            <span className="text-xs text-slate-900 dark:text-slate-900 dark:text-white font-mono">
              {branch.inventory_number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">التاريخ:</span>
            <span className="text-xs text-slate-900 dark:text-slate-900 dark:text-white whitespace-nowrap">
              {formatDateTime(branch.operation_date)}
            </span>
          </div>

          {branch.employee_name ? (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
              <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">الموظف:</span>
              <span className="text-xs text-slate-900 dark:text-slate-900 dark:text-white">{branch.employee_name}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">نوع الجرد:</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-white/80">
              {branch.inventory_type === "Daily"
                ? "يومي"
                : branch.inventory_type === "Weekly"
                  ? "أسبوعي"
                  : branch.inventory_type === "Transfer"
                    ? "تحويل"
                    : branch.inventory_type === "Receipt"
                      ? "وارد"
                      : branch.inventory_type === "Opening"
                        ? "مخزون افتتاحي"
                        : branch.inventory_type || "-"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <BarChart3 className="w-3 h-3 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-white/55">إجمالي العمليات:</span>
            <span className="text-xs text-slate-900 dark:text-slate-900 dark:text-white">
              {branch.total_operations}
            </span>
          </div>
        </div>
      ) : (
        <div className={`pt-3 border-t ${ws.divider}`}>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-700 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">لم يتم تنفيذ جرد لهذا الفرع بعد</span>
          </div>
        </div>
      )}
    </div>
  );
}
