import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { mockApi } from "@/utils/branchProjectsMock";
import { queryKeys } from "@/utils/queryKeys";

// مشاريع تأسيس الفروع — الاستعلامات والطفرات.
//
// الخلفية مربوطة: `BRANCH_PROJECTS_MOCK = false` فتذهب الطلبات إلى
// `/api/accounting/branch-projects`. قلبه إلى true يعيد المخزن المحلي
// (`branchProjectsMock`) للتجربة بلا خادم بنفس الأشكال.

const BASE = "/api/accounting/branch-projects";
export const BRANCH_PROJECTS_MOCK = false;

// خطأ يحمل كود الخادم (milestones_pending / not_found …) حتى تتصرف
// الواجهة بحسبه.
function apiError(data, fallback, status) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code || null;
  error.status = status || null;
  error.data = data || null;
  if (Array.isArray(data?.pending)) error.pending = data.pending;
  return error;
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

async function request(method, path, body, fallback) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await adminFetch(`${BASE}${path}`, init);
  const data = await readJson(res);
  if (!res.ok) throw apiError(data, fallback, res.status);
  return data;
}

function unwrapProject(data) {
  return data?.project ?? data ?? null;
}

export function invalidateBranchProjectQueries(queryClient, id) {
  const tasks = [queryClient.invalidateQueries({ queryKey: queryKeys.branchProjects() })];
  if (id !== undefined && id !== null && id !== "") {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.branchProject(Number(id)) }));
  } else {
    tasks.push(queryClient.invalidateQueries({ queryKey: queryKeys.branchProject() }));
  }
  return Promise.all(tasks);
}

// ---------- الاستعلامات ----------

export function useBranchProjects({ employeeId, isAdmin } = {}) {
  return useQuery({
    queryKey: queryKeys.branchProjects(),
    enabled: !!employeeId && !!isAdmin,
    queryFn: async () => {
      if (BRANCH_PROJECTS_MOCK) return mockApi.list();
      const data = await request("GET", "", undefined, "فشل تحميل مشاريع التأسيس");
      return Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
    },
  });
}

export function useBranchProject(id) {
  return useQuery({
    queryKey: queryKeys.branchProject(id ? Number(id) : null),
    enabled: !!id,
    queryFn: async () => {
      if (BRANCH_PROJECTS_MOCK) return mockApi.get(id);
      const data = await request("GET", `/${id}`, undefined, "فشل تحميل المشروع");
      return unwrapProject(data);
    },
  });
}

// ---------- الطفرات ----------

// مصنع طفرة موحّد: ينفّذ mock أو الخادم، يبطل الكاش، ويعرض التوست.
// `extraKeys`: مفاتيح استعلام إضافية تُبطل مع المشروع (مثل فواتير المشتريات).
function useProjectMutation({ mock, real, successMessage, errorPrefix, onErrorCode, extraKeys }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables) => (BRANCH_PROJECTS_MOCK ? mock(variables) : real(variables)),
    onSuccess: async (data, variables) => {
      const id = variables?.project_id ?? variables?.id ?? data?.id ?? null;
      await invalidateBranchProjectQueries(queryClient, id);
      for (const key of Array.isArray(extraKeys) ? extraKeys : []) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      const message = typeof successMessage === "function" ? successMessage(data, variables) : successMessage;
      if (message) toast.success(message);
    },
    onError: (error) => {
      console.error(error);
      if (onErrorCode && error?.code && onErrorCode(error)) return;
      toast.error(`${errorPrefix}: ${error?.message || "خطأ غير متوقع"}`);
    },
  });
}

export function useCreateBranchProject() {
  return useProjectMutation({
    mock: (body) => mockApi.create(body),
    real: async (body) => unwrapProject(await request("POST", "", body, "فشل إنشاء المشروع")),
    successMessage: (project) => (project?.code ? `تم إنشاء المشروع ${project.code}` : "تم إنشاء المشروع"),
    errorPrefix: "فشل إنشاء المشروع",
  });
}

export function useUpdateBranchProject() {
  return useProjectMutation({
    mock: ({ id, ...fields }) => mockApi.update(id, fields),
    real: async ({ id, ...fields }) => unwrapProject(await request("PUT", `/${id}`, fields, "فشل حفظ المشروع")),
    successMessage: "تم حفظ المشروع",
    errorPrefix: "فشل حفظ المشروع",
  });
}

