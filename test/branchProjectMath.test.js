import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE_TEMPLATE,
  ESTABLISHMENT_ACCOUNTS,
  addDays,
  barPosition,
  buildPhasesFromTemplate,
  daysBetween,
  daysToOpening,
  formatDateKey,
  invoiceStatus,
  nextProjectCode,
  phaseBudget,
  phaseHealth,
  phaseProgress,
  phaseTasks,
  projectBudget,
  projectHealth,
  projectProgress,
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
