import { describe, expect, it } from "vitest";
import {
  calculateStockValue,
  costPerInventoryUnit,
  roundStockQuantity,
  sumStockQuantities,
} from "@/utils/inventoryMath";

describe("inventory math", () => {
  it("preserves fractional quantities when summing branches", () => {
    expect(
      sumStockQuantities([{ quantity: "10.25" }, { quantity: "2.125" }]),
    ).toBe(12.375);
  });

  it("rounds stock to the database precision", () => {
    expect(roundStockQuantity(1.23456)).toBe(1.235);
  });

  it("calculates cost and value in the selected inventory unit", () => {
    expect(costPerInventoryUnit(185.8, 0.05)).toBeCloseTo(9.29);
    expect(calculateStockValue(519, 185.8, 0.05)).toBeCloseTo(4821.51);
  });

  it("rejects invalid conversion factors", () => {
    expect(costPerInventoryUnit(10, 0)).toBeNull();
    expect(calculateStockValue(10, 10, -1)).toBeNull();
  });
});
