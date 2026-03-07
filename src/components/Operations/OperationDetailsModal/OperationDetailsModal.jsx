import {
  X,
  Download,
  Printer,
  ArrowLeftRight,
  PackagePlus,
  Trash2,
  Pencil,
} from "lucide-react";
import { OperationInfoGrid } from "./OperationInfoGrid";
import { OperationStatsCards } from "./OperationStatsCards";
import { AvailabilityProgressBar } from "./AvailabilityProgressBar";
import { OperationItemsList } from "./OperationItemsList";
import { getOperationItemStats } from "@/utils/operationsUtils";
import { ws } from "@/components/Workspace/ui";
import { formatDateTime } from "@/utils/exportUtils";

function getInventoryTypeLabel(type) {
  if (type === "Daily") return "جرد يومي";
  if (type === "Weekly") return "جرد أسبوعي";
  if (type === "Transfer") return "تحويل بين الفروع";
  if (type === "Receipt") return "وارد";
  if (type === "Opening") return "مخزون افتتاحي";
  return type || "-";
}

function buildPrintHTML(selectedOperation, operationDetails, opStats) {
  const isTransfer = selectedOperation?.inventory_type === "Transfer";
  const isReceipt = selectedOperation?.inventory_type === "Receipt";

  const titleText = isReceipt
    ? "تقرير الوارد"
    : isTransfer
      ? "تقرير التحويل"
      : "تقرير الجرد";

  const now = new Date().toLocaleString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const operationDateValue =
    selectedOperation.operation_date || selectedOperation.created_at;
  const operationDate = formatDateTime(operationDateValue);
  const entryDate = formatDateTime(selectedOperation.created_at);

  // Build items table rows
  const items = operationDetails?.items || [];
  const itemRows = items
    .map((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const statusText = qty === 0 ? "غير متوفر" : "متوفر";
      const statusColor = qty === 0 ? "#ef4444" : "#10b981";
      return `<tr>
        <td style="text-align:center; color:#666;">${idx + 1}</td>
        <td style="font-weight:600;">${item.item_name || "-"}</td>
        <td style="text-align:center; font-weight:700; font-size:16px;">${qty}</td>
        <td style="text-align:center;"><span style="color:${statusColor}; font-weight:600;">${statusText}</span></td>
      </tr>`;
    })
    .join("");

  // Stats section (only for inventory operations)
  const statsHTML =
    opStats && !isTransfer && !isReceipt
      ? `<div class="stats-row">
        <div class="stat-box">
          <div class="stat-label">إجمالي الأصناف</div>
          <div class="stat-value">${opStats.totalItems}</div>
        </div>
        <div class="stat-box stat-green">
          <div class="stat-label">متوفر</div>
          <div class="stat-value">${opStats.availableItems}</div>
        </div>
        <div class="stat-box stat-red">
          <div class="stat-label">غير متوفر</div>
          <div class="stat-value">${opStats.unavailableItems}</div>
        </div>
        <div class="stat-box stat-blue">
          <div class="stat-label">نسبة التوفر</div>
          <div class="stat-value">${opStats.availabilityRate}%</div>
        </div>
      </div>`
      : "";

  // Transfer info
  const transferInfo =
    isTransfer && selectedOperation.transfer_branch_name
      ? `<tr>
        <td class="info-label">الفرع المحول ${selectedOperation.transfer_direction === "out" ? "إليه" : "منه"}</td>
        <td class="info-value">${selectedOperation.transfer_branch_name}</td>
      </tr>`
      : "";

  // Receipt info
  const receiptInfo = isReceipt
    ? `<tr>
        <td class="info-label">الصنف الوارد</td>
        <td class="info-value">${selectedOperation.receipt_item_name || "-"}</td>
      </tr>
      <tr>
        <td class="info-label">الكمية الواردة</td>
        <td class="info-value">${selectedOperation.receipt_quantity || "-"}</td>
      </tr>`
    : "";

  const noteRow = selectedOperation.note
    ? `<tr>
        <td class="info-label">ملاحظة</td>
        <td class="info-value">${selectedOperation.note}</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${titleText} - ${selectedOperation.inventory_number}</title>
  <style>
    @media print {
      @page { size: A4; margin: 15mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #fff;
      color: #1a1a2e;
      direction: rtl;
      padding: 0;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    /* Header */
    .report-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
      color: white;
      padding: 32px 40px;
      border-radius: 16px;
      margin-bottom: 28px;
      position: relative;
      overflow: hidden;
    }
    .report-header::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -25%;
      width: 50%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%);
    }
    .report-header h1 {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    .report-header .ref-number {
      font-family: monospace;
      font-size: 14px;
      opacity: 0.65;
      margin-bottom: 16px;
    }
    .report-header .meta-row {
      display: flex;
      gap: 24px;
      font-size: 13px;
      opacity: 0.8;
      flex-wrap: wrap;
    }
    .report-header .meta-row span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .stat-box.stat-green { border-color: #bbf7d0; background: #f0fdf4; }
    .stat-box.stat-red { border-color: #fecaca; background: #fef2f2; }
    .stat-box.stat-blue { border-color: #bae6fd; background: #f0f9ff; }
    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 4px; font-weight: 600; }
    .stat-value { font-size: 26px; font-weight: 800; color: #0f172a; }
    .stat-green .stat-value { color: #16a34a; }
    .stat-red .stat-value { color: #dc2626; }
    .stat-blue .stat-value { color: #0284c7; }

    /* Info Table */
    .info-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .info-section h2 {
      font-size: 15px;
      font-weight: 700;
      padding: 14px 20px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table tr { border-bottom: 1px solid #e2e8f0; }
    .info-table tr:last-child { border-bottom: none; }
    .info-table .info-label {
      padding: 12px 20px;
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
      width: 160px;
      background: #f8fafc;
    }
    .info-table .info-value {
      padding: 12px 20px;
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
    }

    /* Items Table */
    .items-section {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .items-section h2 {
      font-size: 15px;
      font-weight: 700;
      padding: 14px 20px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead { background: #0f172a; color: white; }
    .items-table th {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 700;
      text-align: right;
    }
    .items-table th:first-child,
    .items-table td:first-child { text-align: center; width: 50px; }
    .items-table th:nth-child(3),
    .items-table td:nth-child(3) { text-align: center; }
    .items-table th:nth-child(4),
    .items-table td:nth-child(4) { text-align: center; }
    .items-table td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .items-table tbody tr:nth-child(even) { background: #f8fafc; }
    .items-table tbody tr:hover { background: #f1f5f9; }

    /* Footer */
    .report-footer {
      text-align: center;
      padding: 20px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      margin-top: 20px;
    }

    /* Print button */
    .print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      padding: 12px 24px;
      display: flex;
      gap: 12px;
      justify-content: center;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-bar button {
      background: #14b8a6;
      color: white;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 700;
      font-family: inherit;
    }
    .print-bar button:hover { background: #0d9488; }
    .print-bar button.close-btn { background: #64748b; }
    .print-bar button.close-btn:hover { background: #475569; }
    .print-spacer { height: 60px; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="close-btn" onclick="window.close()">✕ إغلاق</button>
  </div>
  <div class="print-spacer no-print"></div>

  <div class="page">
    <div class="report-header">
      <h1>${titleText}</h1>
      <div class="ref-number">${selectedOperation.inventory_number}</div>
      <div class="meta-row">
        <span>📅 تاريخ العملية: ${operationDate}</span>
        <span>🏢 ${selectedOperation.branch_name || "غير محدد"}</span>
        ${selectedOperation.employee_name ? `<span>👤 ${selectedOperation.employee_name}</span>` : ""}
      </div>
    </div>

    ${statsHTML}

    <div class="info-section">
      <h2>معلومات العملية</h2>
      <table class="info-table">
        <tr>
          <td class="info-label">نوع العملية</td>
          <td class="info-value">${getInventoryTypeLabel(selectedOperation.inventory_type)}</td>
        </tr>
        <tr>
          <td class="info-label">الفرع</td>
          <td class="info-value">${selectedOperation.branch_name || "غير محدد"}</td>
        </tr>
        ${selectedOperation.employee_name ? `<tr><td class="info-label">الموظف</td><td class="info-value">${selectedOperation.employee_name}</td></tr>` : ""}
        <tr>
          <td class="info-label">تاريخ العملية</td>
          <td class="info-value">${operationDate}</td>
        </tr>
        <tr>
          <td class="info-label">تاريخ الإدخال</td>
          <td class="info-value">${entryDate}</td>
        </tr>
        ${transferInfo}
        ${receiptInfo}
        ${opStats && !isTransfer && !isReceipt ? `<tr><td class="info-label">إجمالي الكميات</td><td class="info-value">${opStats.totalQuantity} وحدة</td></tr>` : ""}
        ${noteRow}
      </table>
    </div>

    ${
      items.length > 0
        ? `<div class="items-section">
        <h2>تفاصيل الأصناف (${items.length} صنف)</h2>
        <table class="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>اسم الصنف</th>
              <th>الكمية</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>`
        : ""
    }

    <div class="report-footer">
      <p>تم إنشاء هذا التقرير بواسطة نظام إدارة المخزون</p>
      <p>تاريخ الطباعة: ${now}</p>
    </div>
  </div>
</body>
</html>`;
}

