import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

/**
 * PATCH /api/items/batch-inventory
 * Body: { ids: number[], show_in_inventory: boolean }
 * Updates show_in_inventory for all given item IDs at once.
 */
async function PATCH(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    const {
      ids,
      show_in_inventory
    } = body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({
        error: "يجب اختيار صنف واحد على الأقل"
      }, {
        status: 400
      });
    }
    if (typeof show_in_inventory !== "boolean") {
      return Response.json({
        error: "قيمة الإظهار في الجرد غير صحيحة"
      }, {
        status: 400
      });
    }

    // Build a safe parameterised query. Inventory visibility is
    // independent from item activity.
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    const values = [show_in_inventory, ...ids.map(id => parseInt(id))];
    const query = `UPDATE items SET show_in_inventory = $1 WHERE id IN (${placeholders}) RETURNING id, show_in_inventory, is_active`;
    const result = await sql(query, values);
    console.log(`Batch updated show_in_inventory=${show_in_inventory} for ${result.length} items`);
    return Response.json({
      updated: result.length,
      show_in_inventory
    });
  } catch (error) {
    console.error("Error batch updating items:", error);
    return Response.json({
      error: "حدث خطأ أثناء تحديث الأصناف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { PATCH };