export function useDeleteBranchProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) =>
      BRANCH_PROJECTS_MOCK ? mockApi.remove(id) : request("DELETE", `/${id}`, undefined, "فشل حذف المشروع"),
    onSuccess: async (_data, variables) => {
      // يُزال استعلام التفاصيل بدل إعادة جلبه (404) قبل الانتقال للقائمة.
      queryClient.removeQueries({ queryKey: queryKeys.branchProject(Number(variables?.id)) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.branchProjects() });
      toast.success("تم حذف المشروع");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل حذف المشروع: ${error?.message || "خطأ غير متوقع"}`);
    },
  });
}

export function useOpenBranchProject() {
  return useProjectMutation({
    mock: ({ id, actual_opening_date, force }) => mockApi.open(id, { actual_opening_date, force: !!force }),
    real: async ({ id, actual_opening_date, force }) =>
      unwrapProject(
        await request("POST", `/${id}/open`, { actual_opening_date, force: !!force }, "فشل تأكيد الافتتاح"),
      ),
    successMessage: "تم تأكيد افتتاح الفرع",
    errorPrefix: "فشل تأكيد الافتتاح",
    onErrorCode: (error) => {
      if (error.code !== "milestones_pending") return false;
      const pending = Array.isArray(error.pending) ? error.pending : [];
      toast.warning(
        pending.length
          ? `معالم غير مكتملة: ${pending.join("، ")} — أكملها أو أكّد الافتتاح رغم ذلك.`
          : "توجد معالم غير مكتملة — أكملها أو أكّد الافتتاح رغم ذلك.",
        { duration: 9000 },
      );
      return true;
    },
  });
}

// ---------- الأقسام ----------

export function useSaveBranchProjectPhase() {
  return useProjectMutation({
    mock: (vars) => mockApi.savePhase(vars),
    real: ({ project_id, id, ...fields }) =>
      id
        ? request("PUT", `/${project_id}/phases/${id}`, fields, "فشل حفظ القسم")
        : request("POST", `/${project_id}/phases`, fields, "فشل حفظ القسم"),
    successMessage: (_data, vars) => (vars?.id ? "تم حفظ القسم" : "تمت إضافة القسم"),
    errorPrefix: "فشل حفظ القسم",
  });
}

export function useDeleteBranchProjectPhase() {
  return useProjectMutation({
    mock: (vars) => mockApi.deletePhase(vars),
    real: ({ project_id, id }) => request("DELETE", `/${project_id}/phases/${id}`, undefined, "فشل حذف القسم"),
    successMessage: "تم حذف القسم",
    errorPrefix: "فشل حذف القسم",
  });
}

export function useReorderBranchProjectPhases() {
  return useProjectMutation({
    mock: (vars) => mockApi.reorderPhases(vars),
    real: ({ project_id, ids }) =>
      request("POST", `/${project_id}/phases/reorder`, { ids }, "فشل إعادة ترتيب الأقسام"),
    successMessage: "تم تحديث ترتيب الأقسام",
    errorPrefix: "فشل إعادة ترتيب الأقسام",
  });
}

// ---------- المهام ----------

export function useSaveBranchProjectTask() {
  return useProjectMutation({
    mock: (vars) => mockApi.saveTask(vars),
    real: ({ project_id, id, ...fields }) =>
      id
        ? request("PUT", `/${project_id}/tasks/${id}`, fields, "فشل حفظ المهمة")
        : request("POST", `/${project_id}/tasks`, fields, "فشل حفظ المهمة"),
    successMessage: (_data, vars) => (vars?.id ? "تم حفظ المهمة" : "تمت إضافة المهمة"),
    errorPrefix: "فشل حفظ المهمة",
  });
}

export function useDeleteBranchProjectTask() {
  return useProjectMutation({
    mock: (vars) => mockApi.deleteTask(vars),
    real: ({ project_id, id }) => request("DELETE", `/${project_id}/tasks/${id}`, undefined, "فشل حذف المهمة"),
    successMessage: "تم حذف المهمة",
    errorPrefix: "فشل حذف المهمة",
  });
}

// ---------- التطورات ----------

export function useAddBranchProjectUpdate() {
  return useProjectMutation({
    mock: (vars) => mockApi.addUpdate(vars),
    real: ({ project_id, ...fields }) => request("POST", `/${project_id}/updates`, fields, "فشل إضافة التطور"),
    successMessage: "تمت إضافة التطور",
    errorPrefix: "فشل إضافة التطور",
  });
}

export function useDeleteBranchProjectUpdate() {
  return useProjectMutation({
    mock: (vars) => mockApi.deleteUpdate(vars),
    real: ({ project_id, id }) => request("DELETE", `/${project_id}/updates/${id}`, undefined, "فشل حذف التطور"),
    successMessage: "تم حذف التطور",
    errorPrefix: "فشل حذف التطور",
  });
}

// ---------- المرفقات ----------

export function useAddBranchProjectAttachment() {
  return useProjectMutation({
    mock: (vars) => mockApi.addAttachment(vars),
    real: ({ project_id, ...fields }) =>
      request("POST", `/${project_id}/attachments`, fields, "فشل إضافة المرفق"),
    successMessage: "تمت إضافة المرفق",
    errorPrefix: "فشل إضافة المرفق",
  });
}

export function useDeleteBranchProjectAttachment() {
  return useProjectMutation({
    mock: (vars) => mockApi.deleteAttachment(vars),
    real: ({ project_id, id }) =>
      request("DELETE", `/${project_id}/attachments/${id}`, undefined, "فشل حذف المرفق"),
    successMessage: "تم حذف المرفق",
    errorPrefix: "فشل حذف المرفق",
  });
}

// ---------- الفواتير ----------
// الفواتير الفعلية تُنشأ من نافذة فاتورة المشتريات (`project_id`/
// `project_phase_id` في حمولتها). هنا: ربط فاتورة موجودة بالمشروع
// (POST `{invoice_id, phase_id}`) وتعديل القسم/الحساب (PUT
// `{phase_id, expense_account_code}`) والحذف النهائي.

export function useSaveBranchProjectInvoice() {
  return useProjectMutation({
    mock: (vars) => mockApi.saveInvoice(vars),
    real: ({ project_id, id, invoice_id, ...fields }) => {
      if (id) {
        return request("PUT", `/${project_id}/invoices/${id}`, fields, "فشل حفظ الفاتورة");
      }
      if (invoice_id) {
        return request(
          "POST",
          `/${project_id}/invoices`,
          { invoice_id: Number(invoice_id), phase_id: fields.phase_id ?? null },
          "فشل ربط الفاتورة بالمشروع",
        );
      }
      return request("POST", `/${project_id}/invoices`, fields, "فشل حفظ الفاتورة");
    },
    successMessage: (_data, vars) =>
      vars?.id ? "تم حفظ الفاتورة" : vars?.invoice_id ? "تم ربط الفاتورة بالمشروع" : "تمت إضافة الفاتورة",
    errorPrefix: "فشل حفظ الفاتورة",
  });
}

export function useDeleteBranchProjectInvoice() {
  return useProjectMutation({
    mock: (vars) => mockApi.deleteInvoice(vars),
    real: ({ project_id, id }) =>
      request("DELETE", `/${project_id}/invoices/${id}`, undefined, "فشل حذف الفاتورة"),
    successMessage: "تم حذف الفاتورة",
    errorPrefix: "فشل حذف الفاتورة",
  });
}

// ---------- العقود والدفعات ----------
// العقد التزام مقسّم إلى دفعات؛ السداد يبقى عبر فواتير المشتريات
// المرتبطة بالدفعات. لا دعم في الوضع التجريبي (mock).
// POST   /[id]/contracts                                       {…fields, installments}
// PUT    /[id]/contracts/[contractId]                          {…fields, installments}
// DELETE /[id]/contracts/[contractId]                          (409 has_invoices)
// PUT    /[id]/contracts/[contractId]/installments/[instId]    {invoice_id|null}

function mockUnavailable() {
  return Promise.reject(new Error("غير متاح في الوضع التجريبي"));
}

export function useSaveBranchProjectContract() {
  return useProjectMutation({
    mock: mockUnavailable,
    real: ({ project_id, id, ...fields }) =>
      id
        ? request("PUT", `/${project_id}/contracts/${id}`, fields, "فشل حفظ العقد")
        : request("POST", `/${project_id}/contracts`, fields, "فشل حفظ العقد"),
    successMessage: (_data, vars) => (vars?.id ? "تم حفظ العقد" : "تمت إضافة العقد"),
    errorPrefix: "فشل حفظ العقد",
    extraKeys: [queryKeys.accountingPurchaseInvoices()],
  });
}

export function useDeleteBranchProjectContract() {
  return useProjectMutation({
    mock: mockUnavailable,
    real: ({ project_id, id }) => request("DELETE", `/${project_id}/contracts/${id}`, undefined, "فشل حذف العقد"),
    successMessage: "تم حذف العقد",
    errorPrefix: "فشل حذف العقد",
    extraKeys: [queryKeys.accountingPurchaseInvoices()],
    onErrorCode: (error) => {
      if (error.code !== "has_invoices") return false;
      toast.error("لا يمكن حذف العقد: له فواتير مرتبطة بدفعاته — فك ربط الفواتير أولاً.", { duration: 8000 });
      return true;
    },
  });
}

export function useLinkContractInstallmentInvoice() {
  return useProjectMutation({
    mock: mockUnavailable,
    real: ({ project_id, contract_id, installment_id, invoice_id }) =>
      request(
        "PUT",
        `/${project_id}/contracts/${contract_id}/installments/${installment_id}`,
        { invoice_id: invoice_id === undefined || invoice_id === null || invoice_id === "" ? null : Number(invoice_id) },
        "فشل ربط الفاتورة بالدفعة",
      ),
    successMessage: (_data, vars) => (vars?.invoice_id ? "تم ربط الفاتورة بالدفعة" : "تم فك ربط الفاتورة من الدفعة"),
    errorPrefix: "فشل ربط الفاتورة بالدفعة",
    extraKeys: [queryKeys.accountingPurchaseInvoices()],
    onErrorCode: (error) => {
      if (error.code !== "linked_elsewhere") return false;
      toast.error(error.message || "الفاتورة مرتبطة بدفعة أو مشروع آخر.", { duration: 8000 });
      return true;
    },
  });
}
