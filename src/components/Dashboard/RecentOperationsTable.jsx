import {
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Calendar,
  ArrowLeftRight,
  PackagePlus,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatDateTime } from "@/utils/exportUtils";

function getTypePill(type) {
  if (type === "Daily") {
    return {
      label: "يومي",
      className: "bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/25",
    };
  }
  if (type === "Weekly") {
    return {
      label: "أسبوعي",
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-200 border-purple-500/25",
    };
  }
  if (type === "Transfer") {
    return {
      label: "تحويل",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/25",
    };
  }
  if (type === "Receipt") {
    return {
      label: "وارد",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/25",
    };
  }
  if (type === "Opening") {
    return {
      label: "مخزون افتتاحي",
      className: "bg-teal-500/15 text-teal-700 dark:text-teal-200 border-teal-500/25",
    };
  }
  return {
    label: type || "-",
    className: "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10",
  };
}

export function RecentOperationsTable({ operations }) {
  const recentOperations = operations?.slice(0, 5) || [];

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <div className={`p-6 border-b ${ws.divider}`}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
          <span className="text-emerald-700 dark:text-emerald-200">
            <ClipboardList className="w-6 h-6" />
          </span>
          آخر عمليات الجرد
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-white/[0.04]">
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                رقم الجرد
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                الفرع
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                الموظف / الصنف
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                نوع الجرد
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                التاريخ والوقت
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700 dark:text-white/70">
                الحالة
              </th>
            </tr>
          </thead>
          <tbody>
            {recentOperations.length > 0 ? (
              recentOperations.map((operation) => {
                const typeMeta = getTypePill(operation.inventory_type);
                const isReceipt = operation.inventory_type === "Receipt";

                const operationDateValue =
                  operation.operation_date || operation.created_at;
                const operationDateFormatted =
                  formatDateTime(operationDateValue);

                let statusEl = null;
                if (operation.status === "Completed") {
                  statusEl = (
                    <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-200">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">مكتمل</span>
                    </span>
                  );
                }
                if (operation.status === "Pending") {
                  statusEl = (
                    <span className="flex items-center gap-2 text-amber-700 dark:text-amber-200">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-semibold">
                        قيد الانتظار
                      </span>
                    </span>
                  );
                }
                if (operation.status === "In Progress") {
                  statusEl = (
                    <span className="flex items-center gap-2 text-sky-700 dark:text-sky-200">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-semibold">قيد التنفيذ</span>
                    </span>
                  );
                }

                return (
                  <tr
                    key={operation.id}
                    className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono text-sm">
                      {operation.inventory_number}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-white/75">
                      {operation.branch_name || "غير محدد"}
                    </td>
                    <td className="px-6 py-4">
                      {isReceipt ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-emerald-500/10 border border-emerald-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <PackagePlus className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-200" />
                          </div>
                          <div>
                            <div className="text-slate-900 dark:text-white font-medium text-sm">
                              {operation.receipt_item_name || "صنف"}
                            </div>
                            <div className="text-slate-500 dark:text-white/45 text-xs">
                              الكمية: {operation.receipt_quantity}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-700 dark:text-white/75">
                          {operation.employee_name || "غير محدد"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${ws.pill} ${typeMeta.className}`}>
                        {typeMeta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-white/60 text-sm whitespace-nowrap">
                      {operationDateFormatted}
                    </td>
                    <td className="px-6 py-4">{statusEl}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-12 text-center text-slate-600 dark:text-white/55"
                >
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد عمليات جرد حتى الآن</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
