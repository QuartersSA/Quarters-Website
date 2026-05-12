"use client";

import { ArrowLeft, ArrowLeftRight, PlusCircle, Truck } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useOperationsData } from "@/hooks/useOperationsData";
import { useOperationsFilters } from "@/hooks/useOperationsFilters";
import { useOperationDetails } from "@/hooks/useOperationDetails";
import { useOpeningSession } from "@/hooks/useOpeningSession";
import { usePurchaseReceipt } from "@/hooks/usePurchaseReceipt";
import { calculateOperationStats } from "@/utils/operationsUtils";
import { adminFetch } from "@/utils/apiAuth";
import { Sidebar } from "@/components/Admin/Sidebar";
import { OperationsStatistics } from "@/components/Operations/OperationsStatistics";
import { OperationsFilters } from "@/components/Operations/OperationsFilters";
import { OperationsTable } from "@/components/Operations/OperationsTable";
import { OperationDetailsModal } from "@/components/Operations/OperationDetailsModal/OperationDetailsModal";
import TransferModal from "@/components/Operations/TransferModal";
import DeleteOperationModal from "@/components/Operations/DeleteOperationModal";
import { OpeningSessionModal } from "@/components/Dashboard/OpeningSessionModal";
import { PurchaseReceiptModal } from "@/components/Dashboard/PurchaseReceiptModal";
import EditOperationModal from "@/components/Operations/EditOperationModal";
import { ws } from "@/components/Workspace/ui";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";

