import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureEmployeeDisplayNameSchema } from "@/app/api/utils/employeeDisplayName";

function safeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

let deductionImagesColumnEnsured = false;
async function ensureDeductionImagesColumn() {
  if (deductionImagesColumnEnsured) return;
  try {
    await sql`ALTER TABLE hr_employee_deductions ADD COLUMN IF NOT EXISTS images JSONB`;
    deductionImagesColumnEnsured = true;
  } catch (e) {
    console.error("ensureDeductionImagesColumn failed", e);
  }
}

function normalizeImagesArray(raw) {
  if (!Array.isArray(raw)) return null;
  const arr = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const url = item.url ?? item.image_url ?? null;
      if (!url) return null;
      const mimeType = item.mimeType ?? item.image_mime_type ?? null;
      const name = item.name ?? item.image_name ?? null;
      const sizeBytes =
        item.sizeBytes ?? item.size_bytes ?? item.image_size_bytes ?? null;
      const sizeNum =
        sizeBytes === null || sizeBytes === undefined || sizeBytes === ""
          ? null
          : safeNumber(sizeBytes);
      return {
        url: String(url),
        mimeType: mimeType ? String(mimeType) : null,
        name: name ? String(name) : null,
        sizeBytes: sizeNum,
      };
    })
    .filter(Boolean);
  return arr;
}

function decorateRowImages(row) {
  if (!row) return row;
  let images = Array.isArray(row.images) ? row.images : null;
  if (!images && row.images && typeof row.images === "string") {
    try {
      const parsed = JSON.parse(row.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      // ignore
    }
  }
  if ((!images || images.length === 0) && row.image_url) {
    images = [
      {
        url: row.image_url,
        mimeType: row.image_mime_type || null,
        name: row.image_name || null,
        sizeBytes:
          row.image_size_bytes === null || row.image_size_bytes === undefined
            ? null
            : Number(row.image_size_bytes),
      },
    ];
  }
  return { ...row, images: images || [] };
}

export async function PUT(request, { params: { id } }) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_access_hr" },
      { role: "Admin", permission: "can_manage_deductions" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const deductionId = safeNumber(id);
  if (!deductionId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await ensureEmployeeDisplayNameSchema();
    const body = await request.json();

    const employeeId = body.employee_id ?? body.employeeId;
    const violationDate = body.violation_date ?? body.violationDate;
    const category = body.violation_category ?? body.violationCategory;
    const reason = body.reason;
    const amount = body.amount;

    const imagesProvided =
      body.images !== undefined || body.imageList !== undefined;
    const imagesArray = imagesProvided
      ? normalizeImagesArray(body.images ?? body.imageList) || []
      : null;

    const imageUrl = body.image_url ?? body.imageUrl;
    const imageMimeType = body.image_mime_type ?? body.imageMimeType;
    const imageName = body.image_name ?? body.imageName;
    const imageSizeBytes =
      body.image_size_bytes ?? body.imageSizeBytes ?? body.imageSize;

    // IMPORTANT: source is fixed, do not allow updates

    await ensureDeductionImagesColumn();

    const sets = [];
    const values = [];

    if (employeeId !== undefined) {
      const n = safeNumber(employeeId);
      if (!n) {
        return Response.json({ error: "Invalid employee_id" }, { status: 400 });
      }
      values.push(n);
      sets.push(`employee_id = $${values.length}`);
    }

    if (violationDate !== undefined) {
      const d = normalizeIsoDate(violationDate);
      if (!d) {
        return Response.json(
          { error: "Invalid violation_date" },
          { status: 400 },
        );
      }
      values.push(d);
      sets.push(`violation_date = $${values.length}`);
    }

    if (category !== undefined) {
      values.push(category ? String(category) : null);
      sets.push(`violation_category = $${values.length}`);
    }

    if (reason !== undefined) {
      values.push(reason ? String(reason) : null);
      sets.push(`reason = $${values.length}`);
    }

    if (amount !== undefined) {
      const n = safeNumber(amount);
      if (n === null || n < 0) {
        return Response.json({ error: "Invalid amount" }, { status: 400 });
      }
      values.push(n);
      sets.push(`amount = $${values.length}`);
    }

    // If `images` array provided, it's the source of truth. Sync the
    // legacy single-image columns to the first entry for backward compat.
    if (imagesProvided) {
      const first = imagesArray[0] || null;
      values.push(first?.url ?? null);
      sets.push(`image_url = $${values.length}`);
      values.push(first?.mimeType ?? null);
      sets.push(`image_mime_type = $${values.length}`);
      values.push(first?.name ?? null);
      sets.push(`image_name = $${values.length}`);
      values.push(
        first?.sizeBytes === null || first?.sizeBytes === undefined
          ? null
          : Number(first.sizeBytes),
      );
      sets.push(`image_size_bytes = $${values.length}`);
      values.push(imagesArray.length > 0 ? JSON.stringify(imagesArray) : null);
      sets.push(`images = $${values.length}::jsonb`);
    } else {
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
    }

    if (sets.length === 0) {
      return Response.json({ error: "No fields provided" }, { status: 400 });
    }

    values.push(deductionId);

    const updateSql = `
      UPDATE hr_employee_deductions
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id
    `;

    const [updated] = await sql(updateSql, values);

    if (!updated?.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const [row] = await sql`
      SELECT
        d.id,
        d.employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
        d.violation_date,
        d.violation_category,
        d.reason,
        d.amount,
        d.source,
        d.created_by_employee_id,
        d.created_by_employee_name,
        d.created_at,
        d.image_url,
        d.image_mime_type,
        d.image_name,
        d.image_size_bytes,
        d.images
      FROM hr_employee_deductions d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.id = ${deductionId}
    `;

    return Response.json(decorateRowImages(row));
  } catch (error) {
    console.error("HR: Error updating deduction:", error);
    return Response.json(
      { error: "Failed to update deduction", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_access_hr" },
      { role: "Admin", permission: "can_manage_deductions" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const deductionId = safeNumber(id);
  if (!deductionId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [deleted] = await sql`
      DELETE FROM hr_employee_deductions
      WHERE id = ${deductionId}
      RETURNING id
    `;

    if (!deleted?.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("HR: Error deleting deduction:", error);
    return Response.json(
      { error: "Failed to delete deduction" },
      { status: 500 },
    );
  }
}
