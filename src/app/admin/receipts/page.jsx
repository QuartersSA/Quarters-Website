"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Truck } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";
import { ReceiptsFilters } from "@/components/Receipts/ReceiptsFilters";
import { ReceiptsList } from "@/components/Receipts/ReceiptsList";
import { useReceiptsData } from "@/hooks/useReceiptsData";
import { ws } from "@/components/Workspace/ui";
import { formatDateForInput } from "@/utils/dateUtils";

// `toISOString()` previously was used here, but it treats the Date as UTC,
// so at local time ~02:00 in +03:00 the result is *yesterday* in UTC and
// the date filter loads the wrong day. `formatDateForInput` reads
// getFullYear / getMonth / getDate from local wall-clock and is TZ-stable.
function defaultFromDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatDateForInput(d);
}

function defaultToDate() {
  return formatDateForInput(new Date());
}

export default function ReceiptsPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
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
      { value: "", label: "جميع الفروع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const itemOptions = useMemo(
    () => [
      { value: "", label: "جميع الأصناف" },
      ...items
        .filter((it) => it.show_in_inventory !== false)
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "ar"),
        )
        .map((it) => ({ value: String(it.id), label: it.name })),
    ],
    [items],
  );

  // Inverted ranges return empty results silently → looks like a broken
  // filter. Detect here, skip the query, and surface the error inline.
  const dateRangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo);

  const { groups, isLoading, error, refetch } = useReceiptsData({
    isAuthenticated: isAuthenticated && !dateRangeInvalid,
    branchId: selectedBranch,
    itemId: selectedItem,
    dateFrom,
    dateTo,
  });

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="receipts" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="receipts" />

        <div className="mb-8 mt-6 lg:mt-0">
          <div className="flex items-center gap-3 mb-4">
            <a
              href="/admin"
              className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
              <Truck className="w-6 h-6" />
            </div>
            <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>الواردات</h1>
          </div>
          <p className={ws.muted}>
            سجل كامل للواردات من المورّدين، مجمّعة حسب الإيصال
          </p>
        </div>

        <ReceiptsFilters
          branchOptions={branchOptions}
          itemOptions={itemOptions}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          selectedItem={selectedItem}
          onItemChange={setSelectedItem}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          onRefresh={refetch}
          dateRangeInvalid={dateRangeInvalid}
        />

        {dateRangeInvalid ? (
          <div className={`${ws.glassSoft} ${ws.card} p-5 mb-6 text-center`}>
            <p className="text-red-700 dark:text-red-700 dark:text-red-200 text-sm font-semibold">
              ⚠ "من تاريخ" أحدث من "إلى تاريخ" — صحّح الفترة لعرض النتائج
            </p>
          </div>
        ) : (
          <ReceiptsList groups={groups} isLoading={isLoading} error={error} />
        )}
      </main>
    </div>
  );
}
