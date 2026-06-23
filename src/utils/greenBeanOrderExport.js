import {
  formatMoney,
  formatQty,
  groupOrderItems,
} from "@/utils/greenBeanOrderUtils";
import { formatRiyadhDateForInput, LOCALE } from "@/utils/dateUtils";

const VAT_MULTIPLIER = 1.15;

function buildItemTableHeaders() {
  return [
    "#",
    "البن",
    "عدد الخياش",
    "سعر الكيلو (بدون ضريبة)",
    "سعر الكيلو (شامل الضريبة)",
    "حجم الخيشة (كغ)",
    "تكلفة التحميص/كغ (شامل)",
    "تكلفة إضافية/كغ",
    "كمية الإضافي (كغ)",
    "الهدر %",
    "الواصل بعد الهدر (كغ)",
    "تكلفة البن (شامل)",
    "تكلفة التحميص (شامل)",
    "التكلفة الإضافية",
    "إجمالي الصنف (شامل)",
    "السعر الصافي/كغ",
  ];
}

// Build one export row per group (bean+identical params). Scalar params
// (price/kg, waste%, size) come from any one bag in the group — they're
// identical by construction. Quantity totals (bean cost, roast total,
// extra total, item total, received kg) are scaled by `bagCount` so the
// export numbers still reflect the *full* order across all bags.
function buildItemTableRow(group, idx) {
  const it = group.firstItem;
  const bagCount = group.bagCount;
  const beanName = it.bean_name_snapshot || it.bean_name_current || "—";
  const price = Number(it.price_kg_excl_tax);
  const bag = Number(it.bag_size_kg);
  const roastIncl = Number(it.roast_cost_incl_tax);
  const extraPerKg = Number(it.extra_cost_per_kg);
  const extraKg = it.extra_cost_kg != null ? Number(it.extra_cost_kg) : null;
  const waste = Number(it.waste_percent);

  const priceInclTax = Number.isFinite(price) ? price * VAT_MULTIPLIER : NaN;

  const beanCostInclPerBag =
    Number.isFinite(price) && Number.isFinite(bag)
      ? price * VAT_MULTIPLIER * bag
      : NaN;
  const beanCostIncl = Number.isFinite(beanCostInclPerBag)
    ? beanCostInclPerBag * bagCount
    : NaN;

  const roastPerBag =
    Number.isFinite(roastIncl) && Number.isFinite(bag) ? roastIncl * bag : NaN;
  const roastTotal = Number.isFinite(roastPerBag)
    ? roastPerBag * bagCount
    : NaN;

  const effectiveExtraKg =
    extraKg !== null && Number.isFinite(extraKg) ? extraKg : bag;
  const extraPerBag =
    Number.isFinite(extraPerKg) && Number.isFinite(effectiveExtraKg)
      ? extraPerKg * effectiveExtraKg
      : 0;
  const extraTotal = extraPerBag * bagCount;

  const extraCostKgText = extraKg !== null ? formatQty(extraKg) : "الكل";
  const bagCountText = String(bagCount);

  return [
    String(idx + 1),
    beanName,
    bagCountText,
    formatMoney(price),
    formatMoney(priceInclTax),
    formatQty(bag),
    formatMoney(roastIncl),
    formatMoney(extraPerKg),
    extraCostKgText,
    formatMoney(waste),
    formatQty(group.totalReceived),
    formatMoney(beanCostIncl),
    formatMoney(roastTotal),
    formatMoney(extraTotal),
    formatMoney(group.totalCostIncl),
    formatMoney(it.computed_final_price_per_kg),
  ];
}

