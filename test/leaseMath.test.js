import { describe, expect, it } from "vitest";
import {
  addMonths,
  contractStatus,
  generateSchedule,
  installmentAmounts,
  installmentWithFixed,
  splitFixedCharges,
  monthDiff,
  reserveForPayment,
  suggestedReserve,
} from "@/utils/leaseMath";

describe("lease math — installment amounts", () => {
  it("splits a VAT-inclusive figure so excl + vat equals the printed total", () => {
    const money = installmentAmounts({ amount: 60000, vatRate: 15, amountIncludesVat: true });
    expect(money).toEqual({ amount_excl: 52173.91, vat_rate: 15, vat_amount: 7826.09, amount_incl: 60000 });
    const ten = installmentAmounts({ amount: 10000, vatRate: 15, amountIncludesVat: true });
    expect(ten.amount_incl).toBe(10000);
    expect(ten.amount_excl + ten.vat_amount).toBeCloseTo(ten.amount_incl, 2);
  });

  it("keeps a VAT-exclusive figure as ground truth", () => {
    expect(installmentAmounts({ amount: 60000, vatRate: 15 })).toEqual({
      amount_excl: 60000,
      vat_rate: 15,
      vat_amount: 9000,
      amount_incl: 69000,
    });
  });

  it("always sums excl + vat to incl (invoice line parity)", () => {
    for (const amount of [100.01, 1234.56, 999.99, 33.33, 1, 0.05]) {
      for (const includes of [true, false]) {
        const m = installmentAmounts({ amount, vatRate: 15, amountIncludesVat: includes });
        expect(Math.round((m.amount_excl + m.vat_amount) * 100) / 100).toBe(m.amount_incl);
        expect(Math.round(m.amount_excl * 0.15 * 100) / 100).toBe(m.vat_amount);
      }
    }
  });
});

describe("lease math — dates", () => {
  it("clamps the day when adding months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-01", 6)).toBe("2027-04-01");
    expect(addMonths("2026-11-15", 14)).toBe("2028-01-15");
  });

  it("computes month differences across years", () => {
    expect(monthDiff("2026-10", "2027-04")).toBe(6);
    expect(monthDiff("2027-04", "2026-10")).toBe(-6);
  });
});

describe("lease math — schedule", () => {
  it("generates semi-annual installments for a two-year contract", () => {
    const rows = generateSchedule({
      startDate: "2026-10-01",
      endDate: "2028-09-30",
      frequency: "semi_annual",
      amount: 60000,
      vatRate: 15,
    });
    expect(rows.map((r) => r.due_date)).toEqual([
      "2026-10-01",
      "2027-04-01",
      "2027-10-01",
      "2028-04-01",
    ]);
    expect(rows[0].period_end).toBe("2027-03-31");
    expect(rows[3].period_end).toBe("2028-09-30");
    expect(rows.every((r) => r.amount_incl === 69000)).toBe(true);
    expect(rows.reduce((s, r) => s + r.amount_incl, 0)).toBe(276000);
  });

  it("returns nothing for invalid input", () => {
    expect(generateSchedule({ startDate: "x", endDate: "2027-01-01", frequency: "monthly", amount: 1 })).toEqual([]);
    expect(generateSchedule({ startDate: "2027-01-01", endDate: "2026-01-01", frequency: "monthly", amount: 1 })).toEqual([]);
    expect(generateSchedule({ startDate: "2026-01-01", endDate: "2027-01-01", frequency: "custom", amount: 1 })).toEqual([]);
  });
});

describe("lease math — monthly reserve", () => {
  it("spreads a payment over the months before its due month", () => {
    // 69,000 due 2027-04-01, previous due 2026-10-01 → window Oct..Mar = 6 months.
    const nov = reserveForPayment({ amountIncl: 69000, dueDate: "2027-04-01", reserveStart: "2026-10-01", asOfMonth: "2026-11" });
    expect(nov.months_total).toBe(6);
    expect(nov.monthly_reserve).toBe(11500);
    expect(nov.this_month_share).toBe(11500);
    expect(nov.months_elapsed).toBe(2);
    expect(nov.reserved_to_date).toBe(23000);
    expect(nov.remaining).toBe(46000);
    expect(nov.overdue).toBe(false);
  });

  it("carries the rounding remainder in the last window month", () => {
    const last = reserveForPayment({ amountIncl: 1000, dueDate: "2027-01-10", reserveStart: "2026-10-01", asOfMonth: "2026-12" });
    expect(last.months_total).toBe(3);
    expect(last.monthly_reserve).toBe(333.33);
    expect(last.this_month_share).toBe(333.34);
    expect(last.reserved_to_date).toBe(1000);
    expect(last.remaining).toBe(0);
  });

  it("contributes nothing before the window and marks overdue after the due month", () => {
    const before = reserveForPayment({ amountIncl: 69000, dueDate: "2027-04-01", reserveStart: "2026-10-01", asOfMonth: "2026-08" });
    expect(before.this_month_share).toBe(0);
    expect(before.months_elapsed).toBe(0);
    const after = reserveForPayment({ amountIncl: 69000, dueDate: "2027-04-01", reserveStart: "2026-10-01", asOfMonth: "2027-05" });
    expect(after.overdue).toBe(true);
    expect(after.reserved_to_date).toBe(69000);
    const due = reserveForPayment({ amountIncl: 69000, dueDate: "2027-04-01", reserveStart: "2026-10-01", asOfMonth: "2027-04" });
    expect(due.due_this_month).toBe(true);
    expect(due.this_month_share).toBe(0);
  });

  it("uses a single-month window when the payment is due in the start month", () => {
    const same = reserveForPayment({ amountIncl: 5000, dueDate: "2026-10-20", reserveStart: "2026-10-01", asOfMonth: "2026-10" });
    expect(same.months_total).toBe(1);
    expect(same.this_month_share).toBe(5000);
  });
});

