import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  requireAuth,
  signSessionToken,
  verifySessionToken,
} from "@/app/api/utils/sessionToken";

describe("signed API sessions", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-only-secret-with-enough-entropy";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("rejects tampered tokens", () => {
    const token = signSessionToken({ id: 7, role: "Admin" });
    expect(verifySessionToken(`${token}x`).ok).toBe(false);
  });

  it("enforces permissions", () => {
    const token = signSessionToken({
      id: 7,
      role: "Admin",
      can_manage_inventory: false,
    });
    const request = new Request("https://quarters.test/api/items", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(
      requireAuth(request, {
        role: "Admin",
        permission: "can_manage_inventory",
      }).status,
    ).toBe(403);
  });
});
