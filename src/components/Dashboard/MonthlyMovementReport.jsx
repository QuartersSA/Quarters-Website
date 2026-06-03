import { useState, useMemo } from "react";
import {
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";

export function MonthlyMovementReport({ monthlyMovement, branches }) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const allBranches = useMemo(() => {
    if (!monthlyMovement) return [];
    const unique = new Map();
    monthlyMovement.forEach((r) => {
      if (!unique.has(r.branch_id)) {
        unique.set(r.branch_id, r.branch_name);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [monthlyMovement]);

  const filteredData = useMemo(() => {
    if (!monthlyMovement) return [];
    let data = monthlyMovement;
    if (selectedBranch) {
      data = data.filter((r) => String(r.branch_id) === selectedBranch);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter((r) => r.item_name?.toLowerCase().includes(q));
    }
    return data;
  }, [monthlyMovement, selectedBranch, searchQuery]);

  // Aggregate by item (sum across branches or selected branch)
  const aggregated = useMemo(() => {
    const map = new Map();
    filteredData.forEach((r) => {
      const key = selectedBranch
        ? `${r.item_id}-${r.branch_id}`
        : String(r.item_id);
      if (!map.has(key)) {
        map.set(key, {
          item_name: r.item_name,
          unit: r.unit,
          cost: Number(r.cost || 0),
          branch_name: selectedBranch ? r.branch_name : "كل الفروع",
          opening_qty: 0,
          received_qty: 0,
          closing_qty: 0,
        });
      }
      const entry = map.get(key);
      entry.opening_qty += Number(r.opening_qty || 0);
      entry.received_qty += Number(r.received_qty || 0);
      entry.closing_qty += Number(r.closing_qty || 0);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.item_name.localeCompare(b.item_name, "ar"),
    );
  }, [filteredData, selectedBranch]);

  const displayData = isExpanded ? aggregated : aggregated.slice(0, 10);

  const currentMonth = new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
    month: "long",
    year: "numeric",
  });

  const handleExportExcel = () => {
    const cols = [
      { header: "الصنف", accessor: (r) => r.item_name },
      { header: "الوحدة", accessor: (r) => r.unit },
      { header: "رصيد أول الشهر", accessor: (r) => r.opening_qty },
      { header: "الوارد", accessor: (r) => r.received_qty },
      {
        header: "المستهلك",
        accessor: (r) => r.opening_qty + r.received_qty - r.closing_qty,
      },
      { header: "رصيد نهاية الشهر", accessor: (r) => r.closing_qty },
    ];
    exportToExcelHTML(
      aggregated,
      `حركة-المخزون-${currentMonth}`,
      cols,
      `تقرير حركة المخزون — ${currentMonth}`,
    );
    setShowExport(false);
  };

  const handleExportPDF = () => {
    const cols = [
      { header: "الصنف", accessor: (r) => r.item_name },
      { header: "الوحدة", accessor: (r) => r.unit },
      { header: "رصيد أول الشهر", accessor: (r) => r.opening_qty },
      { header: "الوارد", accessor: (r) => r.received_qty },
      {
        header: "المستهلك",
        accessor: (r) => r.opening_qty + r.received_qty - r.closing_qty,
      },
      { header: "رصيد نهاية الشهر", accessor: (r) => r.closing_qty },
    ];
    exportToPDF(
      aggregated,
      `حركة-المخزون-${currentMonth}`,
      cols,
      `تقرير حركة المخزون — ${currentMonth}`,
    );
    setShowExport(false);
  };

  if (!monthlyMovement || monthlyMovement.length === 0) return null;

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden mb-8`}>
      <div className={`p-6 border-b ${ws.divider}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} text-purple-700 dark:text-purple-700 dark:text-purple-200`}>
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
                تقرير حركة المخزون
              </h2>
              <p className="text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm">{currentMonth}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch filter */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={`${ws.select} px-3 py-2 text-sm max-w-[140px]`}
            >
              <option value="">كل الفروع</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-400 dark:text-white/30" />
              <input
                type="text"
                placeholder="بحث صنف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${ws.input} pr-9 px-3 py-2 text-sm w-[150px]`}
              />
            </div>

            {/* Export button */}
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className={`${ws.btnNeutral} px-3 py-2 text-sm`}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">تصدير</span>
              </button>
              {showExport && (
                <div
                  className={`absolute left-0 top-full mt-1 z-20 ${ws.popover} rounded-xl border border-slate-200 dark:border-slate-200 dark:border-white/10 min-w-[140px]`}
                >
                  <button
                    onClick={handleExportExcel}
                    className="w-full text-right px-4 py-2.5 text-sm text-slate-800 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                  >
                    Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full text-right px-4 py-2.5 text-sm text-slate-800 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                  >
                    PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
              <th className="text-right px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                الصنف
              </th>
              <th className="text-right px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                الوحدة
              </th>
              <th className="text-center px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                أول الشهر
              </th>
              <th className="text-center px-5 py-3.5 text-sm font-semibold text-emerald-700 dark:text-emerald-700 dark:text-emerald-200/70">
                + الوارد
              </th>
              <th className="text-center px-5 py-3.5 text-sm font-semibold text-red-700 dark:text-red-700 dark:text-red-200/70">
                - المستهلك
              </th>
              <th className="text-center px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                نهاية الشهر
              </th>
            </tr>
          </thead>
          <tbody>
            {displayData.length > 0 ? (
              displayData.map((row, i) => {
                const consumed =
                  row.opening_qty + row.received_qty - row.closing_qty;
                return (
                  <tr
                    key={i}
                    className="border-t border-slate-100 dark:border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3 text-slate-900 dark:text-slate-900 dark:text-white text-sm font-medium">
                      {row.item_name}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm">
                      {row.unit}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-700 dark:text-slate-700 dark:text-white/70 text-sm">
                      {row.opening_qty}
                    </td>
                    <td className="px-5 py-3 text-center text-emerald-700 dark:text-emerald-700 dark:text-emerald-200 text-sm font-semibold">
                      {row.received_qty > 0 ? `+${row.received_qty}` : "0"}
                    </td>
                    <td className="px-5 py-3 text-center text-red-700 dark:text-red-700 dark:text-red-200 text-sm font-semibold">
                      {consumed > 0 ? `-${consumed}` : "0"}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-900 dark:text-slate-900 dark:text-white font-bold text-sm">
                      {row.closing_qty}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-5 py-8 text-center text-slate-500 dark:text-slate-500 dark:text-white/40">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aggregated.length > 10 && (
        <div className="p-4 text-center border-t border-slate-100 dark:border-slate-100 dark:border-white/5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 dark:text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white text-sm flex items-center gap-1 mx-auto"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                عرض أقل
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                عرض الكل ({aggregated.length} صنف)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
