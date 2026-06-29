import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import '@neondatabase/serverless';
import 'crypto';

function safeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
function safeNumericString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}
function normalizeIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}
function normalizeMonthStart(value) {
  const raw = value ? String(value).trim() : "";
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  return `${raw}-01`;
}
async function PUT(request, {
  params: {
    id
  }
}) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_accounting"
    }, {
      role: "Admin",
      permission: "can_access_hr"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  const bonusId = safeNumber(id);
  if (!bonusId) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    await ensureEmployeeDisplayNameSchema();
    const body = await request.json();
    const employeeId = body.employee_id ?? body.employeeId;

    // month-only update support
    const monthRaw = body?.month ?? body?.payroll_month ?? body?.payrollMonth;
    const bonusDate = body.bonus_date !== undefined || body.bonusDate !== undefined ? normalizeIsoDate(body.bonus_date ?? body.bonusDate) : monthRaw ? normalizeMonthStart(monthRaw) : undefined;
    const category = body.bonus_category ?? body.bonusCategory;
    const reason = body.reason;
    const amountModeRaw = body.amount_mode ?? body.amountMode;
    const requestedMode = amountModeRaw === undefined ? undefined : amountModeRaw ? String(amountModeRaw) : null;
    const amountFixedStr = safeNumericString(body.amount);
    const amountPercentStr = safeNumericString(body.amount_percent ?? body.amountPercent);
    const imageUrl = body.image_url ?? body.imageUrl;
    const imageMimeType = body.image_mime_type ?? body.imageMimeType;
    const imageName = body.image_name ?? body.imageName;
    const imageSizeBytes = body.image_size_bytes ?? body.imageSizeBytes ?? body.imageSize;

    // IMPORTANT: source is fixed, do not allow updates

    const sets = [];
    const values = [];
    let resolvedEmployeeId = null;
    if (employeeId !== undefined) {
      const n = safeNumber(employeeId);
      if (!n) {
        return Response.json({
          error: "Invalid employee_id"
        }, {
          status: 400
        });
      }
      resolvedEmployeeId = n;
      values.push(n);
      sets.push(`employee_id = $${values.length}`);
    }
    if (bonusDate !== undefined) {
      if (bonusDate === null) {
        return Response.json({
          error: "Invalid bonus_date/month"
        }, {
          status: 400
        });
      }
      values.push(bonusDate);
      sets.push(`bonus_date = $${values.length}`);
    }
    if (category !== undefined) {
      values.push(category ? String(category) : null);
      sets.push(`bonus_category = $${values.length}`);
    }
    if (reason !== undefined) {
      values.push(reason ? String(reason) : null);
      sets.push(`reason = $${values.length}`);
    }

    // amount: fixed or percent
    const wantsPercent = requestedMode === "percent" || requestedMode !== "fixed" && amountPercentStr !== null;
    const wantsFixed = requestedMode === "fixed" || requestedMode !== "percent" && amountFixedStr !== null;
    if (wantsPercent && wantsFixed) {
      return Response.json({
        error: "Provide either amount OR amount_percent (not both)"
      }, {
        status: 400
      });
    }
    if (wantsFixed) {
      const n = amountFixedStr === null ? null : Number(amountFixedStr);
      if (n === null || !Number.isFinite(n) || n < 0) {
        return Response.json({
          error: "Invalid amount"
        }, {
          status: 400
        });
      }
      values.push(amountFixedStr);
      sets.push(`amount = $${values.length}`);
      values.push("fixed");
      sets.push(`amount_mode = $${values.length}`);
      values.push(null);
      sets.push(`amount_percent = $${values.length}`);
    } else if (wantsPercent) {
      const p = amountPercentStr === null ? null : Number(amountPercentStr);
      if (p === null || !Number.isFinite(p) || p < 0) {
        return Response.json({
          error: "Invalid amount_percent"
        }, {
          status: 400
        });
      }

      // Need employee id to compute salary
      if (!resolvedEmployeeId) {
        const [current] = await sql(`SELECT employee_id FROM hr_employee_bonuses WHERE id = $1`, [bonusId]);
        resolvedEmployeeId = current?.employee_id ? Number(current.employee_id) : null;
      }
      if (!resolvedEmployeeId) {
        return Response.json({
          error: "Missing employee_id for percent calculation"
        }, {
          status: 400
        });
      }
      const [calc] = await sql(`
          SELECT ROUND(
            (COALESCE(base_salary, 0) + COALESCE(other_allowances, 0))
            * $2::numeric / 100,
            2
          ) AS amount
          FROM employees
          WHERE id = $1
        `, [resolvedEmployeeId, amountPercentStr]);
      const computedAmount = calc?.amount ?? 0;
      values.push(computedAmount);
      sets.push(`amount = $${values.length}`);
      values.push("percent");
      sets.push(`amount_mode = $${values.length}`);
      values.push(amountPercentStr);
      sets.push(`amount_percent = $${values.length}`);
    } else if (requestedMode !== undefined) {
      // mode was provided but no values
      if (requestedMode === "percent") {
        return Response.json({
          error: "amount_percent is required when amount_mode=percent"
        }, {
          status: 400
        });
      }
      if (requestedMode === "fixed") {
        return Response.json({
          error: "amount is required when amount_mode=fixed"
        }, {
          status: 400
        });
      }
    }
    if (imageUrl !== undefined) {
      values.push(imageUrl ? String(imageUrl) : null);
      sets.push(`image_url = $${values.length}`);
    }
    if (imageMimeType !== undefined) {
      values.push(imageMimeType ? String(imageMimeType) : null);
      sets.push(`image_mime_type = $${values.length}`);
    }
    if (imageName !== undefined) {
      values.push(imageName ? String(imageName) : null);
      sets.push(`image_name = $${values.length}`);
    }
    if (imageSizeBytes !== undefined) {
      const n = imageSizeBytes === "" ? null : safeNumber(imageSizeBytes);
      values.push(n);
      sets.push(`image_size_bytes = $${values.length}`);
    }
    if (sets.length === 0) {
      return Response.json({
        error: "No fields provided"
      }, {
        status: 400
      });
    }
    values.push(bonusId);
    const updateSql = `
      UPDATE hr_employee_bonuses
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id
    `;
    const [updated] = await sql(updateSql, values);
    if (!updated?.id) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    const [row] = await sql`
      SELECT
        b.id,
        b.employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
        b.bonus_date,
        b.bonus_category,
        b.reason,

        CASE
          WHEN b.amount_mode = 'percent' AND b.amount_percent IS NOT NULL THEN
            ROUND(
              (COALESCE(e.base_salary, 0) + COALESCE(e.other_allowances, 0))
              * b.amount_percent::numeric / 100,
              2
            )
          ELSE b.amount
        END AS amount,

        b.amount_mode,
        b.amount_percent,
        b.source,
        b.created_by_employee_id,
        b.created_by_employee_name,
        b.created_at,
        b.image_url,
        b.image_mime_type,
        b.image_name,
        b.image_size_bytes
      FROM hr_employee_bonuses b
      JOIN employees e ON e.id = b.employee_id
      WHERE b.id = ${bonusId}
    `;
    return Response.json(row);
  } catch (error) {
    console.error("HR: Error updating bonus:", error);
    return Response.json({
      error: "Failed to update bonus",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request, {
  params: {
    id
  }
}) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_accounting"
    }, {
      role: "Admin",
      permission: "can_access_hr"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  const bonusId = safeNumber(id);
  if (!bonusId) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const [deleted] = await sql`
      DELETE FROM hr_employee_bonuses
      WHERE id = ${bonusId}
      RETURNING id
    `;
    if (!deleted?.id) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("HR: Error deleting bonus:", error);
    return Response.json({
      error: "Failed to delete bonus"
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
