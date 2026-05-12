"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";
import { VarianceHeader } from "@/components/Variance/VarianceHeader";
import { VarianceFilters } from "@/components/Variance/VarianceFilters";
import { VarianceStats } from "@/components/Variance/VarianceStats";
import { VarianceTable } from "@/components/Variance/VarianceTable";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { formatDateForInput } from "@/utils/dateUtils";

// `toISOString()` treats the Date as UTC, which shifts the result back
// one day at local times before the UTC offset wraps. `formatDateForInput`
// reads local wall-clock fields and is TZ-stable.
function defaultFromDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDateForInput(d);
}

function defaultToDate() {
  return formatDateForInput(new Date());
}

export default function VariancePage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultFromDate());
  const [dateTo, setDateTo] = useState(defaultToDate());

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await adminFetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const branchOptions = useMemo(
    () => [
      { value: "", label: "اختر الفرع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const itemOptions = useMemo(() => {
    const q = (itemSearch || "").toLowerCase();
    const filtered = items.filter(
      (it) =>
        it.show_in_inventory !== false &&
        (!q || it.name.toLowerCase().includes(q)),
    );
    return [
      { value: "", label: "اختر الصنف" },
      ...filtered
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "ar"),
        )
        .map((it) => ({ value: String(it.id), label: it.name })),
    ];
  }, [items, itemSearch]);

  // Inverted ranges (from > to) return an empty server result that looks
  // identical to "no data" — surface it as a filter error instead so the
  // query never even fires.
  const dateRangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo);
  const hasFilters =
    !!(selectedBranch && selectedItem && dateFrom && dateTo) &&
    !dateRangeInvalid;

  const varianceQuery = useQuery({
    queryKey: ["variance", selectedBranch, selectedItem, dateFrom, dateTo],
    enabled: isAuthenticated && hasFilters,
    queryFn: async () => {
      const qs = new URLSearchParams({
        branchId: selectedBranch,
        itemId: selectedItem,
        from: dateFrom,
        to: dateTo,
      });
      const res = await adminFetch(`/api/variance?${qs.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "فشل تحميل بيانات الانحراف");
      }
      return res.json();
    },
  });

  const rows = varianceQuery.data?.rows || [];

  const selectedBranchName = useMemo(() => {
    const b = branches.find((x) => String(x.id) === selectedBranch);
    return b?.name || "";
  }, [branches, selectedBranch]);

  const selectedItemName = useMemo(() => {
    const it = items.find((x) => String(x.id) === selectedItem);
    return it?.name || "";
  }, [items, selectedItem]);

  const exportColumns = [
    { header: "التاريخ", accessor: (r) => String(r.created_at).slice(0, 10) },
    { header: "رقم الجرد", accessor: (r) => r.inventory_number || "—" },
    { header: "المتوقع", accessor: (r) => Number(r.expected_quantity) || 0 },
    { header: "الفعلي", accessor: (r) => Number(r.actual_quantity) || 0 },
    { header: "الفرق منذ الافتتاحي", accessor: (r) => Number(r.delta_quantity) || 0 },
    {
      header: "الفرق منذ الجرد السابق",
      accessor: (r) =>
        r.delta_since_previous === null || r.delta_since_previous === undefined
          ? "—"
          : Number(r.delta_since_previous) || 0,
    },
  ];

  const handleExportExcel = () => {
    const filename = `انحراف_${selectedItemName}_${selectedBranchName}_${dateFrom}_الى_${dateTo}`;
    const title = `تقرير الانحراف — ${selectedItemName} (${selectedBranchName})`;
    exportToExcelHTML(rows, filename, exportColumns, title);
  };

  const handleExportPDF = () => {
    const filename = `انحراف_${selectedItemName}_${selectedBranchName}_${dateFrom}_الى_${dateTo}`;
    const title = `تقرير الانحراف — ${selectedItemName} (${selectedBranchName})`;
    exportToPDF(rows, filename, exportColumns, title);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="variance" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="variance" />

        <VarianceHeader />

        <VarianceFilters
          branchOptions={branchOptions}
          itemOptions={itemOptions}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          selectedItem={selectedItem}
          onItemChange={setSelectedItem}
          itemSearch={itemSearch}
          onItemSearchChange={setItemSearch}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          onRefresh={() => varianceQuery.refetch()}
        />

        {/* Show stats whenever filters are complete (even with zero rows) so
            user can tell the filter applied — previously hidden on empty rows
            looked like the filter never ran. */}
        {hasFilters ? <VarianceStats rows={rows} /> : null}

        <VarianceTable
          rows={rows}
          isLoading={varianceQuery.isLoading}
          hasFilters={hasFilters}
          filterStatus={{
            branch: !!selectedBranch,
            item: !!selectedItem,
            from: !!dateFrom,
            to: !!dateTo,
          }}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      </main>
    </div>
  );
}
