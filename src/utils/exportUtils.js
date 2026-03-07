/**
 * Export utilities for Excel and PDF generation
 * Supports Arabic RTL content
 */

/**
 * Convert data to Excel (XLSX) format and download
 * Uses pure JavaScript without external libraries
 */
export function exportToExcel(data, filename, columns) {
  // Create worksheet data
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = col.accessor(item);
      return value ?? "";
    }),
  );

  // Combine headers and rows
  const worksheetData = [headers, ...rows];

  // Convert to CSV format (Excel can open CSV with UTF-8 BOM)
  const csv = worksheetData
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  // Add UTF-8 BOM for proper Arabic encoding in Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], {
    type: "text/csv;charset=utf-8;",
  });

  // Download file
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export to Excel with better formatting (uses HTML table trick)
 * This creates a proper Excel file that can be opened in Excel
 */
export function exportToExcelHTML(data, filename, columns, title) {
  // Create HTML table
  const headers = columns.map((col) => col.header).join("</th><th>");
  const rows = data
    .map(
      (item) =>
        `<tr>${columns
          .map((col) => {
            const value = col.accessor(item);
            const formatted = col.format ? col.format(value, item) : value;
            return `<td>${formatted ?? ""}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  const now = new Date().toLocaleDateString("ar-SA-u-nu-latn");

  const htmlContent = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          table { 
            border-collapse: collapse; 
            width: 100%; 
            font-family: Arial, sans-serif;
            direction: rtl;
          }
          th { 
            background-color: #0f172a; 
            color: white; 
            padding: 12px; 
            text-align: right;
            border: 1px solid #ddd;
            font-weight: bold;
          }
          td { 
            padding: 10px; 
            border: 1px solid #ddd;
            text-align: right;
          }
          tr:nth-child(even) { 
            background-color: #f9f9f9; 
          }
          .header {
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 {
            color: #0f172a;
            margin: 10px 0;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>تاريخ الإنشاء: ${now}</p>
        </div>
        <table>
          <thead>
            <tr><th>${headers}</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  downloadBlob(blob, `${filename}.xls`);
}

/**
 * Export data to PDF using print dialog
 * Creates a formatted print-friendly page
 */
export function exportToPDF(data, filename, columns, title) {
  // Create a new window for printing
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("الرجاء السماح بفتح النوافذ المنبثقة للتصدير");
    return;
  }

  const headers = columns.map((col) => col.header).join("</th><th>");
  const rows = data
    .map(
      (item) =>
        `<tr>${columns
          .map((col) => {
            const value = col.accessor(item);
            const formatted = col.format ? col.format(value, item) : value;
            return `<td>${formatted ?? ""}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  const now = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            direction: rtl;
          }
          
          .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: bold;
          }
          
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          
          .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
          }
          
          .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
          }
          
          .stat-card .label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
          }
          
          .stat-card .value {
            font-size: 24px;
            font-weight: bold;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          thead {
            background: #0f172a;
            color: white;
          }
          
          th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
            font-size: 14px;
            border-bottom: 2px solid #14b8a6;
          }
          
          td {
            padding: 12px 15px;
            text-align: right;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          
          tr:hover {
            background-color: #f1f5f9;
          }
          
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
            padding: 20px;
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #14b8a6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          
          .print-button:hover {
            background: #0d9488;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .header {
              border-radius: 0;
            }
            table {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">
          🖨️ طباعة / حفظ PDF
        </button>
        
        <div class="header">
          <h1>${title}</h1>
          <p>تاريخ الإنشاء: ${now}</p>
          <div class="stats">
            <div class="stat-card">
              <div class="label">إجمالي السجلات</div>
              <div class="value">${data.length}</div>
            </div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr><th>${headers}</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>تم الإنشاء بواسطة نظام إدارة المخزون</p>
          <p>© ${new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Auto print after content loads
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  };
}

/**
 * Helper function to download blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format status for export
 */
export function formatStatus(status) {
  const statusMap = {
    Completed: "مكتمل",
    Pending: "قيد الانتظار",
    "In Progress": "قيد التنفيذ",
  };
  return statusMap[status] || status;
}

/**
 * Format inventory type for export
 */
export function formatInventoryType(type) {
  const typeMap = {
    Daily: "يومي",
    Weekly: "أسبوعي",
    Transfer: "تحويل",
    Receipt: "وارد",
    Opening: "مخزون افتتاحي",
  };
  return typeMap[type] || type;
}

/**
 * Format role for export
 */
export function formatRole(role) {
  const roleMap = {
    Admin: "مدير",
    Employee: "موظف",
  };
  return roleMap[role] || role;
}

/**
 * Strip trailing "Z" that neon adds to "timestamp without time zone" columns.
 * Without this fix, dates shift by the user's UTC offset every time they
 * are displayed or round-tripped through an edit form.
 */
function stripTZ(v) {
  if (!v) return v;
  return String(v).replace(/Z$/i, "");
}

/**
 * Format date for export
 */
export function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(stripTZ(dateString)).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date and time for export
 */
export function formatDateTime(dateString) {
  if (!dateString) return "-";
  // IMPORTANT: use toLocaleString (not toLocaleDateString) so time is always rendered
  // across browsers (especially iOS/Safari) when hour/minute options are provided.
  return new Date(stripTZ(dateString)).toLocaleString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