describe("lease math — contract status", () => {
  const base = { startDate: "2026-10-01", endDate: "2028-09-30", noticePeriodDays: 90 };
  it("derives lifecycle from dates", () => {
    expect(contractStatus({ ...base, status: "active", today: "2026-09-01" })).toBe("upcoming");
    expect(contractStatus({ ...base, status: "active", today: "2027-01-01" })).toBe("active");
    expect(contractStatus({ ...base, status: "active", today: "2028-07-15" })).toBe("notice");
    expect(contractStatus({ ...base, status: "active", today: "2028-10-01" })).toBe("ended");
    expect(contractStatus({ ...base, status: "terminated", today: "2027-01-01" })).toBe("terminated");
  });
});

describe("lease math — self-correcting suggestion", () => {
  const base = { amountIncl: 69000, dueDate: "2027-04-01", reserveStart: "2026-10-01" };
  it("splits the outstanding amount over the months left before the due month", () => {
    expect(suggestedReserve({ ...base, asOfMonth: "2026-10", reservedBefore: 0 })).toEqual({ suggested: 11500, months_left: 6 });
    // a skipped month raises the suggestion automatically
    expect(suggestedReserve({ ...base, asOfMonth: "2026-12", reservedBefore: 11500 })).toEqual({ suggested: 14375, months_left: 4 });
    // ahead of plan lowers it
    expect(suggestedReserve({ ...base, asOfMonth: "2026-12", reservedBefore: 40000 }).suggested).toBe(7250);
  });
  it("suggests the whole outstanding amount in or after the due month, and nothing before the window", () => {
    expect(suggestedReserve({ ...base, asOfMonth: "2027-04", reservedBefore: 57500 }).suggested).toBe(11500);
    expect(suggestedReserve({ ...base, asOfMonth: "2027-06", reservedBefore: 0 }).suggested).toBe(69000);
    expect(suggestedReserve({ ...base, asOfMonth: "2026-08", reservedBefore: 0 }).suggested).toBe(0);
    expect(suggestedReserve({ ...base, asOfMonth: "2027-03", reservedBefore: 69000 }).suggested).toBe(0);
  });
});

describe("lease math — fixed charges", () => {
  it("adds VAT-exempt fixed charges after tax so the row matches the Ejar table", () => {
    // عقد: أجرة 30,000 + ضريبة 4,500 + مبالغ ثابتة 1,600 = 36,100
    const rows = generateSchedule({
      startDate: "2026-08-01",
      endDate: "2028-07-31",
      frequency: "quarterly",
      amount: 30000,
      fixedAmount: 1600,
      vatRate: 15,
      firstDueDate: "2026-08-11",
    });
    expect(rows).toHaveLength(8);
    expect(rows[0].rent_excl).toBe(30000);
    expect(rows[0].fixed_excl).toBe(1600);
    expect(rows[0].fixed_exempt_excl).toBe(1600);
    expect(rows[0].amount_excl).toBe(31600);
    expect(rows[0].vat_amount).toBe(4500);
    expect(rows[0].amount_incl).toBe(36100);
  });
  it("taxes fixed charges only when flagged taxable", () => {
    const money = installmentWithFixed({ amount: 30000, fixedTaxableAmount: 1600, vatRate: 15 });
    expect(money.vat_amount).toBe(4740);
    expect(money.amount_incl).toBe(36340);
    expect(splitFixedCharges([{ amount: 1600 }, { amount: 400, taxable: true }])).toEqual({ exempt: 1600, taxable: 400, total: 2000 });
  });
  it("unpacks a VAT-inclusive rent before adding fixed charges", () => {
    const money = installmentWithFixed({ amount: 69000, fixedAmount: 1000, vatRate: 15, amountIncludesVat: true });
    expect(money.rent_excl).toBe(60000);
    expect(money.amount_excl).toBe(61000);
    expect(money.amount_incl).toBe(70000);
  });
});
