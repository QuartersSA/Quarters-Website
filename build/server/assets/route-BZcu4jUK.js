import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const branches = await sql`
      SELECT id, name, location, created_at
      FROM branches
      ORDER BY name ASC
    `;
    return Response.json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);
    return Response.json({
      error: "Failed to fetch branches"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
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
      name,
      location
    } = body;
    if (!name) {
      return Response.json({
        error: "Branch name is required"
      }, {
        status: 400
      });
    }
    const result = await sql`
      INSERT INTO branches (name, location)
      VALUES (${name}, ${location || null})
      RETURNING id, name, location, created_at
    `;
    return Response.json(result[0], {
      status: 201
    });
  } catch (error) {
    console.error("Error creating branch:", error);
    return Response.json({
      error: "Failed to create branch"
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
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
      id,
      name,
      location
    } = body;
    if (!id || !name) {
      return Response.json({
        error: "Branch ID and name are required"
      }, {
        status: 400
      });
    }
    const result = await sql`
      UPDATE branches
      SET name = ${name}, location = ${location || null}
      WHERE id = ${id}
      RETURNING id, name, location, created_at
    `;
    if (result.length === 0) {
      return Response.json({
        error: "Branch not found"
      }, {
        status: 404
      });
    }
    return Response.json(result[0]);
  } catch (error) {
    console.error("Error updating branch:", error);
    return Response.json({
      error: "Failed to update branch"
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
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
      id
    } = body;
    if (!id) {
      return Response.json({
        error: "Branch ID is required"
      }, {
        status: 400
      });
    }

    // Check if branch has employees or inventory operations
    const hasEmployees = await sql`
      SELECT COUNT(*) as count FROM employees WHERE branch_id = ${id}
    `;
    const hasOperations = await sql`
      SELECT COUNT(*) as count FROM inventory_operations WHERE branch_id = ${id}
    `;
    if (parseInt(hasEmployees[0].count) > 0 || parseInt(hasOperations[0].count) > 0) {
      return Response.json({
        error: "Cannot delete branch with existing employees or inventory operations"
      }, {
        status: 400
      });
    }
    await sql`DELETE FROM branches WHERE id = ${id}`;
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return Response.json({
      error: "Failed to delete branch"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT };
