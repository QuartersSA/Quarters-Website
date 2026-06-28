import sql from "@/app/api/utils/sql";

let ensured = false;

export async function ensureInventoryUnitSnapshotSchema() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS measurement_units (
      id          SERIAL PRIMARY KEY,
      name_ar     TEXT NOT NULL UNIQUE,
      name_en     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS item_units (
      id                SERIAL PRIMARY KEY,
      item_id           INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      unit_id           INTEGER NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
      conversion_factor NUMERIC(20, 8) NOT NULL CHECK (conversion_factor > 0),
      is_base           BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      UNIQUE(item_id, unit_id)
    )
  `;

  await sql`
    ALTER TABLE item_units
    ALTER COLUMN conversion_factor TYPE NUMERIC(20, 8)
    USING conversion_factor::numeric
  `;

  await sql`
    ALTER TABLE items
      ADD COLUMN IF NOT EXISTS default_purchase_unit_id  INTEGER REFERENCES item_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS default_inventory_unit_id INTEGER REFERENCES item_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS base_purchase_cost        NUMERIC(14, 2)
  `;

  await sql`
    ALTER TABLE inventory_items
      ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES measurement_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS unit_name TEXT,
      ADD COLUMN IF NOT EXISTS unit_factor NUMERIC(20, 8)
  `;

  await sql`
    ALTER TABLE purchase_receipts
      ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES measurement_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS unit_name TEXT,
      ADD COLUMN IF NOT EXISTS unit_factor NUMERIC(20, 8)
  `;

  await sql`
    ALTER TABLE opening_session_items
      ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES measurement_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS unit_name TEXT,
      ADD COLUMN IF NOT EXISTS unit_factor NUMERIC(20, 8)
  `;

  // Legacy rows had no explicit unit. Backfill with the item's current
  // inventory unit so existing displayed totals stay unchanged; future
  // unit changes then have a real snapshot to convert from.
  await sql`
    UPDATE inventory_items ii
       SET unit_id = COALESCE(ii.unit_id, mu.id),
           unit_name = COALESCE(ii.unit_name, mu.name_ar, i.unit),
           unit_factor = COALESCE(ii.unit_factor, iu.conversion_factor, 1)
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
     WHERE ii.item_id = i.id
       AND (ii.unit_factor IS NULL OR ii.unit_name IS NULL)
  `;

  await sql`
    UPDATE purchase_receipts pr
       SET unit_id = COALESCE(pr.unit_id, mu.id),
           unit_name = COALESCE(pr.unit_name, mu.name_ar, i.unit),
           unit_factor = COALESCE(pr.unit_factor, iu.conversion_factor, 1)
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
     WHERE pr.item_id = i.id
       AND (pr.unit_factor IS NULL OR pr.unit_name IS NULL)
  `;

  await sql`
    UPDATE opening_session_items osi
       SET unit_id = COALESCE(osi.unit_id, mu.id),
           unit_name = COALESCE(osi.unit_name, mu.name_ar, i.unit),
           unit_factor = COALESCE(osi.unit_factor, iu.conversion_factor, 1)
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
     WHERE osi.item_id = i.id
       AND (osi.unit_factor IS NULL OR osi.unit_name IS NULL)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS inventory_items_item_branch_op_idx
      ON inventory_items (item_id, branch_id, operation_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS inventory_operations_chain_idx
      ON inventory_operations (
        status,
        inventory_type,
        branch_id,
        (COALESCE(operation_date, created_at)),
        id
      )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS purchase_receipts_item_branch_effective_idx
      ON purchase_receipts (
        item_id,
        branch_id,
        (GREATEST(received_at, created_at))
      )
  `;

  await sql`
    CREATE OR REPLACE VIEW inventory_current_stock_v AS
    WITH item_factor AS (
      SELECT
        i.id AS item_id,
        COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
    ),
    last_reset AS (
      SELECT DISTINCT ON (ii.item_id, io.branch_id)
        ii.item_id,
        io.branch_id,
        io.id AS operation_id,
        io.inventory_number,
        io.inventory_type,
        io.status AS operation_status,
        COALESCE(io.operation_date, io.created_at) AS operation_date,
        e.name AS employee_name,
        ii.quantity::numeric AS inv_quantity,
        COALESCE(ii.unit_factor, item_factor.current_factor, 1)::numeric AS unit_factor
      FROM inventory_items ii
      JOIN inventory_operations io ON io.id = ii.operation_id
      JOIN item_factor ON item_factor.item_id = ii.item_id
      LEFT JOIN employees e ON e.id = io.employee_id
      WHERE io.status = 'Completed'
        AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
      ORDER BY
        ii.item_id,
        io.branch_id,
        COALESCE(io.operation_date, io.created_at) DESC,
        io.id DESC
    ),
    receipts_after AS (
      SELECT
        pr.item_id,
        pr.branch_id,
        SUM(
          pr.quantity::numeric
            * COALESCE(pr.unit_factor, item_factor.current_factor, 1)::numeric
        ) AS total_received_base
      FROM purchase_receipts pr
      JOIN item_factor ON item_factor.item_id = pr.item_id
      LEFT JOIN last_reset li
        ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
      WHERE (
        li.operation_date IS NULL
        OR GREATEST(pr.received_at, pr.created_at) > li.operation_date
      )
      GROUP BY pr.item_id, pr.branch_id
    ),
    transfers_after AS (
      SELECT
        ii.item_id,
        ii.branch_id,
        SUM(
          CASE io.transfer_direction
            WHEN 'in' THEN COALESCE(ii.transfer_quantity, 0)::numeric
            WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)::numeric
            ELSE 0::numeric
          END
          * COALESCE(ii.unit_factor, item_factor.current_factor, 1)::numeric
        ) AS net_transfer_base
      FROM inventory_items ii
      JOIN inventory_operations io ON io.id = ii.operation_id
      JOIN item_factor ON item_factor.item_id = ii.item_id
      LEFT JOIN last_reset li
        ON li.item_id = ii.item_id AND li.branch_id = ii.branch_id
      WHERE io.status = 'Completed'
        AND io.inventory_type = 'Transfer'
        AND (
          li.operation_date IS NULL
          OR COALESCE(io.operation_date, io.created_at) > li.operation_date
        )
      GROUP BY ii.item_id, ii.branch_id
    )
    SELECT
      i.id AS item_id,
      b.id AS branch_id,
      last_reset.operation_id,
      last_reset.inventory_number,
      last_reset.inventory_type,
      last_reset.operation_status,
      last_reset.operation_date,
      last_reset.employee_name,
      (
        (
          COALESCE(last_reset.inv_quantity, 0)
            * COALESCE(last_reset.unit_factor, item_factor.current_factor, 1)
        )
        + COALESCE(receipts_after.total_received_base, 0)
        + COALESCE(transfers_after.net_transfer_base, 0)
      ) / NULLIF(item_factor.current_factor, 0) AS current_quantity,
      (
        COALESCE(last_reset.inv_quantity, 0)
          * COALESCE(last_reset.unit_factor, item_factor.current_factor, 1)
      ) / NULLIF(item_factor.current_factor, 0) AS last_inventory_quantity,
      COALESCE(receipts_after.total_received_base, 0)
        / NULLIF(item_factor.current_factor, 0) AS receipts_since_last_inventory,
      COALESCE(transfers_after.net_transfer_base, 0)
        / NULLIF(item_factor.current_factor, 0) AS net_transfer_since_last_inventory,
      (
        last_reset.operation_date IS NOT NULL
        OR COALESCE(receipts_after.total_received_base, 0) <> 0
        OR COALESCE(transfers_after.net_transfer_base, 0) <> 0
      ) AS has_signal
    FROM items i
    CROSS JOIN branches b
    JOIN item_factor ON item_factor.item_id = i.id
    LEFT JOIN last_reset
      ON last_reset.item_id = i.id AND last_reset.branch_id = b.id
    LEFT JOIN receipts_after
      ON receipts_after.item_id = i.id AND receipts_after.branch_id = b.id
    LEFT JOIN transfers_after
      ON transfers_after.item_id = i.id AND transfers_after.branch_id = b.id
  `;

  ensured = true;
}

export async function getDefaultInventoryUnitSnapshots(itemIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(itemIds) ? itemIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  if (ids.length === 0) return new Map();

  const rows = await sql(
    `
      SELECT
        i.id AS item_id,
        mu.id AS unit_id,
        COALESCE(mu.name_ar, i.unit, 'حبة') AS unit_name,
        COALESCE(iu.conversion_factor, 1)::numeric AS unit_factor
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
      WHERE i.id = ANY($1::int[])
    `,
    [ids],
  );

  return new Map(
    rows.map((row) => [
      Number(row.item_id),
      {
        unitId: row.unit_id == null ? null : Number(row.unit_id),
        unitName: row.unit_name || "حبة",
        unitFactor: Number(row.unit_factor) || 1,
      },
    ]),
  );
}

export function snapshotForItem(snapshots, itemId) {
  return snapshots.get(Number(itemId)) || {
    unitId: null,
    unitName: "حبة",
    unitFactor: 1,
  };
}
