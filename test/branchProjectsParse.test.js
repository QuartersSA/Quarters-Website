import { beforeEach, describe, expect, it, vi } from "vitest";

// الوحدة تستورد sql (Neon) عبر accountsTree/purchaseAudit — نستبدلها حتى
// تبقى الاختبارات نقية بلا قاعدة بيانات.
vi.mock("@/app/api/utils/sql", () => {
  const fake = () => Promise.resolve([]);
  fake.transaction = () => Promise.resolve([]);
  return { default: fake };
});

import {
  mapInvoiceRow,
  parseId,
  parsePhaseInput,
  parseProjectInput,
  parseTaskInput,
} from "@/app/api/utils/branchProjects";
import { todayRiyadh } from "@/utils/branchProjectMath";

const VALID_PROJECT = {
  name: "فرع الواحة",
  city: "الدمام",
  contract_signed_date: "2026-06-01",
  target_opening_date: "2026-11-11",
  budget_total: "650000",
};

describe("parseProjectInput", () => {
  it("requires name and city", () => {
    expect(parseProjectInput({ ...VALID_PROJECT, name: "  " }).error).toBe("اسم المشروع مطلوب");
    expect(parseProjectInput({ ...VALID_PROJECT, city: "" }).error).toBe("المدينة مطلوبة");
  });

  it("requires valid dates with target >= contract", () => {
    expect(parseProjectInput({ ...VALID_PROJECT, contract_signed_date: "" }).error).toBe("تاريخ توقيع العقد مطلوب");
    expect(parseProjectInput({ ...VALID_PROJECT, target_opening_date: "11/11/2026" }).error).toMatch(/غير صحيح/);
    expect(
      parseProjectInput({ ...VALID_PROJECT, target_opening_date: "2026-05-31" }).error,
    ).toMatch(/بعد تاريخ توقيع العقد/);
  });

  it("normalizes numbers, defaults status to planning and ignores 'opened'", () => {
    const { value, error } = parseProjectInput({ ...VALID_PROJECT, status: "opened", area_sqm: "140.5" });
    expect(error).toBeNull();
    expect(value.status).toBe("planning");
    expect(value.budget_total).toBe(650000);
    expect(value.area_sqm).toBe(140.5);
    expect(value.actual_opening_date).toBeNull();
    expect(value.manager_name).toBe("");
    expect(value.lease_contract_id).toBeNull();
    expect(parseProjectInput({ ...VALID_PROJECT, status: "bogus" }).error).toBe("حالة المشروع غير معروفة");
  });

  it("rejects negative budget and bad ids", () => {
    expect(parseProjectInput({ ...VALID_PROJECT, budget_total: -1 }).error).toBe("الميزانية الإجمالية غير صحيحة");
    expect(parseProjectInput({ ...VALID_PROJECT, lease_contract_id: "abc" }).error).toBe("رقم عقد الإيجار غير صحيح");
  });

  it("partial PUT falls back to existing values; null clears, 'opened' is kept only if already opened", () => {
    const existing = {
      ...VALID_PROJECT,
      budget_total: 650000,
      area_sqm: 140,
      status: "in_progress",
      manager_name: "فهد",
      notes: "ملاحظة",
    };
    const { value, error } = parseProjectInput({ notes: "جديدة", area_sqm: null, status: "opened" }, existing);
    expect(error).toBeNull();
    expect(value.name).toBe("فرع الواحة");
    expect(value.city).toBe("الدمام");
    expect(value.budget_total).toBe(650000);
    expect(value.area_sqm).toBeNull();
    expect(value.manager_name).toBe("فهد");
    expect(value.notes).toBe("جديدة");
    expect(value.status).toBe("in_progress");
    const opened = parseProjectInput({ name: "x" }, { ...existing, status: "opened" });
    expect(opened.value.status).toBe("opened");
  });
});

describe("parsePhaseInput", () => {
  it("requires a name, defaults weight to 1 and color to slate", () => {
    expect(parsePhaseInput({ name: "" }).error).toBe("اسم القسم مطلوب");
    const { value, error } = parsePhaseInput({ name: "الديكور", weight: "", color: "red" });
    expect(error).toBeNull();
    expect(value.weight).toBe(1);
    expect(value.color).toBe("#64748b");
    expect(value.status).toBe("not_started");
    expect(value.budget).toBe(0);
    expect(value.progress_override).toBeNull();
    expect(value.sort_order).toBeNull();
    expect(value.template_key).toBeNull();
  });

  it("validates dates, status and progress override range", () => {
    expect(
      parsePhaseInput({ name: "x", planned_start: "2026-10-10", planned_end: "2026-10-01" }).error,
    ).toMatch(/بعد بدايته/);
    expect(parsePhaseInput({ name: "x", planned_start: "bad" }).error).toMatch(/غير صحيح/);
    expect(parsePhaseInput({ name: "x", status: "weird" }).error).toBe("حالة القسم غير معروفة");
    expect(parsePhaseInput({ name: "x", progress_override: 120 }).error).toMatch(/بين 0 و100/);
    expect(parsePhaseInput({ name: "x", budget: -5 }).error).toBe("ميزانية القسم غير صحيحة");
  });

  it("partial update keeps existing fields, null clears actual dates and override, weight 0 -> 1", () => {
    const existing = {
      name: "المعدات",
      sort_order: 6,
      planned_start: "2026-10-10",
      planned_end: "2026-10-25",
      actual_start: "2026-10-11",
      actual_end: "2026-10-20",
      status: "done",
      budget: 120000,
      weight: 2,
      progress_override: 80,
      color: "#14b8a6",
      template_key: "equipment",
      default_account_code: "5306",
      owner_name: "سارة",
    };
    const { value, error } = parsePhaseInput(
      { actual_end: null, progress_override: null, weight: 0, status: "in_progress" },
      existing,
    );
    expect(error).toBeNull();
    expect(value.name).toBe("المعدات");
    expect(value.sort_order).toBe(6);
    expect(value.actual_start).toBe("2026-10-11");
    expect(value.actual_end).toBeNull();
    expect(value.progress_override).toBeNull();
    expect(value.weight).toBe(1);
    expect(value.status).toBe("in_progress");
    expect(value.color).toBe("#14b8a6");
    expect(value.template_key).toBe("equipment");
    expect(value.default_account_code).toBe("5306");
    expect(value.owner_name).toBe("سارة");
    expect(value.budget).toBe(120000);
  });
});

