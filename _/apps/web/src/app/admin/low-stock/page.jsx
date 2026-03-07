"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import { Sidebar } from "@/components/Admin/Sidebar";
import {
  TrendingDown,
  Package,
  AlertTriangle,
  Building2,
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  XCircle,
  CheckCircle,
  ChevronDown,
  FileText,
} from "lucide-react";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";

export default function LowStockPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const {
    data: lowStockItems = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["low-stock-items"],
    queryFn: async () => {
      const response = await adminFetch("/api/items/low-stock");
      if (!response.ok) throw new Error("Failed to fetch low stock items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const branchOptions = [
    { value: "", label: "جميع الفروع" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ];

  // Filter items
  const filteredItems = lowStockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBranch =
      !selectedBranch || item.branch_id === parseInt(selectedBranch);
    return matchesSearch && matchesBranch;
  });

  // Calculate statistics
  const stats = {
    totalLowStock: filteredItems.length,
    outOfStock: filteredItems.filter(
      (item) => Number(item.current_quantity) === 0,
    ).length,
    criticalItems: filteredItems.filter(
      (item) =>
        Number(item.current_quantity) > 0 &&
        Number(item.current_quantity) < Number(item.min_stock_threshold) * 0.5,
    ).length,
    branches: [...new Set(filteredItems.map((item) => item.branch_id))].length,
  };

  const getStockStatus = (item) => {
    const qty = Number(item.current_quantity) || 0;
    const threshold = Number(item.min_stock_threshold) || 0;
    if (qty === 0) {
      return {
        label: "غير متوفر",
        color: "bg-red-500/20 text-red-300 border-red-500/30",
        icon: <XCircle className="w-4 h-4" />,
      };
    } else if (qty < threshold * 0.5) {
      return {
        label: "حرج",
        color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        icon: <AlertTriangle className="w-4 h-4" />,
      };
    } else {
      return {
        label: "منخفض",
        color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: <TrendingDown className="w-4 h-4" />,
      };
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الوصف", accessor: (item) => item.description || "-" },
      { header: "الفرع", accessor: (item) => item.branch_name },
      {
        header: "الموقع",
        accessor: (item) => item.branch_location || "-",
      },
      {
        header: "الكمية الحالية",
        accessor: (item) => Number(item.current_quantity) || 0,
      },
      {
        header: "الحد الأدنى",
        accessor: (item) => Number(item.min_stock_threshold) || 0,
      },
      {
        header: "النقص",
        accessor: (item) =>
          (Number(item.min_stock_threshold) || 0) -
          (Number(item.current_quantity) || 0),
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const q = Number(item.current_quantity) || 0;
          const t = Number(item.min_stock_threshold) || 0;
          if (q === 0) return "غير متوفر";
          if (q < t * 0.5) return "حرج";
          return "منخفض";
        },
      },
    ];

    exportToExcelHTML(
      filteredItems,
      `الأصناف_منخفضة_الكمية_${new Date().toISOString().split("T")[0]}`,
      columns,
      "تقرير الأصناف منخفضة الكمية",
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الفرع", accessor: (item) => item.branch_name },
      {
        header: "الكمية",
        accessor: (item) => Number(item.current_quantity) || 0,
      },
      {
        header: "الحد الأدنى",
        accessor: (item) => Number(item.min_stock_threshold) || 0,
      },
      {
        header: "النقص",
        accessor: (item) =>
          (Number(item.min_stock_threshold) || 0) -
          (Number(item.current_quantity) || 0),
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const q = Number(item.current_quantity) || 0;
          const t = Number(item.min_stock_threshold) || 0;
          if (q === 0) return "غير متوفر";
          if (q < t * 0.5) return "حرج";
          return "منخفض";
        },
      },
    ];

    exportToPDF(
      filteredItems,
      `الأصناف_منخفضة_الكمية_${new Date().toISOString().split("T")[0]}`,
      columns,
      "تقرير الأصناف منخفضة الكمية",
    );
    setShowExportMenu(false);
  };

  if (!isAuthenticated) {
    return null;
  }

  const statCard = `${ws.glass} ${ws.card} p-6`;
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="low-stock" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="low-stock" />
        {/* Header */}
        <div className="mb-8 mt-6 lg:mt-0">
          <div className="flex items-center gap-3 mb-4">
            <a
              href="/admin"
              className="text-white/55 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>
              الأصناف منخفضة الكمية
            </h1>
          </div>
          <p className={ws.muted}>
            متابعة الأصناف التي تحتاج إلى إعادة تعبئة بناءً على الحد الأدنى
            للمخزون
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-amber-200`}>
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/55 text-sm mb-1">
              إجمالي الأصناف المنخفضة
            </p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {stats.totalLowStock}
            </p>
          </div>

          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-red-200`}>
                <XCircle className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/55 text-sm mb-1">غير متوفر</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {stats.outOfStock}
            </p>
          </div>

          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-orange-200`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/55 text-sm mb-1">حالات حرجة</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {stats.criticalItems}
            </p>
          </div>

          <div className={statCard}>
            <div className="flex items-center justify-between mb-4">
              <div className={`${ws.iconBox} text-sky-200`}>
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-white/55 text-sm mb-1">الفروع المتأثرة</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {stats.branches}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/35" />
              <input
                type="text"
                placeholder="البحث عن صنف…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${ws.input} pr-12 pl-4 py-3`}
              />
            </div>

            <div className="min-w-[200px]">
              <GlassSelect
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={branchOptions}
                buttonClassName="px-4 py-3"
              />
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              <RefreshCw className="w-5 h-5" />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Items Grid */}
        <div className={sectionCard}>
          <div
            className={`p-5 sm:p-6 border-b ${ws.divider} flex items-center justify-between gap-3`}
          >
            <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-amber-200`}>
                <Package className="w-5 h-5" />
              </div>
              قائمة الأصناف المنخفضة
            </h2>

            <div>
              <button
                ref={exportBtnRef}
                type="button"
                onClick={() => setShowExportMenu((s) => !s)}
                className={`${ws.btnNeutral} px-4 py-2 text-sm justify-center`}
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
                style={{ width: 224 }}
              >
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors"
                >
                  <FileText className="w-5 h-5 text-emerald-200" />
                  <div>
                    <p className="font-semibold text-white">Excel</p>
                    <p className="text-xs text-white/45">للتحليل والمعالجة</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors border-t border-white/10"
                >
                  <FileText className="w-5 h-5 text-red-200" />
                  <div>
                    <p className="font-semibold text-white">PDF</p>
                    <p className="text-xs text-white/45">للطباعة والأرشفة</p>
                  </div>
                </button>
              </GlassPopover>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-white/55">
              <div className="flex items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin" />
                <span>جاري التحميل…</span>
              </div>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      الصنف
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      الفرع
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      الكمية الحالية
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      الحد الأدنى
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      النقص
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-white/55">
                      الحالة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const status = getStockStatus(item);
                    const qty = Number(item.current_quantity) || 0;
                    const threshold = Number(item.min_stock_threshold) || 0;
                    const shortage = threshold - qty;
                    const qtyClass =
                      qty === 0
                        ? "text-red-200"
                        : qty < threshold * 0.5
                          ? "text-orange-200"
                          : "text-amber-200";

                    return (
                      <tr
                        key={`${item.id}-${item.branch_id}-${index}`}
                        className="border-t border-white/5 hover:bg-white/[0.05] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/[0.04] rounded-2xl flex items-center justify-center border border-white/10">
                              <Package className="w-6 h-6 text-amber-200" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {item.name}
                              </p>
                              {item.description ? (
                                <p className="text-white/50 text-sm">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-white font-medium">
                              {item.branch_name}
                            </p>
                            {item.branch_location ? (
                              <p className="text-white/50 text-sm">
                                {item.branch_location}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-lg font-bold ${qtyClass}`}>
                            {qty}
                          </span>
                          <span className="text-white/40 text-sm mr-1">
                            {item.unit || "حبة"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white/75 font-medium">
                            {threshold}
                          </span>
                          <span className="text-white/40 text-sm mr-1">
                            {item.unit || "حبة"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-red-200 font-bold">
                            -{shortage}
                          </span>
                          <span className="text-white/40 text-sm mr-1">
                            {item.unit || "حبة"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`${ws.pill} inline-flex items-center gap-2 text-sm font-semibold border ${status.color}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-white/50">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-emerald-200" />
              <p className="text-lg mb-2">رائع! لا توجد أصناف منخفضة الكمية</p>
              <p className="text-sm">جميع الأصناف متوفرة بكميات كافية</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
