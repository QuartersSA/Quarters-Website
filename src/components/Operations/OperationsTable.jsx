import {
  ClipboardList,
  Download,
  Eye,
  Calendar,
  Building2,
  FileText,
  Printer,
  ChevronDown,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  PackagePlus,
  Trash2,
  FolderOpen,
  Pencil,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  exportToExcelHTML,
  exportToPDF,
  formatInventoryType,
  formatDateTime,
} from "@/utils/exportUtils";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";

// The DB stores "timestamp without time zone" but neon appends "Z" on
// serialisation.  Stripping Z prevents the browser from applying a
// UTC→local shift that would show the wrong calendar day / time.
function stripTZ(v) {
  if (!v) return v;
  return String(v).replace(/Z$/i, "");
}

function getTypePill(type) {
  if (type === "Daily") {
    return {
      label: "يومي",
      className: "bg-sky-500/10 text-sky-200 border-sky-500/20",
      Icon: Calendar,
    };
  }

  if (type === "Weekly") {
    return {
      label: "أسبوعي",
      className: "bg-fuchsia-500/10 text-fuchsia-200 border-fuchsia-500/20",
      Icon: Calendar,
    };
  }

  if (type === "Transfer") {
    return {
      label: "تحويل",
      className: "bg-amber-500/10 text-amber-200 border-amber-500/20",
      Icon: ArrowLeftRight,
    };
  }

  if (type === "Receipt") {
    return {
      label: "وارد",
      className: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20",
      Icon: PackagePlus,
    };
  }

  if (type === "Opening") {
    return {
      label: "مخزون افتتاحي",
      className: "bg-teal-500/10 text-teal-200 border-teal-500/20",
      Icon: FolderOpen,
    };
  }

  return {
    label: type,
    className: "bg-white/[0.06] text-white border-white/10",
    Icon: Calendar,
  };
}

function getTransferDirectionMeta(direction) {
  if (direction === "out") {
    return { label: "إرسال", Icon: ArrowUpRight };
  }
  if (direction === "in") {
    return { label: "استلام", Icon: ArrowDownLeft };
  }
  return { label: "تحويل", Icon: ArrowLeftRight };
}

