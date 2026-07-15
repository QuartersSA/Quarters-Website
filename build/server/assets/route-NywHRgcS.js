import { r as requireWorkspaceEmployee } from './_utils-CbLHH82L.js';
import { s as sendWhatsAppViaWasender } from './wasender-DTHCekVE.js';
import './sql-BfhTxwII.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

// POST /api/wasender/test
// body: { employeeId, to, text }
async function POST(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const to = String(body.to || "").trim();
    const text = String(body.text || "").trim();
    if (!to || !text) {
      return Response.json({
        error: "to و text مطلوبة"
      }, {
        status: 400
      });
    }
    const result = await sendWhatsAppViaWasender({
      to,
      text
    });
    if (!result.ok) {
      return Response.json({
        error: "فشل الإرسال",
        details: result.error,
        more: result.details
      }, {
        status: 502
      });
    }
    return Response.json({
      success: true,
      result: result.data
    });
  } catch (error) {
    console.error("wasender test POST error", error);
    return Response.json({
      error: "خطأ غير متوقع"
    }, {
      status: 500
    });
  }
}

export { POST };
