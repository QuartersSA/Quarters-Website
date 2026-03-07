import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useGreenBeans(ready, isAuthenticated, isAdmin) {
  return useQuery({
    queryKey: ["accounting", "greenBeans"],
    enabled: ready && isAuthenticated && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/green-beans");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/green-beans, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}

export function useOrders(ready, isAuthenticated, isAdmin) {
  return useQuery({
    queryKey: ["accounting", "greenBeanOrders"],
    enabled: ready && isAuthenticated && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/green-bean-orders");
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
}

export function useOrderDetails(
  ready,
  isAuthenticated,
  isAdmin,
  selectedOrderId,
) {
  return useQuery({
    queryKey: ["accounting", "greenBeanOrders", selectedOrderId],
    enabled:
      ready &&
      isAuthenticated &&
      isAdmin &&
      !!selectedOrderId &&
      Number(selectedOrderId) > 0,
    queryFn: async () => {
      const res = await adminFetch(
        `/api/accounting/green-bean-orders/${selectedOrderId}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/green-bean-orders/${selectedOrderId}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}

export function useCreateOrder(onSuccess, onError) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/green-bean-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When posting /api/accounting/green-bean-orders, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeanOrders"],
      });
      onSuccess(data);
    },
    onError,
  });
}

export function useDeleteOrder(onSuccess, onError) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/accounting/green-bean-orders/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When deleting /api/accounting/green-bean-orders/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeanOrders"],
      });
      onSuccess();
    },
    onError,
  });
}

export function useUpdateOrderItemReceived(onSuccess, onError) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, receivedAfterWasteKg, orderId }) => {
      const res = await adminFetch(
        `/api/accounting/green-bean-order-items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receivedAfterWasteKg }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When putting /api/accounting/green-bean-order-items/${itemId}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return { data, orderId };
    },
    onSuccess: async ({ data, orderId }) => {
      if (orderId) {
        await queryClient.invalidateQueries({
          queryKey: ["accounting", "greenBeanOrders", String(orderId)],
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeanOrders"],
      });
      onSuccess?.(data);
    },
    onError,
  });
}

export function useUpdateOrder(onSuccess, onError) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, payload }) => {
      const res = await adminFetch(
        `/api/accounting/green-bean-orders/${orderId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When putting /api/accounting/green-bean-orders/${orderId}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return { data, orderId };
    },
    onSuccess: async ({ data, orderId }) => {
      if (orderId) {
        await queryClient.invalidateQueries({
          queryKey: ["accounting", "greenBeanOrders", String(orderId)],
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeanOrders"],
      });
      onSuccess?.(data, orderId);
    },
    onError,
  });
}
