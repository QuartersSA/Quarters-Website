import sql from "@/app/api/utils/sql";
import { ensureEmployeeDisplayNameSchema } from "@/app/api/utils/employeeDisplayName";

let ensured = false;
let ensuring = null;

export async function ensureInventoryUnitSnapshotSchema() {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = doEnsureInventoryUnitSnapshotSchema();
  try {
    await ensuring;
    ensured = true;
  } finally {
    ensuring = null;
  }
}

async function doEnsureInventoryUnitSnapshotSchema() {
  await ensureEmployeeDisplayNameSchema();
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

  await sql`DROP VIEW IF EXISTS inventory_current_stock_v`;
  await sql`DROP VIEW IF EXISTS inventory_ledger_entries_v`;

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
    CREATE TABLE IF NOT EXISTS item_branch_disabled (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      disabled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      disabled_by_employee_id INTEGER,
      disabled_by_employee_name TEXT,
      PRIMARY KEY (item_id, branch_id)
    )
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

  await sql`
    CREATE TABLE IF NOT EXISTS waste_operations (
      id              SERIAL PRIMARY KEY,
      branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      branch_name     TEXT,
      employee_id     INTEGER,
      employee_name   TEXT,
      note            TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS waste_items (
      id            SERIAL PRIMARY KEY,
      operation_id  INTEGER NOT NULL REFERENCES waste_operations(id) ON DELETE CASCADE,
      item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      item_name     TEXT,
      quantity      NUMERIC(12, 3) NOT NULL,
      unit_cost     NUMERIC(14, 4),
      reason        TEXT,
      note          TEXT
    )
  `;

  await sql`
    ALTER TABLE waste_operations
      ADD COLUMN IF NOT EXISTS note TEXT
  `;

  await sql`
    ALTER TABLE waste_items
      ADD COLUMN IF NOT EXISTS reason TEXT,
      ADD COLUMN IF NOT EXISTS note TEXT
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
    CREATE OR REPLACE VIEW inventory_ledger_entries_v AS
    WITH current_unit AS (
      SELECT
        i.id AS item_id,
        mu.id AS current_unit_id,
        COALESCE(mu.name_ar, i.unit, 'حبة') AS current_unit_name,
        COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
    )
    SELECT
      ('inventory:' || ii.id)::text AS ledger_id,
      'inventory_items'::text AS source_table,
      ii.id::integer AS source_id,
      io.id::integer AS operation_id,
      ii.item_id::integer AS item_id,
      io.branch_id::integer AS branch_id,
      COALESCE(io.operation_date, io.created_at) AS occurred_at,
      io.inventory_number::text AS reference_number,
      io.inventory_type::text AS movement_type,
      CASE
        WHEN io.inventory_type IN ('Daily', 'Weekly', 'Opening') THEN true
        ELSE false
      END AS resets_stock,
      CASE
        WHEN io.inventory_type IN ('Daily', 'Weekly', 'Opening')
          THEN ii.quantity::numeric
        WHEN io.inventory_type = 'Transfer' AND io.transfer_direction = 'in'
          THEN COALESCE(ii.transfer_quantity, 0)::numeric
        WHEN io.inventory_type = 'Transfer' AND io.transfer_direction = 'out'
          THEN -COALESCE(ii.transfer_quantity, 0)::numeric
        ELSE 0::numeric
      END AS delta_quantity,
      CASE
        WHEN io.inventory_type IN ('Daily', 'Weekly', 'Opening')
          THEN ii.quantity::numeric
        WHEN io.inventory_type = 'Transfer'
          THEN COALESCE(ii.transfer_quantity, 0)::numeric
        ELSE ii.quantity::numeric
      END AS entered_quantity,
      ii.unit_id::integer AS unit_id,
      COALESCE(ii.unit_name, current_unit.current_unit_name) AS unit_name,
      COALESCE(ii.unit_factor, current_unit.current_factor, 1)::numeric AS unit_factor,
      io.employee_id::integer AS employee_id,
      COALESCE(NULLIF(e.display_name, ''), e.name)::text AS employee_name,
      io.status::text AS status,
      io.note::text AS note
    FROM inventory_items ii
    JOIN inventory_operations io ON io.id = ii.operation_id
    JOIN current_unit ON current_unit.item_id = ii.item_id
    LEFT JOIN employees e ON e.id = io.employee_id
    WHERE io.status = 'Completed'
      AND io.inventory_type IN ('Daily', 'Weekly', 'Opening', 'Transfer')

    UNION ALL

    SELECT
      ('receipt:' || pr.id)::text AS ledger_id,
      'purchase_receipts'::text AS source_table,
      pr.id::integer AS source_id,
      NULL::integer AS operation_id,
      pr.item_id::integer AS item_id,
      pr.branch_id::integer AS branch_id,
      GREATEST(pr.received_at, pr.created_at) AS occurred_at,
      pr.receipt_batch_id::text AS reference_number,
      'Receipt'::text AS movement_type,
      false AS resets_stock,
      pr.quantity::numeric AS delta_quantity,
      pr.quantity::numeric AS entered_quantity,
      pr.unit_id::integer AS unit_id,
      COALESCE(pr.unit_name, current_unit.current_unit_name) AS unit_name,
      COALESCE(pr.unit_factor, current_unit.current_factor, 1)::numeric AS unit_factor,
      pr.created_by_employee_id::integer AS employee_id,
      COALESCE(NULLIF(pe.display_name, ''), pr.created_by_employee_name, pe.name)::text AS employee_name,
      'Completed'::text AS status,
      pr.note::text AS note
    FROM purchase_receipts pr
    JOIN current_unit ON current_unit.item_id = pr.item_id
    LEFT JOIN employees pe ON pe.id = pr.created_by_employee_id

    UNION ALL

    SELECT
      ('waste:' || wi.id)::text AS ledger_id,
      'waste_items'::text AS source_table,
      wi.id::integer AS source_id,
      wo.id::integer AS operation_id,
      wi.item_id::integer AS item_id,
      wo.branch_id::integer AS branch_id,
      wo.created_at AS occurred_at,
      wo.id::text AS reference_number,
      'Waste'::text AS movement_type,
      false AS resets_stock,
      -wi.quantity::numeric AS delta_quantity,
      wi.quantity::numeric AS entered_quantity,
      NULL::integer AS unit_id,
      current_unit.current_unit_name AS unit_name,
      current_unit.current_factor::numeric AS unit_factor,
      wo.employee_id::integer AS employee_id,
      COALESCE(NULLIF(we.display_name, ''), wo.employee_name, we.name)::text AS employee_name,
      'Completed'::text AS status,
      COALESCE(wi.note, wo.note)::text AS note
    FROM waste_items wi
    JOIN waste_operations wo ON wo.id = wi.operation_id
    JOIN current_unit ON current_unit.item_id = wi.item_id
    LEFT JOIN employees we ON we.id = wo.employee_id
  `;

  await sql`
    CREATE OR REPLACE VIEW inventory_current_stock_v AS
    WITH current_unit AS (
      SELECT
        i.id AS item_id,
        COALESCE(mu.name_ar, i.unit, 'حبة') AS current_unit_name,
        COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
    ),
    last_reset AS (
      SELECT DISTINCT ON (le.item_id, le.branch_id)
        le.item_id,
        le.branch_id,
        le.operation_id,
        le.reference_number AS inventory_number,
        le.movement_type AS inventory_type,
        le.status AS operation_status,
        le.occurred_at AS operation_date,
        le.employee_name,
        le.entered_quantity AS inv_quantity,
        le.unit_name,
        le.unit_factor,
        le.source_id
      FROM inventory_ledger_entries_v le
      WHERE le.resets_stock = true
      ORDER BY
        le.item_id,
        le.branch_id,
        le.occurred_at DESC,
        le.operation_id DESC NULLS LAST,
        le.source_id DESC
    ),
    movement_after AS (
      SELECT
        le.item_id,
        le.branch_id,
        SUM(CASE WHEN le.movement_type = 'Receipt' THEN le.delta_quantity ELSE 0::numeric END)
          AS receipts_quantity,
        SUM(CASE WHEN le.movement_type = 'Transfer' THEN le.delta_quantity ELSE 0::numeric END)
          AS net_transfer_quantity,
        SUM(CASE WHEN le.movement_type = 'Waste' THEN le.delta_quantity ELSE 0::numeric END)
          AS waste_quantity,
        SUM(CASE WHEN le.resets_stock = false THEN le.delta_quantity ELSE 0::numeric END)
          AS net_movement_quantity
      FROM inventory_ledger_entries_v le
      LEFT JOIN last_reset lr
        ON lr.item_id = le.item_id AND lr.branch_id = le.branch_id
      WHERE le.resets_stock = false
        AND (
          lr.operation_date IS NULL
          OR le.occurred_at > lr.operation_date
        )
      GROUP BY le.item_id, le.branch_id
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
      COALESCE(last_reset.inv_quantity, 0) AS last_inventory_entered_quantity,
      last_reset.unit_name AS last_inventory_entered_unit,
      COALESCE(last_reset.unit_factor, current_unit.current_factor, 1)
        AS last_inventory_unit_factor,
      current_unit.current_unit_name AS current_display_unit,
      COALESCE(current_unit.current_factor, 1) AS current_display_unit_factor,
      (
        COALESCE(last_reset.inv_quantity, 0)
          + COALESCE(movement_after.net_movement_quantity, 0)
      ) * COALESCE(current_unit.current_factor, 1) AS current_base_quantity,
      (
        COALESCE(last_reset.inv_quantity, 0)
          + COALESCE(movement_after.net_movement_quantity, 0)
      ) AS current_display_quantity,
      (
        COALESCE(last_reset.inv_quantity, 0)
          + COALESCE(movement_after.net_movement_quantity, 0)
      ) AS current_quantity,
      COALESCE(last_reset.inv_quantity, 0) AS last_inventory_quantity,
      COALESCE(movement_after.receipts_quantity, 0) AS receipts_since_last_inventory,
      COALESCE(movement_after.net_transfer_quantity, 0) AS net_transfer_since_last_inventory,
      COALESCE(movement_after.waste_quantity, 0) AS waste_since_last_inventory,
      (
        last_reset.operation_date IS NOT NULL
        OR COALESCE(movement_after.net_movement_quantity, 0) <> 0
      ) AS has_signal
    FROM items i
    CROSS JOIN branches b
    JOIN current_unit ON current_unit.item_id = i.id
    LEFT JOIN last_reset
      ON last_reset.item_id = i.id AND last_reset.branch_id = b.id
    LEFT JOIN movement_after
      ON movement_after.item_id = i.id AND movement_after.branch_id = b.id
  `;
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
