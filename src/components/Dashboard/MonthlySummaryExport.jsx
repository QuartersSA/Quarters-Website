import { FileDown, Printer } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function getHealthLabel(score) {
  if (score >= 80) return "ممتاز";
  if (score >= 60) return "جيد";
  if (score >= 40) return "يحتاج تحسين";
  return "حرج";
}

function formatCost(val) {
  if (!val) return "0";
  return Number(val).toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function MonthlySummaryExport({ analytics, stats }) {
  if (!analytics || !stats) return null;

  const currentMonth = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
    month: "long",
    year: "numeric",
  });

  const handleExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("الرجاء السماح بفتح النوافذ المنبثقة للتصدير");
      return;
    }

    const branchRows = (analytics.branchPerformance || [])
      .map(
        (b) => `
      <tr>
        <td>${b.name}</td>
        <td>${b.ops_this_month}</td>
        <td>${b.completion_rate}%</td>
        <td>${b.low_stock_count}</td>
        <td>${b.out_of_stock_count}</td>
      </tr>
    `,
      )
      .join("");

    const costRows = (analytics.inventoryCost?.byBranch || [])
      .map(
        (c) => `
      <tr>
        <td>${c.branch_name}</td>
        <td>${formatCost(c.total_cost)} ر.س</td>
        <td>${c.priced_items}</td>
      </tr>
    `,
      )
      .join("");

    const depletionRows = (analytics.depletionPredictions || [])
      .slice(0, 10)
      .map(
        (d) => `
      <tr>
        <td>${d.item_name}</td>
        <td>${d.branch_name}</td>
        <td>${d.current_qty} ${d.unit}</td>
        <td>${d.daily_consumption}</td>
        <td style="color: ${d.days_to_depletion <= 3 ? "#ef4444" : d.days_to_depletion <= 7 ? "#f59e0b" : "#22c55e"}; font-weight: bold;">
          ${d.days_to_depletion} يوم
        </td>
      </tr>
    `,
      )
      .join("");

    const now = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const healthScore = analytics.healthScore ?? 0;
    const healthColor =
      healthScore >= 80 ? "#22c55e" : healthScore >= 60 ? "#f59e0b" : "#ef4444";

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ملخص شهري — ${currentMonth}</title>
        <style>
          @media print {
            @page { size: A4; margin: 15mm; }
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; background: #f8fafc; color: #1e293b; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; text-align: center; }
          .header h1 { font-size: 28px; margin-bottom: 8px; }
          .header p { opacity: 0.8; font-size: 14px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          .summary-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .summary-card .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
          .summary-card .value { font-size: 28px; font-weight: bold; color: #0f172a; }
          .health-badge { display: inline-block; padding: 6px 16px; border-radius: 999px; color: white; font-weight: bold; font-size: 18px; }
          .section { margin-bottom: 24px; }
          .section h2 { font-size: 18px; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          th { background: #0f172a; color: white; padding: 12px; text-align: right; font-size: 13px; }
          td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; padding: 16px; }
          .print-btn { position: fixed; top: 16px; left: 16px; background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; z-index: 100; }
          .print-btn:hover { background: #1e293b; }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>

        <div class="header">
          <h1>📊 ملخص شهري — ${currentMonth}</h1>
          <p>تم الإنشاء: ${now}</p>
          <div style="margin-top: 16px;">
            <span class="health-badge" style="background: ${healthColor}">
              صحة المخزون: ${healthScore}/100 (${getHealthLabel(healthScore)})
            </span>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">إجمالي العمليات</div>
            <div class="value">${stats.totalOperations}</div>
          </div>
          <div class="summary-card">
            <div class="label">المكتملة</div>
            <div class="value">${stats.completedOperations}</div>
          </div>
          <div class="summary-card">
            <div class="label">نسبة الاكتمال</div>
            <div class="value">${stats.completionRate}%</div>
          </div>
          <div class="summary-card">
            <div class="label">قيمة المخزون</div>
            <div class="value">${formatCost(analytics.inventoryCost?.totalCost)} ر.س</div>
          </div>
        </div>

        <div class="section">
          <h2>🏢 أداء الفروع</h2>
          <table>
            <thead><tr><th>الفرع</th><th>عمليات الشهر</th><th>نسبة الاكتمال</th><th>أصناف منخفضة</th><th>نفدت</th></tr></thead>
            <tbody>${branchRows || '<tr><td colspan="5" style="text-align:center">لا بيانات</td></tr>'}</tbody>
          </table>
        </div>

        <div class="section">
          <h2>💰 تكلفة المخزون حسب الفرع</h2>
          <table>
            <thead><tr><th>الفرع</th><th>إجمالي التكلفة</th><th>أصناف مسعّرة</th></tr></thead>
            <tbody>${costRows || '<tr><td colspan="3" style="text-align:center">لا بيانات</td></tr>'}</tbody>
          </table>
        </div>

        ${
          depletionRows
            ? `
        <div class="section">
          <h2>⚠️ توقعات النفاد</h2>
          <table>
            <thead><tr><th>الصنف</th><th>الفرع</th><th>الكمية الحالية</th><th>استهلاك يومي</th><th>أيام للنفاد</th></tr></thead>
            <tbody>${depletionRows}</tbody>
          </table>
        </div>
        `
            : ""
        }

        <div class="section">
          <h2>📈 مقارنة أسبوعية</h2>
          <table>
            <thead><tr><th>هذا الأسبوع</th><th>الأسبوع الماضي</th><th>التغيير</th></tr></thead>
            <tbody>
              <tr>
                <td>${analytics.weekComparison?.thisWeek || 0}</td>
                <td>${analytics.weekComparison?.lastWeek || 0}</td>
                <td style="color: ${(analytics.weekComparison?.changePercent || 0) >= 0 ? "#22c55e" : "#ef4444"}; font-weight: bold;">
                  ${analytics.weekComparison?.changePercent || 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>تم الإنشاء بواسطة نظام إدارة المخزون — Quarters</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.focus(), 250);
    };
  };

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5 mb-8`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold tracking-tight">
            📊 ملخص شهري قابل للتصدير
          </h3>
          <p className="text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm mt-0.5">
            تقرير شامل يشمل أداء الفروع + حالة المخزون + التكلفة + التوقعات
          </p>
        </div>
        <button
          onClick={handleExport}
          className={`${ws.btnPrimary} px-5 py-2.5`}
        >
          <Printer className="w-5 h-5" />
          <span>إنشاء التقرير الشهري</span>
        </button>
      </div>
    </div>
  );
}
