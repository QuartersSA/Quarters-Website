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

function getTransferDirMeta(direction) {
  if (direction === "out") {
    return { label: "إرسال", Icon: ArrowUpRight };
  }
  if (direction === "in") {
    return { label: "استلام", Icon: ArrowDownLeft };
  }
  return { label: "تحويل", Icon: ArrowLeftRight };
}

export function OperationInfoGrid({ selectedOperation, totalQuantity }) {
  const isTransfer = selectedOperation?.inventory_type === "Transfer";
  const isReceipt = selectedOperation?.inventory_type === "Receipt";
  const transferMeta = getTransferDirMeta(
    selectedOperation?.transfer_direction,
  );

  const operationDateValue =
    selectedOperation?.operation_date || selectedOperation?.created_at;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <Building2 className="w-4 h-4" />
          <span className="text-sm">الفرع</span>
        </div>
        <p className="text-white font-semibold">
          {selectedOperation.branch_name || "غير محدد"}
        </p>
        {selectedOperation.branch_location && !isTransfer ? (
          <p className="text-gray-400 text-sm mt-2">
            {selectedOperation.branch_location}
          </p>
        ) : null}

        {isTransfer && selectedOperation.transfer_branch_name ? (
          <p className="text-gray-400 text-sm mt-2 flex items-center gap-2">
            <transferMeta.Icon className="w-4 h-4" />
            <span>
              {transferMeta.label}: {selectedOperation.transfer_branch_name}
            </span>
          </p>
        ) : null}
      </div>

      <div className="bg-white/5 rounded-lg p-4">
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
            <p className="text-white font-semibold">
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
            <p className="text-white font-semibold">
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

      <div className="bg-white/5 rounded-lg p-4">
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
        <p className="text-white font-semibold">
          {getInventoryTypeLabel(selectedOperation.inventory_type)}
        </p>
      </div>

      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <Clock className="w-4 h-4" />
          <span className="text-sm">تاريخ العملية</span>
        </div>
        <p className="text-white font-semibold">
          {formatDateTime(operationDateValue)}
        </p>
      </div>

      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <CalendarPlus className="w-4 h-4" />
          <span className="text-sm">تاريخ الإدخال</span>
        </div>
        <p className="text-white/70 font-semibold">
          {formatDateTime(selectedOperation.created_at)}
        </p>
      </div>

      {totalQuantity !== undefined ? (
        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">إجمالي الكميات</span>
          </div>
          <p className="text-white font-semibold text-2xl">
            {totalQuantity}
            <span className="text-sm text-gray-400 mr-2">وحدة</span>
          </p>
        </div>
      ) : null}

      {selectedOperation.note ? (
        <div className="bg-white/5 rounded-lg p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <StickyNote className="w-4 h-4" />
            <span className="text-sm">ملاحظة</span>
          </div>
          <p className="text-white/85 whitespace-pre-wrap">
            {selectedOperation.note}
          </p>
        </div>
      ) : null}
    </div>
  );
}