function openPrintableReport(selectedOperation, operationDetails, opStats) {
  const html = buildPrintHTML(selectedOperation, operationDetails, opStats);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("الرجاء السماح بفتح النوافذ المنبثقة للتصدير");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  };
}

export function OperationDetailsModal({
  selectedOperation,
  operationDetails,
  onClose,
  onDelete,
  onEdit,
}) {
  const isTransfer = selectedOperation?.inventory_type === "Transfer";
  const isReceipt = selectedOperation?.inventory_type === "Receipt";
  const isInventory = !isTransfer && !isReceipt;

  const titleText = isReceipt
    ? "تفاصيل الوارد"
    : isTransfer
      ? "تفاصيل التحويل"
      : "تفاصيل الجرد";

  const opStats = getOperationItemStats(operationDetails);

  const titleIcon = isTransfer ? (
    <span className={`${ws.iconBox} w-10 h-10 text-amber-200`}>
      <ArrowLeftRight className="w-5 h-5" />
    </span>
  ) : isReceipt ? (
    <span className={`${ws.iconBox} w-10 h-10 text-emerald-200`}>
      <PackagePlus className="w-5 h-5" />
    </span>
  ) : null;

  const handlePrint = () => {
    openPrintableReport(selectedOperation, operationDetails, opStats);
  };

  const handleExportPDF = () => {
    openPrintableReport(selectedOperation, operationDetails, opStats);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-4xl max-h-[95dvh] sm:max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden`}
      >
        <div
          className={`p-4 sm:p-6 flex items-center justify-between flex-shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight mb-1 flex items-center gap-2">
              {titleIcon}
              <span className="truncate">{titleText}</span>
            </h3>
            <p className="text-white/50 font-mono text-xs sm:text-sm truncate">
              {selectedOperation.inventory_number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
          {!operationDetails ? (
            <div className="py-16 text-center text-white/55">
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
                <span>جاري تحميل التفاصيل…</span>
              </div>
            </div>
          ) : (
            <>
              {isInventory && opStats ? (
                <OperationStatsCards stats={opStats} />
              ) : null}

              <OperationInfoGrid
                selectedOperation={selectedOperation}
                totalQuantity={isInventory ? opStats?.totalQuantity : undefined}
              />

              {isInventory && opStats ? (
                <AvailabilityProgressBar stats={opStats} />
              ) : null}

              {isTransfer ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-white/70 text-sm">
                  هذه عملية تحويل. القائمة أدناه تُظهر الكميات المسجلة للأصناف
                  المتأثرة بعد التحويل.
                </div>
              ) : null}

              {isReceipt ? (
                <div className="bg-emerald-500/5 border border-emerald-400/15 rounded-2xl p-4 text-white/70 text-sm">
                  هذا سجل وارد. القائمة أدناه تُظهر الصنف والكمية الواردة.
                </div>
              ) : null}

              <OperationItemsList operationDetails={operationDetails} />
            </>
          )}
        </div>

        <div
          className={`p-4 sm:p-6 border-t ${ws.divider} flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0`}
        >
          <button
            type="button"
            onClick={handlePrint}
            disabled={!operationDetails}
            className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center disabled:opacity-40 text-sm sm:text-base`}
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>طباعة التقرير</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={!operationDetails}
            className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center disabled:opacity-40 text-sm sm:text-base`}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>تصدير PDF</span>
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onEdit(selectedOperation, operationDetails);
                onClose();
              }}
              disabled={!operationDetails}
              className={`${ws.btnNeutral} px-4 py-3 justify-center disabled:opacity-40 text-sm sm:text-base`}
            >
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-sky-200" />
              <span>تعديل</span>
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(selectedOperation);
              }}
              className={`${ws.btnDanger} px-4 py-3 justify-center text-sm sm:text-base`}
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>حذف</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
