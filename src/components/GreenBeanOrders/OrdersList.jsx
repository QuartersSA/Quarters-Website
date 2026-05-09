import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import ExportMenu from "@/components/GreenBeanOrders/ExportMenu";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, formatQty } from "@/utils/greenBeanOrderUtils";

function computeMonthRange(monthValue) {
  const text = String(monthValue || "");
  if (!/^\d{4}-\d{2}$/.test(text)) {
    return { from: "", to: "" };
  }

  const yyyy = text.slice(0, 4);
  const mm = text.slice(5, 7);
  const monthNum = Number(mm);
  const yearNum = Number(yyyy);
  if (!Number.isFinite(monthNum) || !Number.isFinite(yearNum)) {
    return { from: "", to: "" };
  }

  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const dd = String(lastDay).padStart(2, "0");

  return {
    from: `${yyyy}-${mm}-01`,
    to: `${yyyy}-${mm}-${dd}`,
  };
}

function defaultMonthValue() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  } catch {
    return "";
  }
}

export function OrdersList({
  orders,
  selectedOrderId,
  onSelectOrder,
  onDeleteOrder,
  isLoading,
  error,
  deleteDisabled,
  filterMonth = "",
  onFilterMonthChange,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const initialMonth = useMemo(() => defaultMonthValue(), []);
  const initialRange = useMemo(
    () => computeMonthRange(initialMonth),
    [initialMonth],
  );

  const [exportMonth, setExportMonth] = useState(initialMonth);
  const [exportFrom, setExportFrom] = useState(initialRange.from);
  const [exportTo, setExportTo] = useState(initialRange.to);

  const selectOptions = useMemo(() => {
    const base = [{ value: "", label: "اختر طلب لعرض التفاصيل" }];
    const items = Array.isArray(orders)
      ? orders.map((o) => ({
          value: String(o.id),
          label: `#${o.id} — ${o.order_date}`,
        }))
      : [];
    return [...base, ...items];
  }, [orders]);

  const exportColumns = useMemo(
    () => [
      { header: "رقم الطلب", accessor: (r) => r.order_id },
      { header: "تاريخ الطلب", accessor: (r) => r.order_date },
      { header: "المورّد", accessor: (r) => r.supplier_name },
      { header: "البن", accessor: (r) => r.bean_name },
      {
        header: "سعر الكيلو (بدون ضريبة)",
        accessor: (r) => r.price_kg_excl_tax,
        format: (v) => formatMoney(v),
      },
      {
        header: "حجم الخيشة (كغ)",
        accessor: (r) => r.bag_size_kg,
        format: (v) => formatQty(v),
      },
      {
        header: "تحميص/كغ (شامل)",
        accessor: (r) => r.roast_cost_incl_tax,
        format: (v) => formatMoney(v),
      },
      {
        header: "تكلفة إضافية/كغ",
        accessor: (r) => r.extra_cost_per_kg,
        format: (v) => formatMoney(v),
      },
      {
        header: "الهدر %",
        accessor: (r) => r.waste_percent,
        format: (v) => formatMoney(v),
      },
      {
        header: "الواصل بعد الهدر (كغ)",
        accessor: (r) => r.computed_received_after_waste_kg,
        format: (v) => formatQty(v),
      },
      {
        header: "السعر الصافي/كغ",
        accessor: (r) => r.computed_final_price_per_kg,
        format: (v) => formatMoney(v),
      },
      {
        header: "إجمالي الصنف (شامل)",
        accessor: (r) => r.computed_total_incl,
        format: (v) => formatMoney(v),
      },
      {
        header: "إجمالي الطلب (شامل)",
        accessor: (r) => r.order_total_incl,
        format: (v) => formatMoney(v),
      },
      { header: "ملاحظة", accessor: (r) => r.note },
      { header: "منشئ الطلب", accessor: (r) => r.created_by_employee_name },
      { header: "تاريخ الإنشاء", accessor: (r) => r.created_at },
    ],
    [],
  );

  const exportMutation = useMutation({
    mutationFn: async ({ from, to }) => {
      const params = new URLSearchParams();
      params.set("includeItems", "1");
      params.set("limit", "2000");
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await adminFetch(
        `/api/accounting/green-bean-orders?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/green-bean-orders, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  const flattenExportRows = useCallback((ordersWithItems) => {
    const rows = [];
    const list = Array.isArray(ordersWithItems) ? ordersWithItems : [];

    for (const o of list) {
      const base = {
        order_id: `#${String(o.id)}`,
        order_date: o.order_date ? String(o.order_date) : "—",
        supplier_name: o.supplier_name || "—",
        note: o.note || "",
        created_by_employee_name: o.created_by_employee_name || "—",
        created_at: o.created_at ? String(o.created_at) : "—",
        order_total_incl: o.total_incl,
      };

      const items = Array.isArray(o.items) ? o.items : [];
      if (items.length === 0) {
        rows.push({ ...base, bean_name: "—" });
        continue;
      }

      for (const it of items) {
        rows.push({
          ...base,
          bean_name: it.bean_name_snapshot || "—",
          price_kg_excl_tax: it.price_kg_excl_tax,
          bag_size_kg: it.bag_size_kg,
          roast_cost_incl_tax: it.roast_cost_incl_tax,
          extra_cost_per_kg: it.extra_cost_per_kg,
          waste_percent: it.waste_percent,
          computed_received_after_waste_kg: it.computed_received_after_waste_kg,
          computed_final_price_per_kg: it.computed_final_price_per_kg,
          computed_total_incl: it.computed_total_incl,
        });
      }
    }

    return rows;
  }, []);

  const onExportArchive = useCallback(
    (kind) => {
      const from = exportFrom;
      const to = exportTo;

      if (!from || !to) {
        toast.error("اختر الشهر أو حدد من/إلى للتصدير");
        return;
      }

      exportMutation.mutate(
        { from, to },
        {
          onSuccess: (data) => {
            const ordersWithItems = Array.isArray(data?.orders)
              ? data.orders
              : [];
            if (ordersWithItems.length === 0) {
              toast.error("لا توجد طلبات في الفترة المحددة");
              return;
            }

            const rows = flattenExportRows(ordersWithItems);
            const filename = `توريد_بن_اخضر_${String(from)}_الى_${String(to)}`;
            const title = `توريد البن الأخضر - من ${String(from)} إلى ${String(to)}`;

            if (kind === "excel") {
              exportToExcelHTML(rows, filename, exportColumns, title);
              return;
            }

            exportToPDF(rows, filename, exportColumns, title);
          },
          onError: (e) => {
            console.error(e);
            toast.error(e?.message || "فشل التصدير");
          },
        },
      );
    },
    [exportFrom, exportTo, exportMutation, flattenExportRows, exportColumns],
  );

  const handleExportExcelClick = useCallback(() => {
    onExportArchive("excel");
  }, [onExportArchive]);

  const handleExportPdfClick = useCallback(() => {
    onExportArchive("pdf");
  }, [onExportArchive]);

  const handleExportMonthChange = useCallback((e) => {
    const v = e.target.value;
    setExportMonth(v);
    const r = computeMonthRange(v);
    setExportFrom(r.from);
    setExportTo(r.to);
  }, []);

  const handleExportFromChange = useCallback((e) => {
    setExportFrom(e.target.value);
  }, []);

  const handleExportToChange = useCallback((e) => {
    setExportTo(e.target.value);
  }, []);

  const handleDeleteSelectedOrder = useCallback(() => {
    if (!selectedOrderId) return;
    if (typeof window === "undefined") return;
    const ok = window.confirm("حذف الطلب؟");
    if (!ok) return;
    onDeleteOrder(selectedOrderId);
  }, [selectedOrderId, onDeleteOrder]);

  const isExporting = exportMutation.isPending;
  const exportHint =
    exportFrom && exportTo ? `${exportFrom} → ${exportTo}` : "";

  let content = null;

  if (isLoading) {
    content = <div className="mt-4 text-white/60">جاري التحميل…</div>;
  } else if (error) {
    content = <div className="mt-4 text-red-300">{error}</div>;
  } else if (!Array.isArray(orders) || orders.length === 0) {
    content = <div className="mt-4 text-white/60">لا يوجد طلبات بعد.</div>;
  } else {
    content = (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: "110px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "1fr" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr className="text-xs text-white/55">
              <th className="text-right py-2">رقم</th>
              <th className="text-right py-2">التاريخ</th>
              <th className="text-right py-2">المورّد</th>
              <th className="text-right py-2">الأصناف</th>
              <th className="text-right py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const isSelected = String(o.id) === String(selectedOrderId);
              const rowClass = isSelected
                ? "bg-white/10"
                : "bg-white/[0.02] hover:bg-white/[0.05]";

              return (
                <tr
                  key={o.id}
                  className={`${rowClass} border-t border-white/10`}
                >
                  <td className="py-2 text-white/85 font-semibold truncate">
                    #{o.id}
                  </td>
                  <td className="py-2 text-white/75 truncate">
                    {String(o.order_date || "—")}
                  </td>
                  <td className="py-2 text-white/75 truncate">
                    {o.supplier_name || "—"}
                  </td>
                  <td className="py-2 text-white/75 truncate">
                    {o.items_count ?? 0}
                  </td>
                  <td className="py-2 text-white font-bold truncate">
                    {formatMoney(o.total_incl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3 flex gap-2 flex-wrap">
          <GlassSelect
            value={selectedOrderId}
            onChange={onSelectOrder}
            options={selectOptions}
          />

          {selectedOrderId ? (
            <button
              type="button"
              className={`${ws.btnDanger} px-4 py-2`}
              onClick={handleDeleteSelectedOrder}
              disabled={deleteDisabled}
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const handleFilterMonthChange = (e) => {
    if (typeof onFilterMonthChange === "function") {
      onFilterMonthChange(e.target.value);
    }
  };

  return (
    <div className={cardShell}>
      <div className="text-white font-bold tracking-tight">الطلبات</div>
      <div className="text-xs text-white/50 mt-1">اختر طلب لفتح تفاصيله.</div>

      <div className="mt-3">
        <label className="block max-w-[220px]">
          <div className="text-xs text-white/55 mb-1">فلترة حسب الشهر</div>
          <input
            type="month"
            className={`${ws.input} px-3 py-2 w-full`}
            value={filterMonth}
            onChange={handleFilterMonthChange}
          />
          <div className="text-[11px] text-white/40 mt-1">
            اترك الحقل فارغاً لعرض كل الطلبات.
          </div>
        </label>
      </div>

      {content}

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-white font-bold tracking-tight">تصدير الأرشيف</div>
        <div className="text-xs text-white/50 mt-1">
          تصدير مفصل للأصناف داخل الطلبات (Excel / PDF).
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-xs text-white/55 mb-1">شهر</div>
            <input
              type="month"
              className={`${ws.input} px-3 py-2 w-full`}
              value={exportMonth}
              onChange={handleExportMonthChange}
            />
          </label>

          <label className="block">
            <div className="text-xs text-white/55 mb-1">من</div>
            <input
              type="date"
              className={`${ws.input} px-3 py-2 w-full`}
              value={exportFrom}
              onChange={handleExportFromChange}
            />
          </label>

          <label className="block">
            <div className="text-xs text-white/55 mb-1">إلى</div>
            <input
              type="date"
              className={`${ws.input} px-3 py-2 w-full`}
              value={exportTo}
              onChange={handleExportToChange}
            />
          </label>
        </div>

        {exportHint ? (
          <div className="mt-2 text-xs text-white/45">الفترة: {exportHint}</div>
        ) : null}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <ExportMenu
            label="تصدير الطلبات"
            onExcel={handleExportExcelClick}
            onPDF={handleExportPdfClick}
            disabled={isExporting}
          />
          {isExporting ? (
            <div className="text-xs text-white/55">جاري تجهيز التصدير…</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