describe("parseTaskInput", () => {
  it("requires a title and a known status", () => {
    expect(parseTaskInput({ title: " " }).error).toBe("عنوان المهمة مطلوب");
    expect(parseTaskInput({ title: "x", status: "nope" }).error).toBe("حالة المهمة غير معروفة");
    expect(parseTaskInput({ title: "x", phase_id: "abc" }).error).toBe("رقم القسم غير صحيح");
    expect(parseTaskInput({ title: "x", due_date: "40/13/2026" }).error).toMatch(/غير صحيح/);
  });

  it("sets done_at to today when status becomes done, clears it otherwise", () => {
    const done = parseTaskInput({ title: "تركيب المعدات", status: "done", is_milestone: true, phase_id: "3" });
    expect(done.error).toBeNull();
    expect(done.value.done_at).toBe(todayRiyadh());
    expect(done.value.is_milestone).toBe(true);
    expect(done.value.phase_id).toBe(3);

    const keep = parseTaskInput({ status: "done" }, { title: "x", status: "done", done_at: "2026-09-01" });
    expect(keep.value.done_at).toBe("2026-09-01");

    const reopened = parseTaskInput({ status: "todo" }, { title: "x", status: "done", done_at: "2026-09-01" });
    expect(reopened.value.done_at).toBeNull();
    expect(reopened.value.status).toBe("todo");
  });

  it("partial update inherits phase, milestone flag and due date; null due_date clears", () => {
    const existing = { title: "x", phase_id: 7, is_milestone: true, due_date: "2026-10-20", sort_order: 2, assignee_name: "نورة" };
    const inherit = parseTaskInput({ notes: "ملاحظة" }, existing);
    expect(inherit.value.phase_id).toBe(7);
    expect(inherit.value.is_milestone).toBe(true);
    expect(inherit.value.due_date).toBe("2026-10-20");
    expect(inherit.value.sort_order).toBe(2);
    expect(inherit.value.assignee_name).toBe("نورة");
    expect(inherit.value.notes).toBe("ملاحظة");
    const cleared = parseTaskInput({ due_date: null, is_milestone: false }, existing);
    expect(cleared.value.due_date).toBeNull();
    expect(cleared.value.is_milestone).toBe(false);
  });
});

describe("parseId", () => {
  it("accepts positive integers (also as strings) and rejects the rest", () => {
    expect(parseId("12")).toBe(12);
    expect(parseId(3)).toBe(3);
    expect(parseId("0")).toBeNull();
    expect(parseId("-4")).toBeNull();
    expect(parseId("1.5")).toBeNull();
    expect(parseId("abc")).toBeNull();
    expect(parseId(null)).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});

describe("mapInvoiceRow", () => {
  const base = {
    id: "9",
    project_id: "2",
    project_phase_id: "5",
    invoice_number: "CT-0088",
    invoice_date: "2026-08-15",
    due_date: "2026-09-15",
    supplier_name: "مؤسسة البناء",
    expense_account_code: "5304",
    expense_account_name: "ديكور وتشطيب",
    total_amount: "95000.00",
    paid_amount: "60000.00",
    lease_contract_id: null,
    lease_month: null,
  };

  it("derives status: paid, overdue, partial, pending (with 0.005 tolerance)", () => {
    expect(mapInvoiceRow({ ...base, paid_amount: "94999.996" }, "2026-10-01").status).toBe("paid");
    expect(mapInvoiceRow(base, "2026-10-01").status).toBe("overdue");
    expect(mapInvoiceRow(base, "2026-09-01").status).toBe("partial_paid");
    expect(mapInvoiceRow({ ...base, paid_amount: "0" }, "2026-09-01").status).toBe("pending_payment");
    expect(mapInvoiceRow({ ...base, paid_amount: "0", due_date: null }, "2027-01-01").status).toBe("pending_payment");
    expect(mapInvoiceRow({ ...base, total_amount: "0", paid_amount: "0", due_date: null }).status).toBe("pending_payment");
  });

  it("maps numbers, phase, and lease source", () => {
    const row = mapInvoiceRow(base, "2026-10-01");
    expect(row).toMatchObject({
      id: 9,
      project_id: 2,
      phase_id: 5,
      invoice_number: "CT-0088",
      supplier_name: "مؤسسة البناء",
      expense_account_code: "5304",
      total_amount: 95000,
      paid_amount: 60000,
      source: "manual",
      lease_contract_id: null,
    });
    const lease = mapInvoiceRow({ ...base, lease_contract_id: "4", lease_month: "202606" }, "2026-10-01");
    expect(lease.source).toBe("lease");
    expect(lease.lease_contract_id).toBe(4);
    expect(lease.lease_month).toBe("202606");
  });
});
