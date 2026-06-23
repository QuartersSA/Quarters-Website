import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useDepositModal() {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositBranchId, setDepositBranchId] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositResult, setDepositResult] = useState(null);

  const branchesQuery = useQuery({
    queryKey: queryKeys.branchesForDeposit(),
    enabled: showDepositModal,
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الفروع");
      }
      return data;
    },
  });

  const branches = useMemo(() => {
    const raw = branchesQuery.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.branches)) return raw.branches;
    return [];
  }, [branchesQuery.data]);

  const branchOptions = useMemo(() => {
    const base = [{ value: "", label: "اختر الفرع" }];
    const items = branches.map((b) => ({
      value: String(b.id),
      label: b.name,
    }));
    return [...base, ...items];
  }, [branches]);

  const depositMutation = useMutation({
    mutationFn: async ({ orderId, branchId, note }) => {
      const res = await adminFetch(
        `/api/accounting/green-bean-orders/${orderId}/deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: Number(branchId),
            note: note || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الإيداع في المخزون");
      }
      return data;
    },
    onSuccess: (data) => {
      setDepositResult(data);
      toast.success(`تم إيداع ${data.deposited} نوع بن في المخزون بنجاح`);
    },
    onError: (e) => {
      console.error(e);
      toast.error(e?.message || "فشل الإيداع في المخزون");
    },
  });

  const onOpenDepositModal = useCallback(() => {
    setShowDepositModal(true);
    setDepositBranchId("");
    setDepositNote("");
    setDepositResult(null);
  }, []);

  const onCloseDepositModal = useCallback(() => {
    setShowDepositModal(false);
    setDepositBranchId("");
    setDepositNote("");
    setDepositResult(null);
  }, []);

  const onConfirmDeposit = useCallback(
    (selectedOrderId) => {
      if (!depositBranchId) {
        toast.error("اختر الفرع أولاً");
        return;
      }
      if (!selectedOrderId) return;

      depositMutation.mutate({
        orderId: selectedOrderId,
        branchId: depositBranchId,
        note: depositNote,
      });
    },
    [depositBranchId, depositNote, depositMutation],
  );

  return {
    showDepositModal,
    depositBranchId,
    setDepositBranchId,
    depositNote,
    setDepositNote,
    depositResult,
    branchOptions,
    branchesLoading: branchesQuery.isLoading,
    branchesError: branchesQuery.error,
    depositMutation,
    onOpenDepositModal,
    onCloseDepositModal,
    onConfirmDeposit,
  };
}
