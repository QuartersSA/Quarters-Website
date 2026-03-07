import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

const VAT_MULTIPLIER = 1.15;
function toId(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}
function cleanText(value) {
  const t = value === null || value === undefined ? "" : String(value);
  return t.trim();
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

// GET /api/accounting/green-bean-orders/:id
async function GET(request, {
  params
}) {
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
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const [order] = await sql(`SELECT * FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`, [id]);
    if (!order) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    const items = await sql(`
        SELECT
          i.*,
          b.name AS bean_name_current
        FROM accounting_green_bean_order_items i
        LEFT JOIN accounting_green_beans b
          ON b.id = i.bean_id
        WHERE i.order_id = $1
        ORDER BY i.id ASC
      `, [id]);
    return Response.json({
      order,
      items: items || []
    });
  } catch (error) {
    console.error("green bean order GET(id) error", error);
    return Response.json({
      error: "فشل تحميل الطلب"
    }, {
      status: 500
    });
  }
}

// DELETE /api/accounting/green-bean-orders/:id
async function DELETE(request, {
  params
}) {
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
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const [row] = await sql(`DELETE FROM accounting_green_bean_orders WHERE id = $1 RETURNING id`, [id]);
    if (!row) {
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
    console.error("green bean order DELETE error", error);
    return Response.json({
      error: "فشل حذف الطلب"
    }, {
      status: 500
    });
  }
}

// PUT /api/accounting/green-bean-orders/:id
async function PUT(request, {
  params
}) {
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
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    // Check order exists
    const [existing] = await sql(`SELECT id FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`, [id]);
    if (!existing) {
      return Response.json({
        error: "الطلب غير موجود"
      }, {
        status: 404
      });
    }
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

    // Validate items
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

    // Fetch bean names
    const beanIds = [...new Set(items.map(i => Number(i.beanId)))];
    const beans = await sql(`SELECT id, name FROM accounting_green_beans WHERE id = ANY($1::bigint[])`, [beanIds]);
    if (!beans || beans.length !== beanIds.length) {
      return Response.json({
        error: "بعض أنواع البن غير موجودة"
      }, {
        status: 400
      });
    }
    const nameById = new Map(beans.map(b => [Number(b.id), b.name]));

    // Update order header
    await sql(`UPDATE accounting_green_bean_orders
       SET order_date = $2, supplier_name = $3, note = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`, [id, orderDate, supplierName, note]);

    // Delete old items
    await sql(`DELETE FROM accounting_green_bean_order_items WHERE order_id = $1`, [id]);

    // Insert new items
    let insertedItems = [];
    try {
      const results = await Promise.all(items.map(it => {
        const roastPerKgIncl = it.roastCostInclTax === null ? 8.05 : it.roastCostInclTax;
        const extraPerKg = it.extraCostPerKg === null ? 0 : it.extraCostPerKg;
        const effectiveExtraKg = it.extraCostKg !== null ? it.extraCostKg : Number(it.bagSizeKg);
        const bag = Number(it.bagSizeKg);
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
        return sql(`INSERT INTO accounting_green_bean_order_items (
              order_id, bean_id, bean_name_snapshot,
              price_kg_excl_tax, bag_size_kg, roast_cost_incl_tax,
              extra_cost_per_kg, extra_cost_kg, waste_percent,
              computed_total_incl, computed_received_after_waste_kg,
              computed_final_price_per_kg
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              ROUND(((($4::numeric * $5::numeric) * ${VAT_MULTIPLIER}) + ($6::numeric * $5::numeric) + ($7::numeric * $10::numeric))::numeric, 2),
              ROUND(($11)::numeric, 3),
              CASE WHEN ($11) > 0
                THEN ROUND((((($4::numeric * $5::numeric) * ${VAT_MULTIPLIER}) + ($6::numeric * $5::numeric) + ($7::numeric * $10::numeric)) / ($11))::numeric, 2)
                ELSE NULL
              END
            ) RETURNING *`, [id, it.beanId, beanName, it.priceKgExclTax, it.bagSizeKg, roastPerKgIncl, extraPerKg, it.extraCostKg, round4(waste) ?? 0, effectiveExtraKg, receivedAfterWasteKg]);
      }));
      insertedItems = results.flat();
    } catch (e) {
      console.error("update order items failed", e);
      const details = e?.message ? `: ${String(e.message).slice(0, 160)}` : "";
      return Response.json({
        error: `فشل تعديل أصناف الطلب${details}`
      }, {
        status: 500
      });
    }

    // Auto-update cost for linked inventory items
    try {
      for (const item of insertedItems) {
        const beanId = Number(item.bean_id);
        const finalPrice = item.computed_final_price_per_kg;
        if (beanId && finalPrice != null) {
          await sql(`UPDATE items SET cost = $1 WHERE linked_green_bean_id = $2`, [finalPrice, beanId]);
        }
      }
    } catch (costUpdateError) {
      console.error("Failed to auto-update linked item costs:", costUpdateError);
    }

    // Fetch updated order
    const [updatedOrder] = await sql(`SELECT * FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`, [id]);
    return Response.json({
      order: updatedOrder || null,
      items: insertedItems || []
    });
  } catch (error) {
    console.error("green bean order PUT error", error);
    return Response.json({
      error: "فشل تعديل طلب البن"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PUT };
