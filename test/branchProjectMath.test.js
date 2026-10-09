import { describe, expect, it } from "vitest";
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  DEFAULT_PHASE_TEMPLATE,
  ESTABLISHMENT_ACCOUNTS,
  INSTALLMENT_STATUS_LABELS,
  addDays,
  addMonths,
  barPosition,
  buildInstallments,
  buildPhasesFromTemplate,
  contractTotals,
  daysBetween,
  daysToOpening,
  formatDateKey,
  installmentStatus,
  invoiceStatus,
  nextProjectCode,
  phaseBudget,
  phaseContracted,
  phaseHealth,
  phaseProgress,
  phaseTasks,
  projectBudget,
  projectHealth,
  projectProgress,
  summarizeContracts,
  summarizeProjects,
  timelineRange,
} from "@/utils/branchProjectMath";

const TODAY = "2026-10-05";

function task(phase_id, status, extra = {}) {
  return { id: Math.random(), project_id: 1, phase_id, title: "t", status, is_milestone: false, ...extra };
}

function phase(id, extra = {}) {
  return {
    id,
    project_id: 1,
    name: `P${id}`,
    sort_order: id,
    planned_start: "2026-09-01",
    planned_end: "2026-10-31",
    actual_start: null,
    actual_end: null,
    status: "in_progress",
    budget: 0,
    weight: 1,
    progress_override: null,
    ...extra,
  };
}

