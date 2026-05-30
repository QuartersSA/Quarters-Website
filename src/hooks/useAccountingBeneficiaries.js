import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

export function useAccountingBeneficiaries({
  employeeId,
  isAdmin,
  q,
  contactId,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: [
      "accounting_beneficiaries",
      q || "",
      contactId || null,
      !!includeInactive,
    ],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (contactId) qs.set("contact_id", String(contactId));
      if (includeInactive) qs.set("includeInactive", "1");
      const url = qs.toString()
        ? `/api/accounting/beneficiaries?${qs.toString()}`
        : "/api/accounting/beneficiaries";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل المستفيدين");
      }
      return Array.isArray(data?.beneficiaries) ? data.beneficiaries : [];
    },
  });
}

export function useCreateAccountingBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة المستفيد");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_beneficiaries"],
      });
      toast.success("تم إضافة المستفيد");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateAccountingBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`/api/accounting/beneficiaries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل التعديل");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_beneficiaries"],
      });
      toast.success("تم حفظ التعديلات");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteAccountingBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force
        ? `/api/accounting/beneficiaries/${id}?force=1`
        : `/api/accounting/beneficiaries/${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الحذف");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_beneficiaries"],
      });
      toast.success(data?.hard ? "تم الحذف نهائياً" : "تم إيقاف المستفيد");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });
}
