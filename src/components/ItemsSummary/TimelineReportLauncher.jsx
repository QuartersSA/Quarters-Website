"use client";

import { useMemo, useState } from "react";
import { LineChart as LineChartIcon, Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import ItemTimelineModal from "./ItemTimelineModal";

/**
 * "تقرير زمني": admin picks an item + branch, hits the button, and the
 * full timeline modal opens. Lives on the items-summary page between
 * the stats and the filters.
 *
 * Item options are derived from the same `groupedItems` source that
 * powers the items list — keeps the option set consistent with what
 * the admin already sees.
 */
export default function TimelineReportLauncher({ groupedItems, branches }) {
  const [itemId, setItemId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [open, setOpen] = useState(false);

  const itemOptions = useMemo(() => {
    const opts = [{ value: "", label: "اختر صنف…" }];
    for (const g of groupedItems || []) {
      opts.push({ value: String(g.id), label: g.name });
    }
    return opts;
  }, [groupedItems]);

  const branchOptions = useMemo(() => {
    const opts = [{ value: "", label: "اختر فرع…" }];
    for (const b of branches || []) {
      opts.push({ value: String(b.id), label: b.name });
    }
    return opts;
  }, [branches]);

  const canRun = !!itemId && !!branchId;

  return (
    <>
      <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-5 mb-6`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
            <LineChartIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold tracking-tight">تقرير زمني</h3>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-xs">
              اختر صنف + فرع لعرض الكميات منذ البداية كرسم بياني وكسجل عمليات.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <GlassSelect
              value={itemId}
              onChange={setItemId}
              options={itemOptions}
              buttonClassName="px-4 py-3"
              searchable
              searchPlaceholder="ابحث عن صنف…"
              noResultsLabel="لا يوجد صنف مطابق"
            />
          </div>
          <div className="sm:col-span-1">
            <GlassSelect
              value={branchId}
              onChange={setBranchId}
              options={branchOptions}
              buttonClassName="px-4 py-3"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!canRun}
            className={`${ws.btnPrimary} px-4 py-3 justify-center ${
              !canRun ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Package className="w-4 h-4" />
            <span>عرض التقرير</span>
          </button>
        </div>
      </div>

      {open && canRun ? (
        <ItemTimelineModal
          itemId={Number(itemId)}
          branchId={Number(branchId)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
