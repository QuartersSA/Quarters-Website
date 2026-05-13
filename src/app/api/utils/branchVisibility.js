import sql from "@/app/api/utils/sql";

// Helpers around the `item_branch_disabled` sparse table — used by
// every write endpoint that mutates inventory to refuse operations on
// (item, branch) pairs the admin has marked as disabled. The shared
// helper guarantees the validation message is identical across:
//   - /api/inventory-operations  POST / PUT
//   - /api/inventory-transfers   POST
//   - /api/opening-sessions      POST
//   - /api/purchase-receipts     POST / PUT
//   - /api/accounting/green-bean-orders/[id]/deposit
//
// Default behaviour of the table is "no row = enabled at every
// branch", so a fresh database with no disabled rows treats everything
// as enabled — these helpers are no-op until an admin uses the modal.

/**
 * Returns the subset of `itemIds` that are disabled at the given branch.
 * Empty array means everything passes.
 */
export async function findDisabledItemsAtBranch(branchId, itemIds) {
  const bid = Number(branchId);
  if (!Number.isFinite(bid) || bid <= 0) return [];
  if (!Array.isArray(itemIds) || itemIds.length === 0) return [];

  const normalised = itemIds
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  if (normalised.length === 0) return [];

  const rows = await sql(
    `SELECT item_id
       FROM item_branch_disabled
      WHERE branch_id = $1
        AND item_id   = ANY($2::int[])`,
    [bid, normalised],
  );
  return rows.map((r) => Number(r.item_id));
}

/**
 * Convenience wrapper: throws a Response-like rejection if any of the
 * provided item ids are disabled at the branch.
 * Returns null on success or { status, body } on failure so the caller
 * can pass it straight to `Response.json(body, { status })`.
 *
 * `lookupName(id)` is optional — when supplied, the error message
 * lists the offending item names (helpful for the admin); otherwise
 * the API just returns the ids.
 */
export async function assertItemsEnabledAtBranch(
  branchId,
  itemIds,
  lookupName,
) {
  const disabled = await findDisabledItemsAtBranch(branchId, itemIds);
  if (disabled.length === 0) return null;

  const namesOrIds = disabled.map((id) => {
    if (typeof lookupName === "function") {
      const n = lookupName(id);
      return n ? `${n}` : `#${id}`;
    }
    return `#${id}`;
  });

  return {
    status: 400,
    body: {
      error:
        "بعض الأصناف معطّلة في هذا الفرع. أعد تفعيلها من إدارة الفروع قبل المتابعة.",
      disabled_items: disabled,
      disabled_item_labels: namesOrIds,
    },
  };
}
