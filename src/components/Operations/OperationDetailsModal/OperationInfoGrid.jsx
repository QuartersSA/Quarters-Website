import {
  Building2,
  User,
  Calendar,
  Clock,
  CalendarPlus,
  BarChart3,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  StickyNote,
  PackagePlus,
} from "lucide-react";
import { formatDateTime } from "@/utils/exportUtils";

function getInventoryTypeLabel(type) {
  if (type === "Daily") return "جرد يومي";
  if (type === "Weekly") return "جرد أسبوعي";
  if (type === "Transfer") return "تحويل بين الفروع";
  if (type === "Receipt") return "وارد";
  if (type === "Opening") return "مخزون افتتاحي";
  return type || "-";
}

// Resolve sender + receiver names explicitly from a single leg so the
// modal reads the same way regardless of whether the user opened the
// "out" or the "in" half of the transfer.
function getTransferParties(operation) {
  const own = operation?.branch_name || "—";
  const other = operation?.transfer_branch_name || "—";
  if (operation?.transfer_direction === "out") {
    return { receiver: other, sender: own, Icon: ArrowUpRight };
  }
  if (operation?.transfer_direction === "in") {
    return { receiver: own, sender: other, Icon: ArrowDownLeft };
  }
  return { receiver: other, sender: own, Icon: ArrowLeftRight };
}

export function OperationInfoGrid({ selectedOperation, totalQuantity }) {
  const isTransfer = selectedOperation?.inventory_type === "Transfer";
  const isReceipt = selectedOperation?.inventory_type === "Receipt";
  const transferParties = isTransfer
    ? getTransferParties(selectedOperation)
    : null;

  const operationDateValue =
    selectedOperation?.operation_date || selectedOperation?.created_at;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <Building2 className="w-4 h-4" />
          <span className="text-sm">
            {isTransfer ? "أطراف التحويل" : "الفرع"}
          </span>
        </div>

        {isTransfer && transferParties ? (
          // Show both parties so the modal makes sense regardless of
          // whether the user clicked the OUT or the IN row.
          <>
            <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold flex items-center gap-2">
              <transferParties.Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200" />
              <span>المستلم: {transferParties.receiver}</span>
            </p>
            <p className="text-gray-300 text-sm mt-2">
              المرسل: {transferParties.sender}
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold">
              {selectedOperation.branch_name || "غير محدد"}
            </p>
            {selectedOperation.branch_location ? (
              <p className="text-gray-400 text-sm mt-2">
                {selectedOperation.branch_location}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          {isReceipt ? (
            <PackagePlus className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
          <span className="text-sm">
            {isReceipt ? "الصنف الوارد" : "الموظف المسؤول"}
          </span>
        </div>
        {isReceipt ? (
          <>
            <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold">
              {selectedOperation.receipt_item_name || "صنف"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              الكمية: {selectedOperation.receipt_quantity}
            </p>
            {selectedOperation.employee_name ? (
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>بواسطة: {selectedOperation.employee_name}</span>
              </p>
            ) : null}
          </>
        ) : selectedOperation.employee_name ? (
          <>
            <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold">
              {selectedOperation.employee_name}
            </p>
            {selectedOperation.employee_email && (
              <p className="text-gray-400 text-sm mt-1">
                {selectedOperation.employee_email}
              </p>
            )}
          </>
        ) : (
          <p className="text-gray-500">غير محدد</p>
        )}
      </div>

      <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          {isTransfer ? (
            <ArrowLeftRight className="w-4 h-4" />
          ) : isReceipt ? (
            <PackagePlus className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          <span className="text-sm">نوع العملية</span>
        </div>
        <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold">
          {getInventoryTypeLabel(selectedOperation.inventory_type)}
        </p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <Clock className="w-4 h-4" />
          <span className="text-sm">تاريخ العملية</span>
        </div>
        <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold">
          {formatDateTime(operationDateValue)}
        </p>
      </div>

      <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <CalendarPlus className="w-4 h-4" />
          <span className="text-sm">تاريخ الإدخال</span>
        </div>
        <p className="text-slate-700 dark:text-slate-700 dark:dark:text-white/70 font-semibold">
          {formatDateTime(selectedOperation.created_at)}
        </p>
      </div>

      {totalQuantity !== undefined ? (
        <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">إجمالي الكميات</span>
          </div>
          <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-semibold text-2xl">
            {totalQuantity}
            <span className="text-sm text-gray-400 mr-2">وحدة</span>
          </p>
        </div>
      ) : null}

      {selectedOperation.note ? (
        <div className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/5 rounded-lg p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <StickyNote className="w-4 h-4" />
            <span className="text-sm">ملاحظة</span>
          </div>
          <p className="text-slate-800 dark:text-slate-800 dark:dark:text-white/85 whitespace-pre-wrap">
            {selectedOperation.note}
          </p>
        </div>
      ) : null}
    </div>
  );
}