export function exportGreenBeanOrderExcel(order, items, totals) {
  const headers = buildItemTableHeaders();
  const thRow = headers.map((h) => `<th>${h}</th>`).join("");
  const colCount = headers.length;

  // Same grouping as the on-screen table — one export row per
  // (bean + identical params), bag count in its own column. Totals still
  // reflect the full order because per-bag scalars are multiplied by
  // bagCount inside buildItemTableRow.
  const groups = groupOrderItems(items);
  const bodyRows = groups
    .map((g, idx) => {
      const cells = buildItemTableRow(g, idx);
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  const orderDate = order.order_date
    ? String(order.order_date).slice(0, 10)
    : "—";
  const supplierName = order.supplier_name || "—";
  const note = order.note || "";
  const createdBy = order.created_by_employee_name || "—";
  const createdAt = order.created_at
    ? formatRiyadhDateForInput(order.created_at)
    : "—";

  const now = new Date().toLocaleDateString(LOCALE, {
    timeZone: "Asia/Riyadh",
  });

  const summaryRows = totals
    ? `
    <tr><td colspan="${colCount}" style="height:15px;border:none;"></td></tr>
    <tr><td colspan="${colCount}" style="font-weight:bold;font-size:14px;background:#1e293b;color:white;padding:10px;border:1px solid #94a3b8;">ملخص الطلب</td></tr>
    <tr><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">عدد أنواع البن</td><td style="padding:6px;border:1px solid #ddd;">${totals.beanTypesCount}</td><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">عدد الخياش</td><td style="padding:6px;border:1px solid #ddd;">${totals.totalBags}</td><td colspan="${colCount - 6}" style="border:1px solid #ddd;"></td></tr>
    <tr><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">مجموع الكيلوات</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.totalKg)} كغ</td><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">الواصل بعد الهدر</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.totalReceivedKg)} كغ</td><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">كمية الهدر</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.wasteKg)} كغ (${formatMoney(totals.wastePercent)}%)</td><td colspan="${colCount - 9}" style="border:1px solid #ddd;"></td></tr>
    <tr><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">إجمالي تكلفة البن (شامل الضريبة)</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.totalBeanCostIncl)} ر.س</td><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">إجمالي تكلفة التحميص (شامل)</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.totalRoastIncl)} ر.س</td><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">إجمالي التكلفة الإضافية</td><td style="padding:6px;border:1px solid #ddd;">${formatMoney(totals.totalExtra)} ر.س</td><td colspan="${colCount - 9}" style="border:1px solid #ddd;"></td></tr>
    <tr><td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">متوسط السعر الصافي / كغ</td><td style="padding:6px;font-weight:bold;color:#059669;border:1px solid #ddd;">${formatMoney(totals.avgPricePerKg)} ر.س</td><td colspan="${colCount - 3}" style="border:1px solid #ddd;"></td></tr>
    <tr style="background:#0f172a;"><td colspan="2" style="font-weight:bold;padding:10px;color:white;border:1px solid #94a3b8;">إجمالي الطلب (شامل)</td><td colspan="${colCount - 2}" style="padding:10px;font-weight:bold;font-size:16px;color:white;border:1px solid #94a3b8;">${formatMoney(totals.totalGrand)} ر.س</td></tr>
  `
    : "";

  const noteRow = note
    ? `<tr><td colspan="${colCount}" style="padding:6px;border:1px solid #ddd;"><b>ملاحظة:</b> ${note}</td></tr>`
    : "";

  const htmlContent = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; direction: rtl; }
          th { background-color: #0f172a; color: white; padding: 10px 8px; text-align: right; border: 1px solid #94a3b8; font-weight: bold; font-size: 12px; white-space: nowrap; }
          td { padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 12px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="${colCount}" style="font-size:18px;font-weight:bold;padding:12px;text-align:center;background:#0f172a;color:white;border:1px solid #94a3b8;">توريد البن الأخضر - طلب #${String(order.id)}</td></tr>
          <tr>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">رقم الطلب</td><td style="padding:6px;border:1px solid #ddd;">#${String(order.id)}</td>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">تاريخ الطلب</td><td style="padding:6px;border:1px solid #ddd;">${orderDate}</td>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">المورّد</td><td style="padding:6px;border:1px solid #ddd;">${supplierName}</td>
            <td colspan="${colCount - 9}" style="border:1px solid #ddd;"></td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">منشئ الطلب</td><td style="padding:6px;border:1px solid #ddd;">${createdBy}</td>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">تاريخ الإنشاء</td><td style="padding:6px;border:1px solid #ddd;">${createdAt}</td>
            <td colspan="2" style="font-weight:bold;padding:6px;border:1px solid #ddd;">تاريخ التصدير</td><td style="padding:6px;border:1px solid #ddd;">${now}</td>
            <td colspan="${colCount - 9}" style="border:1px solid #ddd;"></td>
          </tr>
          ${noteRow}
          <tr><td colspan="${colCount}" style="height:10px;border:none;"></td></tr>
          <tr>${thRow}</tr>
          ${bodyRows}
          ${summaryRows}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const filename = `توريد_بن_اخضر_طلب_${String(order.id)}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportGreenBeanOrderPDF(order, items, totals) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("الرجاء السماح بفتح النوافذ المنبثقة للتصدير");
    return;
  }

  const headers = buildItemTableHeaders();
  const thRow = headers.map((h) => `<th>${h}</th>`).join("");

  // Same grouping logic as Excel + on-screen table.
  const groups = groupOrderItems(items);
  const bodyRows = groups
    .map((g, idx) => {
      const cells = buildItemTableRow(g, idx);
      const lastIdx = cells.length - 1;
      return `<tr>${cells
        .map((c, ci) => {
          const cls = ci === lastIdx ? ' class="accent-cell"' : "";
          return `<td${cls}>${c}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");

  const orderDate = order.order_date
    ? String(order.order_date).slice(0, 10)
    : "—";
  const supplierName = order.supplier_name || "";
  const note = order.note || "";
  const createdBy = order.created_by_employee_name || "—";

  const now = new Date().toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  });

  const summaryBlock = totals
    ? `
    <div class="summary-container">
      <h2>ملخص الطلب</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="s-label">عدد أنواع البن</div>
          <div class="s-value">${totals.beanTypesCount}</div>
        </div>
        <div class="summary-card">
          <div class="s-label">عدد الخياش</div>
          <div class="s-value">${totals.totalBags}</div>
        </div>
        <div class="summary-card">
          <div class="s-label">مجموع الكيلوات</div>
          <div class="s-value">${formatMoney(totals.totalKg)} كغ</div>
        </div>
        <div class="summary-card">
          <div class="s-label">الواصل بعد الهدر</div>
          <div class="s-value">${formatMoney(totals.totalReceivedKg)} كغ</div>
        </div>
        <div class="summary-card warn">
          <div class="s-label">كمية الهدر</div>
          <div class="s-value">${formatMoney(totals.wasteKg)} كغ (${formatMoney(totals.wastePercent)}%)</div>
        </div>
        <div class="summary-card">
          <div class="s-label">تكلفة البن (شامل الضريبة)</div>
          <div class="s-value">${formatMoney(totals.totalBeanCostIncl)} ر.س</div>
        </div>
        <div class="summary-card">
          <div class="s-label">تكلفة التحميص (شامل)</div>
          <div class="s-value">${formatMoney(totals.totalRoastIncl)} ر.س</div>
        </div>
        <div class="summary-card">
          <div class="s-label">التكلفة الإضافية</div>
          <div class="s-value">${formatMoney(totals.totalExtra)} ر.س</div>
        </div>
        <div class="summary-card accent">
          <div class="s-label">متوسط السعر الصافي / كغ</div>
          <div class="s-value">${formatMoney(totals.avgPricePerKg)} ر.س</div>
        </div>
      </div>
      <div class="grand-total-bar">
        <span>إجمالي الطلب (شامل)</span>
        <span class="grand-total-value">${formatMoney(totals.totalGrand)} ر.س</span>
      </div>
    </div>
  `
    : "";

  const supplierLine = supplierName
    ? `<p>المورّد: <strong>${supplierName}</strong></p>`
    : "";
  const noteLine = note
    ? `<p style="margin-top:10px;font-size:13px;">ملاحظة: ${note}</p>`
    : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>توريد البن الأخضر - طلب #${String(order.id)}</title>
        <style>
          @media print {
            @page { size: A3 landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f5f5f5; direction: rtl; }

          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 25px 30px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
          .header h1 { font-size: 24px; margin-bottom: 8px; }
          .header p { font-size: 13px; opacity: 0.9; margin: 3px 0; }

          .order-info { background: white; border-radius: 10px; padding: 15px 20px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); display: flex; gap: 30px; flex-wrap: wrap; }
          .order-info .info-item { font-size: 13px; }
          .order-info .info-label { color: #64748b; }
          .order-info .info-value { font-weight: bold; color: #0f172a; }

          .summary-container { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
          .summary-container h2 { font-size: 16px; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #14b8a6; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
          .summary-card { background: #f8fafc; border-radius: 8px; padding: 10px 12px; border: 1px solid #e2e8f0; }
          .summary-card.accent { background: #ecfdf5; border-color: #6ee7b7; }
          .summary-card.warn { background: #fff7ed; border-color: #fdba74; }
          .s-label { font-size: 10px; color: #64748b; margin-bottom: 3px; }
          .s-value { font-size: 15px; font-weight: bold; color: #0f172a; }
          .summary-card.accent .s-value { color: #059669; }
          .summary-card.warn .s-value { color: #c2410c; }
          .grand-total-bar { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 12px 18px; border-radius: 8px; font-size: 15px; font-weight: bold; }
          .grand-total-value { font-size: 20px; color: #6ee7b7; }

          table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
          thead { background: #0f172a; color: white; }
          th { padding: 10px 6px; text-align: right; font-weight: bold; font-size: 11px; border-bottom: 2px solid #14b8a6; white-space: nowrap; }
          td { padding: 8px 6px; text-align: right; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          td.accent-cell { color: #059669; font-weight: bold; }

          .footer { margin-top: 25px; text-align: center; color: #666; font-size: 11px; padding: 15px; }
          .print-button { position: fixed; top: 20px; left: 20px; background: #14b8a6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; }
          .print-button:hover { background: #0d9488; }

          @media print {
            body { background: white; padding: 0; }
            .header, table, .summary-container, .order-info { box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>

        <div class="header">
          <h1>توريد البن الأخضر - طلب #${String(order.id)}</h1>
          ${supplierLine}
          <p>تاريخ الطلب: ${orderDate} &nbsp;|&nbsp; منشئ الطلب: ${createdBy}</p>
          <p>تاريخ التصدير: ${now}</p>
          ${noteLine}
        </div>

        ${summaryBlock}

        <table>
          <thead><tr>${thRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>

        <div class="footer">
          <p>تم الإنشاء بواسطة نظام إدارة المخزون</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  };
}