export function OperationsTable({
  filteredOperations,
  isLoading,
  hasActiveFilters,
  onViewOperation,
  onDeleteOperation,
  onEditOperation,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const handleExportExcel = () => {
    const columns = [
      { header: "رقم الجرد", accessor: (item) => item.inventory_number },
      { header: "الفرع", accessor: (item) => item.branch_name || "غير محدد" },
      {
        header: "الموظف",
        accessor: (item) => item.employee_name || "غير محدد",
      },
      {
        header: "نوع الجرد",
        accessor: (item) => item.inventory_type,
        format: (value) => formatInventoryType(value),
      },
      {
        header: "تاريخ العملية",
        accessor: (item) => item.operation_date || item.created_at,
        format: (value) => formatDateTime(value),
      },
      {
        header: "تاريخ الإدخال",
        accessor: (item) => item.created_at,
        format: (value) => formatDateTime(value),
      },
    ];

    exportToExcelHTML(
      filteredOperations,
      `عمليات_المخزون_${new Date().toISOString().split("T")[0]}`,
      columns,
      "تقرير عمليات المخزون",
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "رقم الجرد", accessor: (item) => item.inventory_number },
      { header: "الفرع", accessor: (item) => item.branch_name || "غير محدد" },
      {
        header: "الموظف",
        accessor: (item) => item.employee_name || "غير محدد",
      },
      {
        header: "نوع الجرد",
        accessor: (item) => item.inventory_type,
        format: (value) => formatInventoryType(value),
      },
      {
        header: "تاريخ العملية",
        accessor: (item) => item.operation_date || item.created_at,
        format: (value) => formatDateTime(value),
      },
      {
        header: "تاريخ الإدخال",
        accessor: (item) => item.created_at,
        format: (value) => formatDateTime(value),
      },
    ];

    exportToPDF(
      filteredOperations,
      `عمليات_المخزون_${new Date().toISOString().split("T")[0]}`,
      columns,
      "تقرير عمليات المخزون",
    );
    setShowExportMenu(false);
  };

  const cardClass = `${ws.glass} ${ws.card} overflow-hidden`;
  const headerChip =
    "px-3 py-1 rounded-full text-sm text-white/70 bg-white/[0.04] border border-white/10";

  return (
    <div className={cardClass} dir="rtl">
      <div
        className={`p-5 sm:p-6 border-b ${ws.divider} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
      >
        <div className="flex items-center gap-3">
          <div className={`${ws.iconBox} text-white/80`}>
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight">
              سجل عمليات الجرد
            </h2>
            <div className="text-xs text-white/50">عرض وتصدير السجل</div>
          </div>
          <span className={headerChip}>
            {filteredOperations?.length || 0} عملية
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className={`${ws.btnNeutral} px-4 py-2 text-sm justify-center`}
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>

          <div>
            <button
              ref={exportBtnRef}
              type="button"
              onClick={() => setShowExportMenu((s) => !s)}
              className={`${ws.btnPrimary} px-4 py-2 text-sm justify-center`}
              aria-expanded={showExportMenu}
            >
              <Download className="w-4 h-4" />
              <span>تصدير</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <GlassPopover
              open={showExportMenu}
              anchorRef={exportBtnRef}
              onClose={() => setShowExportMenu(false)}
              style={{ width: 208 }}
            >
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors"
              >
                <FileText className="w-4 h-4 text-emerald-200" />
                <div>
                  <p className="font-semibold text-white">Excel</p>
                  <p className="text-xs text-white/45">ملف .xls</p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors border-t border-white/10"
              >
                <FileText className="w-4 h-4 text-red-200" />
                <div>
                  <p className="font-semibold text-white">PDF</p>
                  <p className="text-xs text-white/45">للطباعة والأرشفة</p>
                </div>
              </button>
            </GlassPopover>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                رقم الجرد
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                الفرع
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                الموظف
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                نوع الجرد
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                تاريخ العملية
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                تاريخ الإدخال
              </th>
              <th className="text-center px-6 py-4 text-sm font-semibold text-white/55">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-12 text-center text-white/55"
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
                    <span>جاري التحميل…</span>
                  </div>
                </td>
              </tr>
            ) : filteredOperations?.length > 0 ? (
              filteredOperations.map((operation) => {
                const typeMeta = getTypePill(operation.inventory_type);
                const isTransfer = operation.inventory_type === "Transfer";
                const transferMeta = getTransferDirectionMeta(
                  operation.transfer_direction,
                );

                const operationDateValue =
                  operation.operation_date || operation.created_at;

                return (
                  <tr
                    key={operation.id}
                    className="border-t border-white/5 hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-200" />
                        <span className="text-white font-mono text-sm">
                          {operation.inventory_number}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-white/35" />
                        <div className="min-w-0">
                          <div className="text-white/80 font-medium truncate">
                            {operation.branch_name || "غير محدد"}
                          </div>

                          {isTransfer && operation.transfer_branch_name ? (
                            <div className="text-white/45 text-xs flex items-center gap-1 mt-1">
                              <transferMeta.Icon className="w-3 h-3" />
                              <span>
                                {transferMeta.label}:{" "}
                                {operation.transfer_branch_name}
                              </span>
                            </div>
                          ) : operation.branch_location ? (
                            <div className="text-white/40 text-xs">
                              {operation.branch_location}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {operation.employee_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/[0.06] border border-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white/80 text-xs font-bold">
                              {operation.employee_name.charAt(0)}
                            </span>
                          </div>
                          <div className="text-white font-medium text-sm">
                            {operation.employee_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/45 text-sm">غير محدد</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`${ws.pill} ${typeMeta.className} inline-flex items-center gap-1`}
                      >
                        <typeMeta.Icon className="w-3 h-3" />
                        {typeMeta.label}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-white">
                          {new Date(
                            stripTZ(operationDateValue),
                          ).toLocaleDateString("ar-SA-u-nu-latn", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-white/45 text-xs">
                          {new Date(
                            stripTZ(operationDateValue),
                          ).toLocaleTimeString("ar-SA-u-nu-latn", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-white/60">
                          {new Date(
                            stripTZ(operation.created_at),
                          ).toLocaleDateString("ar-SA-u-nu-latn", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-white/35 text-xs">
                          {new Date(
                            stripTZ(operation.created_at),
                          ).toLocaleTimeString("ar-SA-u-nu-latn", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewOperation(operation)}
                          className={`${ws.btnPrimary} px-3 py-1.5 text-sm justify-center`}
                        >
                          <Eye className="w-4 h-4" />
                          <span>عرض</span>
                        </button>
                        {onEditOperation ? (
                          <button
                            type="button"
                            onClick={() => onEditOperation(operation)}
                            className={`${ws.btnNeutral} px-3 py-1.5 text-sm justify-center`}
                            title="تعديل العملية"
                          >
                            <Pencil className="w-4 h-4 text-sky-200" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDeleteOperation(operation)}
                          className={`${ws.btnDanger} px-3 py-1.5 text-sm justify-center`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-12 text-center text-white/45"
                >
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-lg text-white/70">لا توجد عمليات جرد</p>
                  {hasActiveFilters ? (
                    <p className="text-sm mt-2">جرّب تغيير الفلاتر أو مسحها</p>
                  ) : null}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
