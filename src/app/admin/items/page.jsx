"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useItemsData } from "@/hooks/useItemsData";
import { useItemForm } from "@/hooks/useItemForm";
import useItemCategories from "@/hooks/useItemCategories";
import ItemCategoriesModal from "@/components/Items/ItemCategoriesModal";
import { Sidebar } from "@/components/Admin/Sidebar";
import { StatsCards } from "@/components/Items/StatsCards";
import { SearchBar } from "@/components/Items/SearchBar";
import { ItemsTable } from "@/components/Items/ItemsTable";
import { ItemFormModal } from "@/components/Items/ItemFormModal";
import { DeleteConfirmModal } from "@/components/Items/DeleteConfirmModal";
import { ViewStockModal } from "@/components/Items/ViewStockModal";
import { ItemBranchVisibilityModal } from "@/components/Items/ItemBranchVisibilityModal";
import {
  exportToExcelHTML,
  exportToPDF,
  formatDateTime,
} from "@/utils/exportUtils";
import { ws } from "@/components/Workspace/ui";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";

function getItemTotalStock(item) {
  const list = Array.isArray(item?.branch_stock) ? item.branch_stock : [];
  return list.reduce((sum, s) => {
    const qty = Number(s?.quantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

function getItemStockStatus(item) {
  if (item?.show_in_inventory === false) return "disabled";
  const list = Array.isArray(item?.branch_stock) ? item.branch_stock : [];
  if (list.length === 0) return "available";
  const threshold = Number(item?.min_stock_threshold || 0);
  const totalStock = getItemTotalStock(item);
  if (totalStock === 0) return "out_of_stock";
  if (totalStock < threshold) return "low_stock";
  return "available";
}

export default function ItemsPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const {
    items,
    branches,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    batchInventoryMutation,
  } = useItemsData(isAuthenticated);

  const {
    categories,
    createMutation: createCategoryMutation,
    updateMutation: updateCategoryMutation,
  } = useItemCategories(isAuthenticated);

  // Fetch green beans for linking
  const { data: greenBeansData } = useQuery({
    queryKey: ["green-beans"],
    queryFn: async () => {
      const { adminFetch } = await import("@/utils/apiAuth");
      const response = await adminFetch("/api/accounting/green-beans");
      if (!response.ok) throw new Error("Failed to fetch green beans");
      return response.json();
    },
    enabled: isAuthenticated,
  });
  const greenBeans = greenBeansData?.beans || [];

  const { formData, setFormData, editingItem, resetForm, loadItem } =
    useItemForm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewStockItem, setViewStockItem] = useState(null);
  const [manageBranchesItem, setManageBranchesItem] = useState(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const hasActiveFilters = selectedCategory !== "" || selectedStatus !== "";

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedStatus("");
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      loadItem(item);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Mirror the default inventory unit name into the legacy
    // `item.unit` text field so any caller that still reads the
    // flat column (older reports, exports, third-party consumers)
    // sees the unit the operator actually picked — not the base.
    const defaultInvRow = (formData.units || []).find(
      (u) => u.default_inventory,
    );
    const baseRow = (formData.units || []).find((u) => u.is_base);
    const unitText =
      defaultInvRow?.name_ar || baseRow?.name_ar || formData.unit || "حبة";
    const payload = { ...formData, unit: unitText };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, ...payload },
        {
          onSuccess: () => {
            handleCloseModal();
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          handleCloseModal();
        },
      });
    }
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      },
    });
  };

  const handleBatchInventory = (ids, showInInventory, onDone) => {
    batchInventoryMutation.mutate(
      { ids, show_in_inventory: showInInventory },
      {
        onSuccess: () => {
          if (onDone) onDone();
        },
      },
    );
  };

  const filteredItems = useMemo(() => {
    let result = items || [];

    // Text search
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter((item) => {
        const nameMatch = String(item.name || "")
          .toLowerCase()
          .includes(term);
        const descMatch = String(item.description || "")
          .toLowerCase()
          .includes(term);
        const categoryMatch = String(item.category_name || "")
          .toLowerCase()
          .includes(term);
        return nameMatch || descMatch || categoryMatch;
      });
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (item) => String(item.category_id) === selectedCategory,
      );
    }

    // Status filter
    if (selectedStatus) {
      result = result.filter(
        (item) => getItemStockStatus(item) === selectedStatus,
      );
    }

    return result;
  }, [items, searchTerm, selectedCategory, selectedStatus]);

  // Resolve the display unit + per-unit cost the same way the
  // table/cards do — pick the row that the operator flagged as the
  // default inventory unit, fall back to the legacy text + cost.
  const resolveDisplay = (item) => {
    const itemUnits = Array.isArray(item?.units) ? item.units : [];
    const def =
      itemUnits.find((u) => u.id === item?.default_inventory_unit_id) ||
      itemUnits.find((u) => u.is_base) ||
      null;
    const unit = def?.name_ar || item?.unit || "حبة";
    const baseCost = Number(item?.base_purchase_cost);
    const legacyCost = Number(item?.cost);
    const raw = Number.isFinite(baseCost)
      ? baseCost
      : Number.isFinite(legacyCost)
        ? legacyCost
        : null;
    const cost =
      raw != null && def
        ? raw * (Number(def.conversion_factor) || 1)
        : raw;
    return { unit, cost };
  };

  // Export handlers
  const handleExportExcel = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الفئة", accessor: (item) => item.category_name || "-" },
      {
        header: "نوع المنتج",
        accessor: (item) => resolveDisplay(item).unit,
      },
      {
        header: "التكلفة (ر.س)",
        accessor: (item) => resolveDisplay(item).cost,
        format: (value) => (value != null ? Number(value).toFixed(2) : "-"),
      },
      { header: "الوصف", accessor: (item) => item.description || "-" },
      {
        header: "الحد الأدنى للمخزون",
        accessor: (item) => item.min_stock_threshold,
      },
      {
        header: "إجمالي المخزون",
        accessor: (item) => getItemTotalStock(item),
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const status = getItemStockStatus(item);
          if (status === "disabled") return "معطّل";
          if (status === "out_of_stock") return "نفد";
          if (status === "low_stock") return "منخفض";
          return "متوفر";
        },
      },
      {
        header: "تاريخ الإنشاء",
        accessor: (item) => item.created_at,
        format: (value) => formatDateTime(value),
      },
    ];

    exportToExcelHTML(
      filteredItems,
      `قائمة_الأصناف_${new Date().toISOString().split("T")[0]}`,
      columns,
      "قائمة الأصناف - نظام إدارة المخزون",
    );
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الوصف", accessor: (item) => item.description || "-" },
      { header: "الفئة", accessor: (item) => item.category_name || "-" },
      {
        header: "النوع",
        accessor: (item) => resolveDisplay(item).unit,
      },
      {
        header: "التكلفة",
        accessor: (item) => resolveDisplay(item).cost,
        format: (value) => (value != null ? Number(value).toFixed(2) : "-"),
      },
      {
        header: "إجمالي المخزون",
        accessor: (item) => getItemTotalStock(item),
      },
      {
        header: "الحد الأدنى",
        accessor: (item) => item.min_stock_threshold,
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const status = getItemStockStatus(item);
          if (status === "disabled") return "معطّل";
          if (status === "out_of_stock") return "نفد";
          if (status === "low_stock") return "منخفض";
          return "متوفر";
        },
      },
    ];

    exportToPDF(
      filteredItems,
      `قائمة_الأصناف_${new Date().toISOString().split("T")[0]}`,
      columns,
      "قائمة الأصناف - نظام إدارة المخزون",
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar onLogout={logout} activePage="items" />

      {/* Main Content */}
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="items" />
        {/* Header */}
        <div className="mb-8 mt-6 lg:mt-0">
          <h1 className={`text-3xl sm:text-4xl ${ws.title} mb-2`}>
            إدارة الأصناف
          </h1>
          <p className={ws.muted}>
            إضافة وتعديل الأصناف ومتابعة مخزونها عبر جميع الفروع
          </p>
        </div>

        <StatsCards items={filteredItems} totalCount={items.length} />

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddClick={() => handleOpenModal()}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onManageCategories={() => setIsCategoriesOpen(true)}
          // filter props
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((s) => !s)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        <ItemsTable
          items={filteredItems}
          isLoading={isLoading}
          searchTerm={searchTerm}
          onEdit={handleOpenModal}
          onDelete={setDeleteConfirm}
          onViewStock={setViewStockItem}
          onManageBranches={setManageBranchesItem}
          onBatchInventory={handleBatchInventory}
          isBatchPending={batchInventoryMutation.isPending}
        />
      </main>

      <ItemFormModal
        isOpen={isModalOpen}
        editingItem={editingItem}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        greenBeans={greenBeans}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
        createMutation={createMutation}
        updateMutation={updateMutation}
      />

      <ItemCategoriesModal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        categories={categories}
        createMutation={createCategoryMutation}
        updateMutation={updateCategoryMutation}
      />

      <DeleteConfirmModal
        item={deleteConfirm}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
        deleteMutation={deleteMutation}
      />

      <ViewStockModal
        item={viewStockItem}
        onClose={() => setViewStockItem(null)}
      />

      {/* Derive the modal item fresh from the items list each render so
          invalidating ["items"] after each toggle re-seeds the modal
          with the new disabled_branches without re-opening it. */}
      <ItemBranchVisibilityModal
        item={
          manageBranchesItem
            ? items.find((it) => it.id === manageBranchesItem.id) ||
              manageBranchesItem
            : null
        }
        branches={branches}
        onClose={() => setManageBranchesItem(null)}
      />
    </div>
  );
}