export default function OperationsPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const { operations, branches, isLoading, deleteMutation } =
    useOperationsData(isAuthenticated);

  /* ── items (needed for opening-session & receipt modals) ── */
  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const activeItems = useMemo(() => {
    return (items || []).filter(
      (it) => it.is_active !== false && it.show_in_inventory !== false,
    );
  }, [items]);

  /* ── filters ── */
  const {
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedType,
    setSelectedType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    filteredOperations,
    clearFilters,
    hasActiveFilters,
  } = useOperationsFilters(operations);

  const { selectedOperation, setSelectedOperation, operationDetails } =
    useOperationDetails();

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Edit operation state (for non-receipt types) ── */
  const [editOperation, setEditOperation] = useState(null);
  const [editOperationDetails, setEditOperationDetails] = useState(null);

  /* ── opening session & purchase receipt ── */
  const openingSession = useOpeningSession(activeItems, "", "");
  const purchaseReceipt = usePurchaseReceipt("", "", "", "");

  const stats = calculateOperationStats(filteredOperations);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        if (selectedOperation?.id === deleteTarget.id) {
          setSelectedOperation(null);
        }
        setDeleteTarget(null);
      },
    });
  };

  // ── Multi-select state for bulk operations ──
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Live counter for bulk delete so the user sees "12/50" instead of a
  // single opaque "deleting…" spinner on long batches.
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const selectable = filteredOperations || [];
    setSelectedIds((prev) => {
      const allOnPage = selectable.every((op) => prev.has(op.id));
      if (allOnPage) {
        const next = new Set(prev);
        for (const op of selectable) next.delete(op.id);
        return next;
      }
      const next = new Set(prev);
      for (const op of selectable) next.add(op.id);
      return next;
    });
  }, [filteredOperations]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk delete: confirms once then calls deleteMutation.mutate per id.
  // Accepts numeric ids (inventory_operations) AND string ids ("batch-*" /
  // "rcpt-*") — backend handles all three via the same DELETE endpoint.
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (typeof window === "undefined") return;

    // Warn if user selected items under one filter, then changed filter,
    // since the off-screen ids will still be deleted.
    const visibleIds = new Set((filteredOperations || []).map((op) => op.id));
    const hiddenCount = ids.filter((id) => !visibleIds.has(id)).length;
    const hiddenWarning =
      hiddenCount > 0
        ? `\n⚠️ تنبيه: ${hiddenCount} منها خارج الفلتر الحالي وغير ظاهرة.`
        : "";

    const ok = window.confirm(
      `حذف ${ids.length} عملية؟ لا يمكن التراجع.${hiddenWarning}`,
    );
    if (!ok) return;

    setBulkDeleting(true);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteMutation.mutateAsync(id);
        succeeded += 1;
      } catch (err) {
        console.error("bulk delete failed for id", id, err);
        failed += 1;
      }
      // Tick progress after each request so the chip updates live.
      setBulkProgress({ done: succeeded + failed, total: ids.length });
    }
    setBulkDeleting(false);
    setBulkProgress({ done: 0, total: 0 });
    setSelectedIds(new Set());
    if (failed > 0) {
      window.alert(
        `تم حذف ${succeeded} عملية، وفشل حذف ${failed} عملية. راجع الـ console.`,
      );
    }
  }, [selectedIds, deleteMutation, filteredOperations]);

  const handleEditOperation = useCallback(
    async (operation, existingDetails) => {
      const isReceipt = operation.inventory_type === "Receipt";

      if (isReceipt) {
        // Use existing receipt edit flow
        if (existingDetails) {
          purchaseReceipt.openEditReceiptModal(operation, existingDetails);
          return;
        }
        try {
          const response = await adminFetch(
            `/api/inventory-operations?id=${operation.id}`,
          );
          if (!response.ok)
            throw new Error("Failed to fetch operation details");
          const details = await response.json();
          purchaseReceipt.openEditReceiptModal(operation, details);
        } catch (err) {
          console.error("Failed to load operation for edit:", err);
        }
        return;
      }

      // For non-receipt operations, use the new EditOperationModal
      if (existingDetails) {
        setEditOperation(operation);
        setEditOperationDetails(existingDetails);
        return;
      }

      try {
        const response = await adminFetch(
          `/api/inventory-operations?id=${operation.id}`,
        );
        if (!response.ok) throw new Error("Failed to fetch operation details");
        const details = await response.json();
        setEditOperation(operation);
        setEditOperationDetails(details);
      } catch (err) {
        console.error("Failed to load operation for edit:", err);
      }
    },
    [purchaseReceipt],
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="operations" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="operations" />
        <div className="mb-8 mt-6 lg:mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <a
                href="/admin"
                className="text-white/55 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </a>
              <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>
                عمليات المخزون
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={openingSession.openOpeningModal}
                className={`${ws.btnNeutral} px-4 py-2 justify-center`}
              >
                <PlusCircle className="w-5 h-5 text-sky-200" />
                <span>مخزون افتتاحي</span>
              </button>

              <button
                type="button"
                onClick={purchaseReceipt.openReceiptModal}
                className={`${ws.btnNeutral} px-4 py-2 justify-center`}
              >
                <Truck className="w-5 h-5 text-amber-200" />
                <span>إضافة وارد</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className={`${ws.btnPrimary} px-4 py-2 justify-center`}
              >
                <ArrowLeftRight className="w-5 h-5" />
                <span>تحويل بين الفروع</span>
              </button>
            </div>
          </div>
          <p className={ws.muted}>
            متابعة ومراجعة جميع عمليات المخزون عبر الفروع — الجرد، المخزون
            الافتتاحي، التحويلات، والوارد
          </p>
        </div>

        <OperationsStatistics stats={stats} />

        <OperationsFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          branches={branches}
        />

        <OperationsTable
          filteredOperations={filteredOperations}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onViewOperation={setSelectedOperation}
          onDeleteOperation={setDeleteTarget}
          onEditOperation={handleEditOperation}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          bulkDeleteDisabled={bulkDeleting || deleteMutation.isPending}
          bulkProgress={bulkProgress}
        />
      </main>

      {selectedOperation ? (
        <OperationDetailsModal
          selectedOperation={selectedOperation}
          operationDetails={operationDetails}
          onClose={() => setSelectedOperation(null)}
          onDelete={setDeleteTarget}
          onEdit={handleEditOperation}
        />
      ) : null}

      {showTransferModal ? (
        <TransferModal
          branches={branches}
          onClose={() => setShowTransferModal(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteOperationModal
          operation={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
          error={deleteMutation.error?.message}
        />
      ) : null}

      {editOperation && editOperationDetails ? (
        <EditOperationModal
          operation={editOperation}
          operationDetails={editOperationDetails}
          onClose={() => {
            setEditOperation(null);
            setEditOperationDetails(null);
          }}
        />
      ) : null}

      <OpeningSessionModal
        openingModalOpen={openingSession.openingModalOpen}
        setOpeningModalOpen={openingSession.setOpeningModalOpen}
        openingBranchId={openingSession.openingBranchId}
        setOpeningBranchId={openingSession.setOpeningBranchId}
        openingOpenedAt={openingSession.openingOpenedAt}
        setOpeningOpenedAt={openingSession.setOpeningOpenedAt}
        openingNote={openingSession.openingNote}
        setOpeningNote={openingSession.setOpeningNote}
        openingSearch={openingSession.openingSearch}
        setOpeningSearch={openingSession.setOpeningSearch}
        openingQtyByItem={openingSession.openingQtyByItem}
        setOpeningQtyByItem={openingSession.setOpeningQtyByItem}
        openingError={openingSession.openingError}
        openingSuccess={openingSession.openingSuccess}
        filteredOpeningItems={openingSession.filteredOpeningItems}
        submitOpening={openingSession.submitOpening}
        createOpeningMutation={openingSession.createOpeningMutation}
        branches={branches}
      />

      <PurchaseReceiptModal
        receiptModalOpen={purchaseReceipt.receiptModalOpen}
        setReceiptModalOpen={purchaseReceipt.setReceiptModalOpen}
        receiptBranchId={purchaseReceipt.receiptBranchId}
        setReceiptBranchId={purchaseReceipt.setReceiptBranchId}
        receiptDate={purchaseReceipt.receiptDate}
        setReceiptDate={purchaseReceipt.setReceiptDate}
        receiptItemId={purchaseReceipt.receiptItemId}
        setReceiptItemId={purchaseReceipt.setReceiptItemId}
        receiptQty={purchaseReceipt.receiptQty}
        setReceiptQty={purchaseReceipt.setReceiptQty}
        receiptNote={purchaseReceipt.receiptNote}
        setReceiptNote={purchaseReceipt.setReceiptNote}
        receiptError={purchaseReceipt.receiptError}
        receiptItems={purchaseReceipt.receiptItems}
        addReceiptItem={purchaseReceipt.addReceiptItem}
        removeReceiptItem={purchaseReceipt.removeReceiptItem}
        submitReceipt={purchaseReceipt.submitReceipt}
        createReceiptMutation={purchaseReceipt.createReceiptMutation}
        stockByBranchItem={purchaseReceipt.stockByBranchItem}
        branches={branches}
        activeItems={activeItems}
        editingOperation={purchaseReceipt.editingOperation}
        submitEditReceipt={purchaseReceipt.submitEditReceipt}
        updateReceiptMutation={purchaseReceipt.updateReceiptMutation}
      />
    </div>
  );
}