describe("branch project math — template", () => {
  it("ships 11 phases with distinct colors, valid accounts and the five milestones", () => {
    expect(DEFAULT_PHASE_TEMPLATE).toHaveLength(11);
    const colors = new Set(DEFAULT_PHASE_TEMPLATE.map((p) => p.color));
    expect(colors.size).toBe(11);
    const codes = new Set(ESTABLISHMENT_ACCOUNTS.map((a) => a.code));
    for (const p of DEFAULT_PHASE_TEMPLATE) {
      expect(/^#[0-9a-f]{6}$/i.test(p.color), p.name).toBe(true);
      expect(codes.has(p.default_account_code), p.name).toBe(true);
      expect(p.tasks.length, p.name).toBeGreaterThanOrEqual(3);
      expect(p.tasks.length, p.name).toBeLessThanOrEqual(6);
    }
    const milestones = DEFAULT_PHASE_TEMPLATE.flatMap((p, i) =>
      p.tasks.filter((t) => t.is_milestone).map((t) => [i + 1, t.title]),
    );
    expect(milestones).toEqual([
      [1, "تسليم الموقع"],
      [4, "اكتمال التشطيب"],
      [6, "تركيب المعدات"],
      [11, "الافتتاح التجريبي"],
      [11, "الافتتاح"],
    ]);
  });
});

describe("branch project math — progress", () => {
  it("prefers the override, then the done ratio, then the status", () => {
    expect(phaseProgress(phase(1, { progress_override: 37 }), [task(1, "todo")])).toBe(37);
    expect(phaseProgress(phase(1, { progress_override: 140 }), [])).toBe(100);
    expect(phaseProgress(phase(1), [task(1, "done"), task(1, "done"), task(1, "todo")])).toBe(67);
    expect(phaseProgress(phase(1, { status: "done" }), [])).toBe(100);
    expect(phaseProgress(phase(1, { status: "in_progress" }), [])).toBe(50);
    expect(phaseProgress(phase(1, { status: "not_started" }), [])).toBe(0);
  });

  it("weights project progress by phase weight", () => {
    const project = {
      phases: [phase(1, { weight: 3, progress_override: 100 }), phase(2, { weight: 1, progress_override: 0 })],
      tasks: [],
    };
    expect(projectProgress(project)).toBe(75);
    expect(projectProgress({ phases: [], tasks: [] })).toBe(0);
    const equal = { phases: [phase(1, { weight: null }), phase(2, { weight: null })], tasks: [task(1, "done"), task(2, "todo")] };
    expect(projectProgress(equal)).toBe(50);
  });

  it("filters and sorts the tasks of a phase", () => {
    const project = { tasks: [task(2, "todo", { sort_order: 2, id: 9 }), task(1, "todo", { id: 1 }), task(2, "done", { sort_order: 1, id: 8 })] };
    expect(phaseTasks(project, 2).map((t) => t.id)).toEqual([8, 9]);
    expect(phaseTasks(project, "1")).toHaveLength(1);
  });
});

describe("branch project math — health", () => {
  it("is late when the planned end has passed and the phase is not done", () => {
    expect(phaseHealth(phase(1, { planned_end: "2026-10-04" }), [], TODAY)).toBe("late");
    expect(phaseHealth(phase(1, { planned_end: "2026-10-04", status: "done" }), [], TODAY)).toBe("done");
  });

  it("is at risk when under 20% of the duration remains and progress is below 60%", () => {
    // 1 Sep → 10 Oct = 40 days; 5 Oct → 10 Oct = 6 days left (15%).
    const tight = phase(1, { planned_start: "2026-09-01", planned_end: "2026-10-10" });
    expect(phaseHealth(tight, [task(1, "done"), task(1, "todo")], TODAY)).toBe("at_risk");
    expect(phaseHealth(tight, [task(1, "done"), task(1, "done"), task(1, "todo")], TODAY)).toBe("on_track");
  });

  it("distinguishes on_track from not_started", () => {
    expect(phaseHealth(phase(1), [task(1, "done"), task(1, "todo")], TODAY)).toBe("on_track");
    expect(phaseHealth(phase(1, { status: "not_started" }), [task(1, "todo")], TODAY)).toBe("not_started");
    expect(phaseHealth(phase(1, { status: "not_started", planned_start: "2026-11-01", planned_end: "2026-11-30" }), [], TODAY)).toBe("not_started");
  });

  it("reports the worst phase health for the project, or done when opened", () => {
    const project = {
      status: "in_progress",
      phases: [phase(1, { status: "done" }), phase(2), phase(3, { planned_end: "2026-09-01" })],
      tasks: [task(2, "done")],
    };
    expect(projectHealth(project, TODAY)).toBe("late");
    expect(projectHealth({ ...project, phases: project.phases.slice(0, 2) }, TODAY)).toBe("on_track");
    expect(projectHealth({ ...project, status: "opened" }, TODAY)).toBe("done");
    expect(projectHealth({ status: "planning", phases: [], tasks: [] }, TODAY)).toBe("not_started");
  });

  it("counts days to opening with negatives after the target", () => {
    expect(daysToOpening({ target_opening_date: "2026-11-11" }, TODAY)).toBe(37);
    expect(daysToOpening({ target_opening_date: "2026-10-01" }, TODAY)).toBe(-4);
    expect(daysToOpening({ target_opening_date: null }, TODAY)).toBeNull();
  });
});

describe("branch project math — budget", () => {
  const invoices = [
    { id: 1, phase_id: 1, total_amount: 95000, paid_amount: 60000 },
    { id: 2, phase_id: 1, total_amount: 70000, paid_amount: 0 },
    { id: 3, phase_id: 2, total_amount: 1000, paid_amount: 1000 },
    { id: 4, phase_id: null, total_amount: 500, paid_amount: 0 },
  ];

  it("computes phase committed/paid/remaining and over-budget from its own invoices", () => {
    expect(phaseBudget(phase(1, { budget: 180000 }), invoices)).toEqual({
      budget: 180000,
      committed: 165000,
      paid: 60000,
      remaining: 15000,
      over: 0,
      pct: 92,
    });
    const over = phaseBudget(phase(1, { budget: 150000 }), invoices);
    expect(over.over).toBe(15000);
    expect(over.remaining).toBe(-15000);
    expect(over.pct).toBe(110);
    expect(phaseBudget(phase(9, { budget: 0 }), invoices)).toMatchObject({ committed: 0, pct: 0 });
  });

  it("computes project totals including unallocated budget and unassigned invoices", () => {
    const project = {
      budget_total: 650000,
      phases: [phase(1, { budget: 180000 }), phase(2, { budget: 20000 })],
      invoices,
    };
    expect(projectBudget(project)).toEqual({
      budget_total: 650000,
      phases_budget: 200000,
      unallocated: 450000,
      committed: 166500,
      paid: 61000,
      remaining: 483500,
      over: 0,
      pct: 26,
    });
    expect(projectBudget({ budget_total: 100000, phases: [], invoices }).over).toBe(66500);
  });

  it("derives invoice status from paid, total and due date", () => {
    expect(invoiceStatus({ total_amount: 100, paid_amount: 100, due_date: "2026-01-01" }, TODAY)).toBe("paid");
    expect(invoiceStatus({ total_amount: 100, paid_amount: 40, due_date: "2026-09-30" }, TODAY)).toBe("overdue");
    expect(invoiceStatus({ total_amount: 100, paid_amount: 40, due_date: "2026-10-30" }, TODAY)).toBe("partial_paid");
    expect(invoiceStatus({ total_amount: 100, paid_amount: 0, due_date: "2026-10-05" }, TODAY)).toBe("pending_payment");
    expect(invoiceStatus({ total_amount: 100, paid_amount: 0, due_date: null }, TODAY)).toBe("pending_payment");
  });
});

describe("branch project math — timeline", () => {
  it("places bars proportionally and clamps them to the range", () => {
    // Range: Oct 2026 (31 days).
    expect(barPosition("2026-10-01", "2026-10-31", "2026-10-01", "2026-10-31")).toEqual({ left_pct: 0, width_pct: 100 });
    const half = barPosition("2026-10-01", "2026-10-15", "2026-10-01", "2026-10-30");
    expect(half).toEqual({ left_pct: 0, width_pct: 50 });
    const clamped = barPosition("2026-09-01", "2026-12-31", "2026-10-01", "2026-10-31");
    expect(clamped).toEqual({ left_pct: 0, width_pct: 100 });
    const outside = barPosition("2026-11-01", "2026-11-10", "2026-10-01", "2026-10-31");
    expect(outside.width_pct).toBe(0);
    const partial = barPosition("2026-10-16", "2026-11-10", "2026-10-01", "2026-10-31");
    expect(partial.left_pct).toBeCloseTo(48.39, 1);
    expect(partial.left_pct + partial.width_pct).toBeCloseTo(100, 1);
    expect(barPosition(null, null, "2026-10-01", "2026-10-31")).toEqual({ left_pct: 0, width_pct: 0 });
  });

  it("spans whole months from the first to the last project date and marks today", () => {
    const project = {
      contract_signed_date: "2026-06-01",
      target_opening_date: "2026-11-11",
      phases: [phase(1, { planned_start: "2026-06-16", planned_end: "2026-12-02" })],
      tasks: [],
    };
    const range = timelineRange(project, TODAY);
    expect(range.start).toBe("2026-06-01");
    expect(range.end).toBe("2026-12-31");
    expect(range.months.map((m) => m.key)).toEqual([
      "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
    expect(range.months[0].label).toBe("يونيو 2026");
    expect(range.months[0].left_pct).toBe(0);
    const widths = range.months.reduce((s, m) => s + m.width_pct, 0);
    expect(widths).toBeCloseTo(100, 0);
    expect(range.today_pct).toBeGreaterThan(55);
    expect(range.today_pct).toBeLessThan(65);
    expect(timelineRange(project, "2027-03-01").today_pct).toBeNull();
    expect(timelineRange({ phases: [], tasks: [] }, TODAY).months.length).toBeGreaterThan(0);
  });
});

describe("branch project math — template builder and codes", () => {
  it("spreads phases evenly so the last one ends on the opening day", () => {
    const phases = buildPhasesFromTemplate(DEFAULT_PHASE_TEMPLATE, "2026-06-01", "2026-11-11");
    expect(phases).toHaveLength(DEFAULT_PHASE_TEMPLATE.length);
    expect(phases[0].planned_start).toBe("2026-06-01");
    expect(phases.at(-1).planned_end).toBe("2026-11-11");
    for (let i = 0; i < phases.length; i += 1) {
      expect(phases[i].id).toBeUndefined();
      expect(phases[i].sort_order).toBe(i + 1);
      expect(phases[i].planned_end >= phases[i].planned_start, phases[i].name).toBe(true);
      if (i > 0) {
        expect(phases[i].planned_start > phases[i - 1].planned_start).toBe(true);
        expect(phases[i].planned_start).toBe(addDays(phases[i - 1].planned_end, 1));
      }
      expect(phases[i].color).toBe(DEFAULT_PHASE_TEMPLATE[i].color);
      expect(phases[i].tasks.length).toBe(DEFAULT_PHASE_TEMPLATE[i].tasks.length);
      expect(phases[i].tasks.every((t) => t.status === "todo" && t.due_date === phases[i].planned_end)).toBe(true);
    }
    const durations = phases.map((p) => daysBetween(p.planned_start, p.planned_end) + 1);
    expect(Math.max(...durations) - Math.min(...durations)).toBeLessThanOrEqual(1);
  });

  it("leaves dates empty without a valid range and tolerates a tiny range", () => {
    const empty = buildPhasesFromTemplate(DEFAULT_PHASE_TEMPLATE, null, "2026-11-11");
    expect(empty).toHaveLength(11);
    expect(empty.every((p) => p.planned_start === null && p.planned_end === null)).toBe(true);
    const tiny = buildPhasesFromTemplate(DEFAULT_PHASE_TEMPLATE, "2026-11-10", "2026-11-11");
    expect(tiny.at(-1).planned_end).toBe("2026-11-11");
    expect(tiny.every((p) => p.planned_end >= p.planned_start)).toBe(true);
    expect(buildPhasesFromTemplate([], "2026-01-01", "2026-02-01")).toEqual([]);
  });

  it("generates the next project code from the highest existing one", () => {
    expect(nextProjectCode([])).toBe("BP-001");
    expect(nextProjectCode([{ code: "BP-001" }, { code: "BP-007" }, { code: "X-9" }])).toBe("BP-008");
    expect(nextProjectCode([{ code: "BP-999" }])).toBe("BP-1000");
  });
});

describe("branch project math — summary and dates", () => {
  it("summarizes active projects, money, nearest opening and late phases", () => {
    const projects = [
      {
        id: 1,
        name: "A",
        status: "in_progress",
        budget_total: 650000,
        target_opening_date: "2026-11-11",
        phases: [phase(1, { planned_end: "2026-09-30" }), phase(2)],
        tasks: [],
        invoices: [{ phase_id: 1, total_amount: 1000, paid_amount: 400 }],
      },
      {
        id: 2,
        name: "B",
        status: "planning",
        budget_total: 500000,
        target_opening_date: "2027-03-15",
        phases: [],
        tasks: [],
        invoices: [],
      },
      { id: 3, name: "C", status: "opened", budget_total: 100, target_opening_date: "2026-01-01", phases: [], tasks: [], invoices: [{ total_amount: 50, paid_amount: 50 }] },
      { id: 4, name: "D", status: "cancelled", budget_total: 999999, target_opening_date: "2026-10-06", phases: [], tasks: [], invoices: [] },
    ];
    expect(summarizeProjects(projects, TODAY)).toEqual({
      active_count: 2,
      budget_total: 1150100,
      committed_total: 1050,
      paid_total: 450,
      nearest_opening: { project_id: 1, name: "A", days: 37 },
      late_phases: 1,
    });
    expect(summarizeProjects([], TODAY).nearest_opening).toBeNull();
  });

  it("does date math in UTC and formats Arabic month names", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("bad", 1)).toBeNull();
    expect(daysBetween("2026-06-01", "2026-11-11")).toBe(163);
    expect(daysBetween("2026-11-11", "2026-06-01")).toBe(-163);
    expect(daysBetween("x", "2026-06-01")).toBeNull();
    expect(formatDateKey("2026-11-11")).toBe("11 نوفمبر 2026");
    expect(formatDateKey(null)).toBe("—");
  });
});

describe("phaseHealth blocked", () => {
  it("treats a blocked phase with a future end date as at_risk", () => {
    const phase = { id: 9, status: "blocked", planned_start: "2026-10-01", planned_end: "2026-12-31" };
    expect(phaseHealth(phase, [], "2026-10-05")).toBe("at_risk");
  });
});

describe("branch project math — contracts and installments", () => {
  function inst(seq, extra = {}) {
    return {
      id: 100 + seq,
      contract_id: 1,
      seq,
      label: `الدفعة ${seq}`,
      due_date: null,
      amount: 5000,
      notes: "",
      invoice_id: null,
      invoice_number: null,
      invoice_total: 0,
      invoice_paid: 0,
      ...extra,
    };
  }

  function contract(extra = {}) {
    return {
      id: 1,
      project_id: 1,
      phase_id: 4,
      kind: "contractor",
      title: "مقاول الصبغ",
      party_name: "مؤسسة الألوان",
      party_contact_id: null,
      agreed_amount: 15000,
      vat_included: true,
      start_date: "2026-10-01",
      end_date: "2026-12-31",
      status: "active",
      attachment_url: null,
      attachment_name: null,
      notes: "",
      installments: [],
      invoiced: 0,
      paid: 0,
      ...extra,
    };
  }

  it("ships the contract constants with Arabic labels", () => {
    expect(CONTRACT_KINDS).toEqual(["contractor", "supplier", "service", "other"]);
    expect(CONTRACT_STATUSES).toEqual(["active", "completed", "cancelled"]);
    for (const kind of CONTRACT_KINDS) expect(CONTRACT_KIND_LABELS[kind]).toBeTruthy();
    for (const status of CONTRACT_STATUSES) expect(CONTRACT_STATUS_LABELS[status]).toBeTruthy();
    expect(Object.keys(INSTALLMENT_STATUS_LABELS).sort()).toEqual(["invoiced", "overdue", "paid", "pending"]);
    expect(INSTALLMENT_STATUS_LABELS.paid).toBe("مسددة");
  });

  it("marks an installment paid when its invoice is fully settled (within half a halala)", () => {
    expect(installmentStatus(inst(1, { invoice_id: 7, invoice_total: 5000, invoice_paid: 5000 }), TODAY)).toBe("paid");
    expect(installmentStatus(inst(1, { invoice_id: 7, invoice_total: 5000, invoice_paid: 4999.996 }), TODAY)).toBe("paid");
    // الاستحقاق الماضي لا يهم متى وُجدت فاتورة مسددة.
    expect(installmentStatus(inst(1, { invoice_id: 7, invoice_total: 100, invoice_paid: 100, due_date: "2026-01-01" }), TODAY)).toBe("paid");
  });

  it("marks an installment invoiced when its invoice is not fully paid, even when overdue", () => {
    expect(installmentStatus(inst(1, { invoice_id: 7, invoice_total: 5000, invoice_paid: 0 }), TODAY)).toBe("invoiced");
    expect(installmentStatus(inst(1, { invoice_id: 7, invoice_total: 5000, invoice_paid: 4990, due_date: "2026-09-01" }), TODAY)).toBe("invoiced");
    expect(installmentStatus(inst(1, { invoice_id: "7", invoice_total: 5000, invoice_paid: 2500 }), TODAY)).toBe("invoiced");
  });

  it("marks an uninvoiced installment overdue only when its due date is before today", () => {
    expect(installmentStatus(inst(1, { due_date: "2026-10-04" }), TODAY)).toBe("overdue");
    expect(installmentStatus(inst(1, { due_date: "2026-10-05" }), TODAY)).toBe("pending");
    expect(installmentStatus(inst(1, { due_date: "2026-10-06" }), TODAY)).toBe("pending");
  });

  it("keeps an installment pending without a due date or an invoice", () => {
    expect(installmentStatus(inst(1), TODAY)).toBe("pending");
    expect(installmentStatus(inst(1, { due_date: "" }), TODAY)).toBe("pending");
    expect(installmentStatus(inst(1, { invoice_id: "" , due_date: "2026-12-01" }), TODAY)).toBe("pending");
  });

  it("totals a contract: remaining, percentage, installment counts, next due and overdue count", () => {
    const c = contract({
      agreed_amount: 15000,
      invoiced: 10000,
      paid: 5000,
      installments: [
        inst(1, { due_date: "2026-09-01", invoice_id: 7, invoice_total: 5000, invoice_paid: 5000 }),
        inst(2, { due_date: "2026-09-20" }),
        inst(3, { due_date: "2026-10-20", invoice_id: 8, invoice_total: 5000, invoice_paid: 0 }),
        inst(4, { due_date: "2026-11-20", amount: 2500 }),
      ],
    });
    const totals = contractTotals(c, TODAY);
    expect(totals).toMatchObject({
      agreed: 15000,
      invoiced: 10000,
      paid: 5000,
      remaining: 10000,
      pct: 33,
      installments_total: 4,
      installments_paid: 1,
      installments_sum: 17500,
      overdue_count: 1,
    });
    expect(totals.next_due).toMatchObject({ seq: 2, due_date: "2026-09-20", amount: 5000, status: "overdue" });
    // بلا دفعات: لا دفعة تالية ولا متأخرات.
    expect(contractTotals(contract({ agreed_amount: 0 }), TODAY)).toMatchObject({
      agreed: 0,
      remaining: 0,
      pct: 0,
      installments_total: 0,
      next_due: null,
      overdue_count: 0,
    });
    // الدفعات بلا تاريخ تأتي بعد المؤرّخة في اختيار التالية.
    const undated = contractTotals(contract({ installments: [inst(1), inst(2, { due_date: "2026-12-01" })] }), TODAY);
    expect(undated.next_due.seq).toBe(2);
  });

  it("splits a total equally into monthly installments and puts the rounding remainder on the last one", () => {
    const list = buildInstallments({ count: 3, total: 10000, firstDue: "2026-10-31", every: "month" });
    expect(list.map((i) => i.amount)).toEqual([3333.33, 3333.33, 3333.34]);
    expect(list.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(10000, 2);
    expect(list.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(list.map((i) => i.due_date)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
    expect(list[0].label).toBe("الدفعة 1");
    expect(list.every((i) => i.notes === "")).toBe(true);
  });

  it("spaces installments every N days and clamps the count to 1..60", () => {
    const list = buildInstallments({ count: 4, total: 100, firstDue: "2026-10-05", every: "days", days: 15 });
    expect(list.map((i) => i.due_date)).toEqual(["2026-10-05", "2026-10-20", "2026-11-04", "2026-11-19"]);
    expect(list.map((i) => i.amount)).toEqual([25, 25, 25, 25]);
    expect(buildInstallments({ count: 0, total: 50 })).toHaveLength(1);
    expect(buildInstallments({ count: 99, total: 50, firstDue: "2026-01-01" })).toHaveLength(60);
    // بلا تاريخ أول استحقاق تبقى التواريخ فارغة.
    expect(buildInstallments({ count: 2, total: 7 }).map((i) => i.due_date)).toEqual([null, null]);
    expect(buildInstallments({ count: 2, total: 7 }).map((i) => i.amount)).toEqual([3.5, 3.5]);
  });

  it("adds months while clamping to the end of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
    expect(addMonths("2026-03-01", -1)).toBe("2026-02-01");
    expect(addMonths("bad", 1)).toBeNull();
  });

  it("summarizes contracts: active count, money totals, overdue and due-soon installments", () => {
    const contracts = [
      contract({
        id: 1,
        agreed_amount: 15000,
        paid: 5000,
        installments: [
          inst(1, { due_date: "2026-09-30" }),
          inst(2, { due_date: "2026-10-10" }),
          inst(3, { due_date: "2026-10-12", invoice_id: 9, invoice_total: 5000, invoice_paid: 0 }),
          inst(4, { due_date: "2026-10-13" }),
        ],
      }),
      contract({ id: 2, status: "completed", agreed_amount: 4000, paid: 4000, installments: [inst(1, { due_date: "2026-01-01" })] }),
      contract({ id: 3, status: "cancelled", agreed_amount: 99999, paid: 0, installments: [inst(1, { due_date: "2026-01-01" })] }),
    ];
    const summary = summarizeContracts(contracts, TODAY);
    expect(summary).toMatchObject({
      active_count: 1,
      agreed_total: 19000,
      paid_total: 9000,
      remaining_total: 10000,
      overdue_installments: 1,
    });
    expect(summary.overdue.map((x) => [x.contract.id, x.installment.seq])).toEqual([[1, 1]]);
    expect(summary.due_soon.map((x) => x.installment.seq)).toEqual([2]);
    expect(summarizeContracts([], TODAY)).toMatchObject({ active_count: 0, agreed_total: 0, due_soon: [] });
    expect(summarizeContracts(undefined, TODAY).overdue_installments).toBe(0);
  });

  it("sums the agreed amounts contracted against a phase, ignoring cancelled contracts", () => {
    const contracts = [
      contract({ id: 1, phase_id: 4, agreed_amount: 15000 }),
      contract({ id: 2, phase_id: 4, status: "completed", agreed_amount: 2000.5 }),
      contract({ id: 3, phase_id: 4, status: "cancelled", agreed_amount: 70000 }),
      contract({ id: 4, phase_id: 5, agreed_amount: 100 }),
      contract({ id: 5, phase_id: null, agreed_amount: 42 }),
    ];
    expect(phaseContracted(4, contracts)).toBe(17000.5);
    expect(phaseContracted("4", contracts)).toBe(17000.5);
    expect(phaseContracted(5, contracts)).toBe(100);
    expect(phaseContracted(null, contracts)).toBe(42);
    expect(phaseContracted(9, contracts)).toBe(0);
    expect(phaseContracted(4, undefined)).toBe(0);
  });
});
