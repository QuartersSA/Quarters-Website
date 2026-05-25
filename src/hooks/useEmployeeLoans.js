import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

export function useEmployeeLoans({
  employeeId,
  isAdmin,
  filterEmployeeId,
  month,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: [
      "accounting_employee_loans",
      filterEmployeeId || null,
      month || null,
      !!includeInactive,
    ],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filterEmployeeId) qs.set("employee_id", String(filterEmployeeId));
      if (month) qs.set("month", String(month));
      if (includeInactive) qs.set("includeInactive", "1");
      const url = qs.toString()
        ? `/api/accounting/employee-loans?${qs.toString()}`
        : "/api/accounting/employee-loans";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل السلف");
      }
      return Array.isArray(data?.loans) ? data.loans : [];
    },
  });
}

export function useLoanEmployees(employeeId, isAdmin) {
  return useQuery({
    queryKey: ["accounting_loan_employees"],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/hr/bonuses/employees");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل قائمة الموظفين");
      }
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/employee-loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة القرض");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_employee_loans"],
      });
      toast.success("تم تسجيل القرض");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تسجيل القرض: ${error.message}`);
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`/api/accounting/employee-loans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل القرض");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_employee_loans"],
      });
      toast.success("تم حفظ التعديلات");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force
        ? `/api/accounting/employee-loans/${id}?force=1`
        : `/api/accounting/employee-loans/${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الحذف");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_employee_loans"],
      });
      toast.success(data?.hard ? "تم الحذف نهائياً" : "تم إلغاء تفعيل القرض");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });
}
