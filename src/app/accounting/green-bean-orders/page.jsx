"use client";

import React, { useCallback, useState } from "react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import { ws } from "@/components/Workspace/ui";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import {
  MobileHeader,
  DesktopHeader,
} from "@/components/GreenBeanOrders/PageHeader";
import { ActionsCard } from "@/components/GreenBeanOrders/ActionsCard";
import { OrdersList } from "@/components/GreenBeanOrders/OrdersList";
import { OrderDetails } from "@/components/GreenBeanOrders/OrderDetails";
import { BeansList } from "@/components/GreenBeanOrders/BeansList";
import { OrderBuilder } from "@/components/GreenBeanOrders/OrderBuilder";
import {
  useGreenBeans,
  useOrders,
  useOrderDetails,
  useCreateOrder,
  useDeleteOrder,
  useUpdateOrder,
} from "@/hooks/useGreenBeanOrders";
import { useGreenBeanOrderBuilder } from "@/hooks/useGreenBeanOrderBuilder";

export default function GreenBeanOrdersPage() {
  const { ready, employeeId, user, isAuthenticated } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [mode, setMode] = useState("create"); // create | archive | edit

  // archive state
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [filterMonth, setFilterMonth] = useState(""); // "" = show all

  // edit state
  const [editingOrderId, setEditingOrderId] = useState(null);

  const beansQuery = useGreenBeans(ready, isAuthenticated, isAdmin);
  const ordersQuery = useOrders(ready, isAuthenticated, isAdmin, filterMonth);
  const orderDetailsQuery = useOrderDetails(
    ready,
    isAuthenticated,
    isAdmin,
    selectedOrderId,
  );

  const beans = Array.isArray(beansQuery.data?.beans)
    ? beansQuery.data.beans
    : [];

  const orders = Array.isArray(ordersQuery.data?.orders)
    ? ordersQuery.data.orders
    : [];

  const builder = useGreenBeanOrderBuilder(beans);

  const createOrderMutation = useCreateOrder(
    (data) => {
      const createdId = data?.order?.id;
      if (createdId) {
        setSelectedOrderId(String(createdId));
        setMode("archive");
      }
      builder.resetDraft();
      setSuccess("تم حفظ طلب التوريد.");
      setError(null);
    },
    (e) => {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "فشل حفظ الطلب");
    },
  );

  const deleteOrderMutation = useDeleteOrder(
    () => {
      setSelectedOrderId("");
      setSuccess("تم حذف الطلب.");
      setError(null);
    },
    (e) => {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "فشل حذف الطلب");
    },
  );

  const updateOrderMutation = useUpdateOrder(
    (data, orderId) => {
      setSelectedOrderId(String(orderId));
      setEditingOrderId(null);
      builder.resetDraft();
      setMode("archive");
      setSuccess("تم تعديل طلب التوريد بنجاح.");
      setError(null);
    },
    (e) => {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "فشل تعديل الطلب");
    },
  );

  const loadingOrAuth = !ready ? (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      جاري التحميل…
    </div>
  ) : !employeeId ? (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      لازم تسجيل دخول الإدارة أولًا.
      <div className="mt-2">
        <a
          href="/admin/login"
          className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
        >
          تسجيل دخول الإدارة
        </a>
      </div>
    </div>
  ) : null;

  const ordersErrorText = ordersQuery.error
    ? String(ordersQuery.error?.message || "فشل تحميل الطلبات")
    : "";

  const detailsErrorText = orderDetailsQuery.error
    ? String(orderDetailsQuery.error?.message || "فشل تحميل التفاصيل")
    : "";

  const beansErrorText = beansQuery.error
    ? String(beansQuery.error?.message || "فشل تحميل البن")
    : "";

  const orderDetails = orderDetailsQuery.data?.order || null;
  const orderItems = Array.isArray(orderDetailsQuery.data?.items)
    ? orderDetailsQuery.data.items
    : [];

  const refreshDisabled =
    (mode === "archive" && ordersQuery.isFetching) ||
    ((mode === "create" || mode === "edit") && beansQuery.isFetching);

  const onRefresh = useCallback(() => {
    if (mode === "create" || mode === "edit") {
      beansQuery.refetch();
      return;
    }

    ordersQuery.refetch();
    if (selectedOrderId) {
      orderDetailsQuery.refetch();
    }
  }, [mode, beansQuery, ordersQuery, orderDetailsQuery, selectedOrderId]);

  const onChangeMode = useCallback((next) => {
    setError(null);
    setSuccess(null);
    if (next !== "edit") {
      setEditingOrderId(null);
    }
    setMode(next);
  }, []);

  const onResetDraft = useCallback(() => {
    if (typeof window === "undefined") {
      builder.resetDraft();
      setError(null);
      setSuccess(null);
      return;
    }

    const ok = window.confirm("تفريغ عناصر الطلب الحالي؟");
    if (!ok) return;
    builder.resetDraft();
    setError(null);
    setSuccess(null);
  }, [builder]);

  const onSaveDraftAsOrder = useCallback(() => {
    const v = builder.validateAndBuildPayload();
    if (!v.ok) {
      setError(v.error);
      setSuccess(null);
      return;
    }

    createOrderMutation.mutate(v.payload);
  }, [builder, createOrderMutation]);

  const onEditOrder = useCallback(
    (order, items) => {
      builder.loadFromOrder(order, items);
      setEditingOrderId(order.id);
      setMode("edit");
      setError(null);
      setSuccess(null);
    },
    [builder],
  );

  const onSaveEdit = useCallback(() => {
    if (!editingOrderId) return;
    const v = builder.validateAndBuildPayload();
    if (!v.ok) {
      setError(v.error);
      setSuccess(null);
      return;
    }

    updateOrderMutation.mutate({
      orderId: editingOrderId,
      payload: v.payload,
    });
  }, [builder, editingOrderId, updateOrderMutation]);

  const onCancelEdit = useCallback(() => {
    builder.resetDraft();
    setEditingOrderId(null);
    setMode("archive");
    setError(null);
    setSuccess(null);
  }, [builder]);

  if (ready && isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="green-bean-orders" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[900px] space-y-4">
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/80`}>
              هذه الصفحة خاصة بالمحاسبة.
              <div className="mt-3">
                <a
                  href="/"
                  className={`${ws.btnNeutral} px-4 py-2 inline-flex`}
                >
                  رجوع
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const createView = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <BeansList
        beans={beans}
        selectedBeanIds={builder.selectedBeanIds}
        beanQtyMap={builder.beanQtyMap}
        onToggleBean={builder.toggleBean}
        onIncrementQty={builder.incrementBeanQty}
        onDecrementQty={builder.decrementBeanQty}
        isLoading={beansQuery.isLoading}
        error={beansErrorText}
      />

      <OrderBuilder
        draft={builder.draft}
        previewRows={builder.previewRows}
        onSetOrderField={builder.setOrderField}
        onUpdateItem={builder.updateItem}
        onRemoveBean={builder.removeBean}
        onIncrementQty={builder.incrementBeanQty}
        onDecrementQty={builder.decrementBeanQty}
        onSave={onSaveDraftAsOrder}
        isSaving={createOrderMutation.isPending}
        error={error}
      />
    </div>
  );

  const editView = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <BeansList
        beans={beans}
        selectedBeanIds={builder.selectedBeanIds}
        beanQtyMap={builder.beanQtyMap}
        onToggleBean={builder.toggleBean}
        onIncrementQty={builder.incrementBeanQty}
        onDecrementQty={builder.decrementBeanQty}
        isLoading={beansQuery.isLoading}
        error={beansErrorText}
      />

      <OrderBuilder
        draft={builder.draft}
        previewRows={builder.previewRows}
        onSetOrderField={builder.setOrderField}
        onUpdateItem={builder.updateItem}
        onRemoveBean={builder.removeBean}
        onIncrementQty={builder.incrementBeanQty}
        onDecrementQty={builder.decrementBeanQty}
        onSave={onSaveEdit}
        isSaving={updateOrderMutation.isPending}
        error={error}
        editingOrderId={editingOrderId}
        onCancelEdit={onCancelEdit}
      />
    </div>
  );

  const archiveView = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <OrdersList
        orders={orders}
        selectedOrderId={selectedOrderId}
        onSelectOrder={setSelectedOrderId}
        onDeleteOrder={(id) => deleteOrderMutation.mutate(id)}
        isLoading={ordersQuery.isLoading}
        error={ordersErrorText}
        deleteDisabled={deleteOrderMutation.isPending}
        filterMonth={filterMonth}
        onFilterMonthChange={setFilterMonth}
      />

      <OrderDetails
        selectedOrderId={selectedOrderId}
        orderDetails={orderDetails}
        orderItems={orderItems}
        isLoading={orderDetailsQuery.isLoading}
        error={detailsErrorText}
        onRefresh={() => orderDetailsQuery.refetch()}
        isFetching={orderDetailsQuery.isFetching}
        onEditOrder={onEditOrder}
      />
    </div>
  );

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="green-bean-orders" />

      <MobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          <DesktopHeader />

          {loadingOrAuth}

          <ActionsCard
            mode={mode === "edit" ? "create" : mode}
            onChangeMode={onChangeMode}
            onRefresh={onRefresh}
            refreshDisabled={refreshDisabled}
            onResetDraft={mode === "edit" ? onCancelEdit : onResetDraft}
            resetDisabled={
              createOrderMutation.isPending || updateOrderMutation.isPending
            }
            error={mode === "create" || mode === "edit" ? null : error}
            success={success}
          />

          {mode === "create"
            ? createView
            : mode === "edit"
              ? editView
              : archiveView}
        </div>
      </main>
    </div>
  );
}
