import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

const VAT_MULTIPLIER = 1.15;
function cleanText(value) {
  const t = value === null || value === undefined ? "" : String(value);
  const trimmed = t.trim();
  return trimmed;
}
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
function toDateOnly(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  // basic YYYY-MM-DD check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}
function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function validateNonNegative(n, label) {
  if (n === null || n === undefined) {
    return {
      ok: false,
      error: `${label} مطلوب`
    };
  }
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return {
      ok: false,
      error: `قيمة غير صحيحة: ${label}`
    };
  }
  if (n < 0) {
    return {
      ok: false,
      error: `${label} يجب أن يكون 0 أو أكثر`
    };
  }
  return {
    ok: true
  };
}
function round4(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 10000) / 10000;
}
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}
async function fetchBeansByIds(beanIds) {
  if (!Array.isArray(beanIds) || beanIds.length === 0) return [];
  const rows = await sql(`
      SELECT id, name
      FROM accounting_green_beans
      WHERE id = ANY($1::bigint[])
    `, [beanIds]);
  return rows || [];
}

// GET /api/accounting/green-bean-orders
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const {
      searchParams
    } = new URL(request.url);
    const includeItems = String(searchParams.get("includeItems") || "") === "1";
    const from = toDateOnly(searchParams.get("from"));
    const to = toDateOnly(searchParams.get("to"));
    const rawLimit = toInt(searchParams.get("limit"));
    const limit = clampInt(rawLimit ?? 200, 1, 2000);
    const whereParts = [];
    const values = [];
    let idx = 1;
    if (from) {
      whereParts.push(`o.order_date >= $${idx}`);
      values.push(from);
      idx += 1;
    }
    if (to) {
      whereParts.push(`o.order_date <= $${idx}`);
      values.push(to);
      idx += 1;
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    if (includeItems) {
      values.push(limit);
      const limitParam = `$${idx}`;
      const rows = await sql(`
          SELECT
            o.id,
            o.order_date,
            o.supplier_name,
            o.note,
            o.created_by_employee_name,
            o.created_at,
            COALESCE(COUNT(i.id), 0)::int AS items_count,
            COALESCE(SUM(i.computed_total_incl), 0) AS total_incl,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'bean_id', i.bean_id,
                  'bean_name_snapshot', i.bean_name_snapshot,
                  'price_kg_excl_tax', i.price_kg_excl_tax,
                  'bag_size_kg', i.bag_size_kg,
                  'roast_cost_incl_tax', i.roast_cost_incl_tax,
                  'extra_cost_per_kg', i.extra_cost_per_kg,
                  'extra_cost_kg', i.extra_cost_kg,
                  'waste_percent', i.waste_percent,
                  'computed_total_incl', i.computed_total_incl,
                  'computed_received_after_waste_kg', i.computed_received_after_waste_kg,
                  'computed_final_price_per_kg', i.computed_final_price_per_kg,
                  'created_at', i.created_at,
                  'updated_at', i.updated_at
                )
                ORDER BY i.id ASC
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::jsonb
            ) AS items
          FROM accounting_green_bean_orders o
          LEFT JOIN accounting_green_bean_order_items i
            ON i.order_id = o.id
          ${whereClause}
          GROUP BY o.id
          ORDER BY o.order_date DESC, o.id DESC
          LIMIT ${limitParam}
        `, values);
      return Response.json({
        orders: rows || []
      });
    }
    values.push(limit);
    const limitParam = `$${idx}`;
    const rows = await sql(`
        SELECT
          o.id,
          o.order_date,
          o.supplier_name,
          o.note,
          o.created_by_employee_name,
          o.created_at,
          COALESCE(COUNT(i.id), 0)::int AS items_count,
          COALESCE(SUM(i.computed_total_incl), 0) AS total_incl
        FROM accounting_green_bean_orders o
        LEFT JOIN accounting_green_bean_order_items i
          ON i.order_id = o.id
        ${whereClause}
        GROUP BY o.id
        ORDER BY o.order_date DESC, o.id DESC
        LIMIT ${limitParam}
      `, values);
    return Response.json({
      orders: rows || []
    });
  } catch (error) {
    console.error("green bean orders GET error", error);
    return Response.json({
      error: "فشل تحميل طلبات البن"
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/green-bean-orders
// body: {
//   orderDate,
//   supplierName?,
//   note?,
//   items: [{
//     beanId,
//     priceKgExclTax,
//     bagSizeKg,
//     roastCostInclTax?,
//     extraCostPerKg?,
//     wastePercent?,
//     receivedAfterWasteKg? // optional: if provided, waste% will be derived from it
//   }]
// }
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const orderDate = toDateOnly(body?.orderDate);
    if (!orderDate) {
      return Response.json({
        error: "اختر تاريخ الطلب"
      }, {
        status: 400
      });
    }
    const supplierName = cleanText(body?.supplierName) || null;
    const note = cleanText(body?.note) || null;
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      return Response.json({
        error: "أضف نوع بن واحد على الأقل"
      }, {
        status: 400
      });
    }
    const items = rawItems.map(it => ({
      beanId: Number(it?.beanId),
      priceKgExclTax: toNumber(it?.priceKgExclTax),
      bagSizeKg: toNumber(it?.bagSizeKg),
      roastCostInclTax: toNumber(it?.roastCostInclTax),
      extraCostPerKg: toNumber(it?.extraCostPerKg),
      extraCostKg: toNumber(it?.extraCostKg),
      wastePercent: toNumber(it?.wastePercent),
      receivedAfterWasteKg: toNumber(it?.receivedAfterWasteKg)
    })).filter(it => Number.isFinite(it.beanId) && it.beanId > 0);
    if (items.length === 0) {
      return Response.json({
        error: "اختر البن في الصفوف"
      }, {
        status: 400
      });
    }
    for (const it of items) {
      const roast = it.roastCostInclTax === null ? 8.05 : it.roastCostInclTax;
      const extra = it.extraCostPerKg === null ? 0 : it.extraCostPerKg;
      const baseChecks = [validateNonNegative(it.priceKgExclTax, "سعر الكيلو"), validateNonNegative(it.bagSizeKg, "حجم الخيشة"), validateNonNegative(roast, "تكلفة التحميص"), validateNonNegative(extra, "تكلفة إضافية للكيلو")];
      const baseFailed = baseChecks.find(c => !c.ok);
      if (baseFailed) {
        return Response.json({
          error: baseFailed.error
        }, {
          status: 400
        });
      }
      if (it.receivedAfterWasteKg !== null) {
        const receivedCheck = validateNonNegative(it.receivedAfterWasteKg, "الكمية الواصلة");
        if (!receivedCheck.ok) {
          return Response.json({
            error: receivedCheck.error
          }, {
            status: 400
          });
        }
      } else {
        const waste = it.wastePercent === null ? 0 : it.wastePercent;
        const wasteCheck = validateNonNegative(waste, "نسبة الهدر");
        if (!wasteCheck.ok) {
          return Response.json({
            error: wasteCheck.error
          }, {
            status: 400
          });
        }
      }
    }
    const beanIds = [...new Set(items.map(i => Number(i.beanId)))];
    const beans = await fetchBeansByIds(beanIds);
    if (beans.length !== beanIds.length) {
      return Response.json({
        error: "بعض أنواع البن غير موجودة"
      }, {
        status: 400
      });
    }
    const nameById = new Map(beans.map(b => [Number(b.id), b.name]));
    const employeeId = auth.user?.employee_id || auth.user?.id || null;
    const employeeName = auth.user?.name || null;
    const [orderRow] = await sql(`
        INSERT INTO accounting_green_bean_orders (
          order_date,
          supplier_name,
          note,
          created_by_employee_id,
          created_by_employee_name
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [orderDate, supplierName, note, employeeId, employeeName]);
    if (!orderRow?.id) {
      return Response.json({
        error: "فشل إنشاء الطلب"
      }, {
        status: 500
      });
    }
    let insertedItems = [];
    try {
      const orderId = orderRow.id;
      const results = await Promise.all(items.map(it => {
        const roastPerKgIncl = it.roastCostInclTax === null ? 8.05 : it.roastCostInclTax;
        const extraPerKg = it.extraCostPerKg === null ? 0 : it.extraCostPerKg;
        // كمية الإضافي: لو محددة تستخدمها، غير كذا تستخدم حجم الخيشة
        const effectiveExtraKg = it.extraCostKg !== null ? it.extraCostKg : Number(it.bagSizeKg);
        const bag = Number(it.bagSizeKg);

        // If receivedAfterWasteKg is provided, derive waste% from it.
        let receivedAfterWasteKg = it.receivedAfterWasteKg;
        let waste = it.wastePercent === null ? 0 : it.wastePercent;
        if (receivedAfterWasteKg !== null) {
          const rawWaste = bag > 0 ? (1 - receivedAfterWasteKg / bag) * 100 : 0;
          const clamped = clamp(rawWaste, 0, 100);
          waste = clamped === null ? 0 : clamped;
        } else {
          receivedAfterWasteKg = bag * (1 - waste / 100);
        }
        const beanName = nameById.get(Number(it.beanId)) || "";
        return sql(`
              INSERT INTO accounting_green_bean_order_items (
                order_id,
                bean_id,
                bean_name_snapshot,
                price_kg_excl_tax,
                bag_size_kg,
                roast_cost_incl_tax,
                extra_cost_per_kg,
                extra_cost_kg,
                waste_percent,
                computed_total_incl,
                computed_received_after_waste_kg,
                computed_final_price_per_kg
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                -- الإجمالي شامل الضريبة = تكلفة الخيشة شامل + (حجم الخيشة × تكلفة التحميص/كغ شامل) + (كمية الإضافي × تكاليف إضافية/كغ)
                ROUND(((($4::numeric * $5::numeric) * ${VAT_MULTIPLIER}) + ($6::numeric * $5::numeric) + ($7::numeric * $10::numeric))::numeric, 2),
                ROUND(($11)::numeric, 3),
                CASE
                  WHEN ($11) > 0
                    THEN ROUND((((($4::numeric * $5::numeric) * ${VAT_MULTIPLIER}) + ($6::numeric * $5::numeric) + ($7::numeric * $10::numeric)) / ($11))::numeric, 2)
                  ELSE NULL
                END
              )
              RETURNING *
            `, [orderId, it.beanId, beanName, it.priceKgExclTax, it.bagSizeKg, roastPerKgIncl, extraPerKg, it.extraCostKg, round4(waste) ?? 0, effectiveExtraKg, receivedAfterWasteKg]);
      }));
      insertedItems = results.flat();
    } catch (e) {
      console.error("insert order items failed; rolling back order", e);
      try {
        await sql(`DELETE FROM accounting_green_bean_orders WHERE id = $1`, [orderRow.id]);
      } catch (cleanupError) {
        console.error("cleanup order failed", cleanupError);
      }
      // رجّع سبب الخطأ عشان يسهل نعرف المشكلة لو تكررت
      const details = e?.message ? `: ${String(e.message).slice(0, 160)}` : "";
      return Response.json({
        error: `فشل حفظ أصناف الطلب${details}`
      }, {
        status: 500
      });
    }

    // ── Auto-update cost for inventory items linked to green beans in this order ──
    try {
      const beanIdsInOrder = [...new Set(insertedItems.map(it => Number(it.bean_id)))];
      if (beanIdsInOrder.length > 0) {
        // For each bean in the order, find the computed_final_price_per_kg from insertedItems
        // (these are the latest prices since they were just inserted)
        for (const item of insertedItems) {
          const beanId = Number(item.bean_id);
          const finalPrice = item.computed_final_price_per_kg;
          if (beanId && finalPrice != null) {
            const updated = await sql(`
                UPDATE items
                SET cost = $1
                WHERE linked_green_bean_id = $2
                RETURNING id, name
              `, [finalPrice, beanId]);
            if (updated && updated.length > 0) {
              console.log(`Auto-updated cost for ${updated.length} item(s) linked to bean ${beanId}:`, updated.map(u => `${u.name} (id=${u.id})`).join(", "));
            }
          }
        }
      }
    } catch (costUpdateError) {
      // Don't fail the order creation if cost update fails — just log it
      console.error("Failed to auto-update linked item costs:", costUpdateError);
    }
    return Response.json({
      order: orderRow || null,
      items: insertedItems || []
    }, {
      status: 201
    });
  } catch (error) {
    console.error("green bean orders POST error", error);
    return Response.json({
      error: "فشل إنشاء طلب البن"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
