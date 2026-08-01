import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { e as ensureInvoiceBatchSchema, r as readUploadBase64 } from './invoiceBatches-BefXoxDb.js';
import { F as FILE_MEDIA_TYPES, r as runInvoiceAnalysis } from './invoiceAnalysis-BhCAfXUC.js';
import { c as computeDraftTotals, r as round2 } from './invoiceDraftMath-C8Db36NO.js';
import { createPurchaseInvoice } from './route-D47nPfeU.js';
import '@neondatabase/serverless';
import 'crypto';
import '@anthropic-ai/sdk';
import './accountsTree-BiYqjwch.js';
import './purchaseAutomation-BUYtx20E.js';
import './wasender-DykD1wlV.js';
import './waNotify-CtLfIpXX.js';

const REQUIRE_PURCHASES_CREATE = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    permission: "can_add_purchase_invoices"
  }]
};

// المسودة الأولية من ناتج التحليل — نفس الحقول التي يعبيها المسح
// الذكي في نافذة الفاتورة الواحدة.
function buildDraft(analysis) {
  const items = (Array.isArray(analysis?.items) ? analysis.items : []).map(item => ({
    description: item.description ? String(item.description) : "",
    account_id: item.account_id ? Number(item.account_id) : null,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    tax_rate: Number.isFinite(Number(item.tax_rate)) ? Number(item.tax_rate) : 15,
    amount_includes_tax: !!item.amount_includes_tax
  })).filter(item => item.quantity > 0 || item.unit_price > 0);
  return {
    invoice_number: analysis?.invoice_number ? String(analysis.invoice_number) : "",
    contact_id: analysis?.contact_id ? Number(analysis.contact_id) : null,
    contact_matched_by: analysis?.contact_matched_by || null,
    supplier_name: analysis?.supplier_name ? String(analysis.supplier_name) : "",
    supplier_vat_number: analysis?.supplier_vat_number ? String(analysis.supplier_vat_number).replace(/\D/g, "") : "",
    invoice_date: analysis?.invoice_date || "",
    due_date: analysis?.due_date || "",
    currency: analysis?.currency || "SAR",
    discount: Number(analysis?.discount) || 0,
    notes: analysis?.operator_note ? String(analysis.operator_note) : "",
    items
  };
}

// تعقيم مسودة قادمة من العميل: حقول معروفة فقط، أنواع مضبوطة، سقوف
// أطوال — JSONB الحر من المتصفح لا يدخل القاعدة كما هو أبداً.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function sanitizeDraft(input) {
  if (!input || typeof input !== "object") return null;
  const text = (value, max) => String(value ?? "").slice(0, max).trim();
  const date = value => DATE_RE.test(String(value || "")) ? value : "";
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, 300).map(item => ({
    description: text(item?.description, 500),
    account_id: Number(item?.account_id) > 0 ? Number(item.account_id) : null,
    quantity: Number(item?.quantity) || 0,
    unit_price: Number(item?.unit_price) || 0,
    tax_rate: Math.min(Math.max(Number(item?.tax_rate) || 0, 0), 100),
    amount_includes_tax: !!item?.amount_includes_tax
  }));
  return {
    invoice_number: text(input.invoice_number, 120),
    contact_id: Number(input.contact_id) > 0 ? Number(input.contact_id) : null,
    contact_matched_by: input.contact_matched_by ? text(input.contact_matched_by, 20) : null,
    supplier_name: text(input.supplier_name, 300),
    supplier_vat_number: text(input.supplier_vat_number, 30).replace(/\D/g, ""),
    invoice_date: date(input.invoice_date),
    due_date: date(input.due_date),
    currency: text(input.currency, 8) || "SAR",
    discount: Math.max(Number(input.discount) || 0, 0),
    notes: text(input.notes, 2000),
    items
  };
}

// أعلام المراجعة — تُعرض شارات في الواجهة وتحدد هل البند «جاهز»
// أم «يحتاج انتباهاً».
function computeFlags(draft, {
  duplicateInvoice,
  duplicateItem,
  note
}) {
  const flags = [];
  const totals = computeDraftTotals(draft);
  if (!draft.invoice_number) flags.push("missing_number");
  if (!draft.invoice_date) flags.push("missing_date");
  if (!draft.contact_id && !draft.supplier_name) flags.push("missing_supplier");
  if (!draft.contact_id && draft.supplier_name) flags.push("new_supplier");
  if (!draft.items.length) flags.push("no_items");
  if (totals.total <= 0) flags.push("zero_total");
  if (duplicateInvoice) flags.push("duplicate_invoice");
  if (duplicateItem) flags.push("duplicate_in_batch");
  if (note) flags.push("operator_note");
  return flags;
}
const ATTENTION_FLAGS = new Set(["missing_supplier", "no_items", "zero_total", "duplicate_invoice", "duplicate_in_batch", "missing_number", "missing_date"]);

// كشف التكرار: مورد + رقم فاتورة (نفس منطق check-number)، ثم شبكة
// أوسع رقم + مبلغ لأي مورد، ثم تكرار داخل الدفعة نفسها.
async function findDuplicates({
  batchId,
  itemId,
  draft
}) {
  const number = String(draft.invoice_number || "").trim();
  let duplicateInvoice = null;
  let duplicateItem = null;
  if (number) {
    const totals = computeDraftTotals(draft);
    if (draft.contact_id) {
      const [hit] = await sql`
        SELECT id, invoice_number, TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date, total_amount
        FROM accounting_purchase_invoices
        WHERE is_active = TRUE
          AND contact_id = ${Number(draft.contact_id)}
          AND LOWER(invoice_number) = LOWER(${number})
        LIMIT 1
      `;
      duplicateInvoice = hit || null;
    }
    if (!duplicateInvoice && totals.total > 0) {
      const [hit] = await sql`
        SELECT id, invoice_number, TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date, total_amount
        FROM accounting_purchase_invoices
        WHERE is_active = TRUE
          AND LOWER(invoice_number) = LOWER(${number})
          AND ABS(total_amount - ${totals.total}) < 0.01
        LIMIT 1
      `;
      duplicateInvoice = hit || null;
    }
    const [sibling] = await sql`
      SELECT id, file_name
      FROM accounting_invoice_batch_items
      WHERE batch_id = ${batchId}
        AND id <> ${itemId}
        AND status <> 'failed'
        AND LOWER(COALESCE(draft->>'invoice_number', '')) = LOWER(${number})
      LIMIT 1
    `;
    duplicateItem = sibling || null;
  }
  return {
    duplicateInvoice,
    duplicateItem
  };
}

// تحميل الدفعة مع فرض الملكية: غير المشرف لا يصل إلا لدفعاته.
async function loadOwnedBatch(batchId, user) {
  if (!Number.isFinite(batchId) || batchId <= 0) {
    return {
      error: "معرّف الدفعة غير صحيح",
      status: 400
    };
  }
  const [batch] = await sql`
    SELECT id, created_by_employee_id, created_by_employee_name,
           TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
    FROM accounting_invoice_batches WHERE id = ${batchId}
  `;
  if (!batch) return {
    error: "الدفعة غير موجودة",
    status: 404
  };
  const isAdmin = user?.role === "Admin";
  if (!isAdmin && Number(batch.created_by_employee_id) !== Number(user?.id || 0)) {
    return {
      error: "ليست لديك صلاحية على هذه الدفعة",
      status: 403
    };
  }
  return {
    batch
  };
}

// GET — الدفعة كاملة ببنودها لحالة الاستئناف والمراجعة.
async function GET(request, {
  params: {
    id
  }
}) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureInvoiceBatchSchema();
    const batchId = Number(id);
    const owned = await loadOwnedBatch(batchId, auth.user);
    if (owned.error) {
      return Response.json({
        error: owned.error
      }, {
        status: owned.status
      });
    }
    const items = await sql`
      SELECT id, file_name, file_url, media_type, upload_session_id, status,
             analysis, draft, flags, error, edited_manually,
             duplicate_invoice_id, duplicate_item_id, invoice_id,
             TO_CHAR(analyzed_at, 'YYYY-MM-DD HH24:MI') AS analyzed_at,
             TO_CHAR(approved_at, 'YYYY-MM-DD HH24:MI') AS approved_at,
             approved_by_employee_name,
             TO_CHAR(submitted_at, 'YYYY-MM-DD HH24:MI') AS submitted_at
      FROM accounting_invoice_batch_items
      WHERE batch_id = ${batchId}
      ORDER BY id ASC
    `;
    return Response.json({
      batch: owned.batch,
      items
    });
  } catch (error) {
    console.error("invoice batch get error", error);
    return Response.json({
      error: "فشل تحميل الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}

// PATCH — إجراءات البنود: analyze / save_draft / approve / submit /
// retry. كل إجراء مستقل: فشل بند لا يوقف إخوته.
async function PATCH(request, {
  params: {
    id
  }
}) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureInvoiceBatchSchema();
    const batchId = Number(id);
    const owned = await loadOwnedBatch(batchId, auth.user);
    if (owned.error) {
      return Response.json({
        error: owned.error
      }, {
        status: owned.status
      });
    }
    const body = await request.json().catch(() => ({}));
    const itemId = Number(body?.item_id);
    const action = String(body?.action || "");
    const [item] = await sql`
      SELECT id, batch_id, file_name, file_url, media_type,
             upload_session_id, status, analysis, draft, edited_manually
      FROM accounting_invoice_batch_items
      WHERE id = ${itemId} AND batch_id = ${batchId}
    `;
    if (!item) {
      return Response.json({
        error: "البند غير موجود"
      }, {
        status: 404
      });
    }
    if (action === "analyze") {
      // مطالبة ذرية بالصف — طلبان متزامنان (تبويبان/مستخدمان) لا
      // يشغلان تحليلين مدفوعين على نفس البند: الأول يكسب المطالبة
      // والثاني يرتد 409. بند «قيد التحليل» عالق (انقطعت جلسته) يُعاد
      // التقاطه فقط بعد 3 دقائق من آخر تحديث.
      const claimed = await sql`
        UPDATE accounting_invoice_batch_items
        SET status = 'analyzing', error = NULL,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId}
          AND (
            status IN ('uploaded', 'failed')
            OR (
              status = 'analyzing'
              AND updated_at < (NOW() AT TIME ZONE 'Asia/Riyadh') - INTERVAL '3 minutes'
            )
          )
        RETURNING id
      `;
      if (!claimed.length) {
        return Response.json({
          error: "البند قيد التحليل بالفعل أو حُلّل مسبقاً"
        }, {
          status: 409
        });
      }
      const fail = async (message, status = "failed") => {
        await sql`
          UPDATE accounting_invoice_batch_items
          SET status = ${status}, error = ${message},
              updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${itemId}
        `;
        return Response.json({
          ok: true,
          item_status: status,
          error: message
        });
      };
      if (!FILE_MEDIA_TYPES.has(item.media_type)) {
        return fail("نوع الملف غير مدعوم للتحليل", "needs_attention");
      }
      const file = await readUploadBase64(item.upload_session_id);
      if (!file) {
        return fail("تعذر قراءة الملف المرفوع");
      }
      if (file.tooLarge) {
        return fail("حجم الملف يتجاوز حد التحليل الذكي (3MB) — أدخل البيانات يدوياً", "needs_attention");
      }
      let result;
      try {
        result = await runInvoiceAnalysis({
          fileBase64: file.base64,
          mediaType: item.media_type
        });
      } catch (error) {
        console.error("batch item analysis error", error);
        return fail(`فشل التحليل الذكي: ${error.message}`);
      }
      if (!result.ok) {
        return fail(result.error);
      }
      const draft = buildDraft(result.analysis);
      const {
        duplicateInvoice,
        duplicateItem
      } = await findDuplicates({
        batchId,
        itemId,
        draft
      });
      const flags = computeFlags(draft, {
        duplicateInvoice,
        duplicateItem,
        note: result.analysis?.operator_note
      });
      const status = flags.some(flag => ATTENTION_FLAGS.has(flag)) ? "needs_attention" : "ready";
      // لا نكتب فوق تعديل يدوي سبقنا (سباق نادر): المسودة تُكتب فقط
      // إن كان البند ما زال بمطالبتنا وبلا تعديل يدوي.
      await sql`
        UPDATE accounting_invoice_batch_items
        SET status = ${status},
            analysis = ${JSON.stringify(result.analysis)}::jsonb,
            draft = CASE WHEN edited_manually THEN draft ELSE ${JSON.stringify(draft)}::jsonb END,
            flags = ${JSON.stringify(flags)}::jsonb,
            error = NULL,
            duplicate_invoice_id = ${duplicateInvoice?.id || null},
            duplicate_item_id = ${duplicateItem?.id || null},
            analyzed_at = (NOW() AT TIME ZONE 'Asia/Riyadh'),
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId} AND status = 'analyzing'
      `;
      logPurchaseAudit({
        entityType: "invoice_batch",
        entityId: batchId,
        action: "analyzed",
        summary: `حُلّلت «${item.file_name || itemId}» → ${status === "ready" ? "جاهزة" : "تحتاج انتباهاً"}`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        item_status: status
      });
    }
    if (action === "save_draft") {
      if (["submitted", "submitting"].includes(item.status)) {
        return Response.json({
          error: "لا يمكن تعديل بند مُرسل"
        }, {
          status: 409
        });
      }
      const draft = sanitizeDraft(body?.draft);
      if (!draft) {
        return Response.json({
          error: "مسودة غير صالحة"
        }, {
          status: 400
        });
      }
      const {
        duplicateInvoice,
        duplicateItem
      } = await findDuplicates({
        batchId,
        itemId,
        draft
      });
      const flags = computeFlags(draft, {
        duplicateInvoice,
        duplicateItem,
        note: null
      });
      // التعديل بعد الاعتماد يسحب الاعتماد — تراجَع من جديد.
      const status = flags.some(flag => ATTENTION_FLAGS.has(flag)) ? "needs_attention" : "ready";
      await sql`
        UPDATE accounting_invoice_batch_items
        SET draft = ${JSON.stringify(draft)}::jsonb,
            flags = ${JSON.stringify(flags)}::jsonb,
            status = ${status},
            edited_manually = TRUE,
            duplicate_invoice_id = ${duplicateInvoice?.id || null},
            duplicate_item_id = ${duplicateItem?.id || null},
            approved_at = NULL, approved_by_employee_id = NULL,
            approved_by_employee_name = NULL,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId} AND status NOT IN ('submitted', 'submitting')
      `;
      if (!item.edited_manually) {
        logPurchaseAudit({
          entityType: "invoice_batch",
          entityId: batchId,
          action: "edited",
          summary: `عُدّلت بيانات «${item.file_name || itemId}» يدوياً بعد التحليل`,
          actor: auth.user
        });
      }
      return Response.json({
        ok: true,
        item_status: status,
        flags
      });
    }
    if (action === "approve") {
      if (!["ready", "needs_attention"].includes(item.status)) {
        return Response.json({
          error: "البند ليس في حالة تسمح بالاعتماد"
        }, {
          status: 409
        });
      }
      const draft = item.draft;
      if (!draft) {
        return Response.json({
          error: "لا مسودة للاعتماد"
        }, {
          status: 400
        });
      }
      const totals = computeDraftTotals(draft);
      if (!draft.contact_id && !String(draft.supplier_name || "").trim()) {
        return Response.json({
          error: "حدد المورد أو اكتب اسمه قبل الاعتماد"
        }, {
          status: 400
        });
      }
      if (totals.total <= 0) {
        return Response.json({
          error: "إجمالي الفاتورة يجب أن يكون أكبر من صفر"
        }, {
          status: 400
        });
      }
      const {
        duplicateInvoice,
        duplicateItem
      } = await findDuplicates({
        batchId,
        itemId,
        draft
      });
      if ((duplicateInvoice || duplicateItem) && !body?.force) {
        return Response.json({
          error: duplicateInvoice ? `يبدو أنها مكررة — فاتورة ${duplicateInvoice.invoice_number} بتاريخ ${duplicateInvoice.invoice_date} بمبلغ ${duplicateInvoice.total_amount} موجودة مسبقاً` : `رقم الفاتورة مكرر داخل الدفعة (ملف ${duplicateItem.file_name || duplicateItem.id})`,
          duplicate: true
        }, {
          status: 409
        });
      }
      await sql`
        UPDATE accounting_invoice_batch_items
        SET status = 'approved',
            approved_at = (NOW() AT TIME ZONE 'Asia/Riyadh'),
            approved_by_employee_id = ${auth.user?.id ? Number(auth.user.id) : null},
            approved_by_employee_name = ${auth.user?.name || null},
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId} AND status IN ('ready', 'needs_attention')
      `;
      logPurchaseAudit({
        entityType: "invoice_batch",
        entityId: batchId,
        action: "approved",
        summary: `اعتُمدت «${item.file_name || itemId}» (${totals.total} ${draft.currency || "SAR"})${body?.force ? " رغم تحذير التكرار" : ""}`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        item_status: "approved"
      });
    }
    if (action === "submit") {
      // الإرسال خادمي بالكامل من المسودة المخزنة المعتمدة — لا مجال
      // لمسودة متصفح متأخرة الحفظ. المطالبة الذرية (approved →
      // submitting) تمنع الإرسال المزدوج: نقرتان متسابقتان تنشئان
      // فاتورة واحدة فقط.
      const claimed = await sql`
        UPDATE accounting_invoice_batch_items
        SET status = 'submitting',
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId} AND status = 'approved'
        RETURNING draft, file_url, file_name
      `;
      if (!claimed.length) {
        return Response.json({
          error: "اعتمد البند أولاً قبل الإرسال (أو أنه أُرسل بالفعل)"
        }, {
          status: 409
        });
      }
      const draft = claimed[0].draft;
      const items = (Array.isArray(draft?.items) ? draft.items : []).map(line => ({
        description: line.description || null,
        account_id: line.account_id ? String(line.account_id) : null,
        quantity: Number(line.quantity) || 0,
        unit_price: Number(line.unit_price) || 0,
        amount: round2((Number(line.quantity) || 0) * (Number(line.unit_price) || 0)),
        tax_rate: Number.isFinite(Number(line.tax_rate)) ? Number(line.tax_rate) : 15,
        amount_includes_tax: !!line.amount_includes_tax
      })).filter(line => line.amount > 0);
      const totals = computeDraftTotals({
        ...draft,
        items
      });
      const payload = {
        invoice_number: String(draft?.invoice_number || "").trim() || undefined,
        contact_id: draft?.contact_id ? String(draft.contact_id) : null,
        supplier_name: String(draft?.supplier_name || "").trim() || null,
        invoice_date: draft?.invoice_date || null,
        due_date: draft?.due_date || null,
        currency: draft?.currency || "SAR",
        items,
        subtotal_amount: totals.subtotal,
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total_amount: totals.total,
        paid_amount: 0,
        paid_bank_account_id: null,
        payment_receipt_url: null,
        workflow_status: "pending_payment",
        branch_id: null,
        notes: String(draft?.notes || "").trim() || null,
        attachment_url: claimed[0].file_url || null
      };
      let created;
      try {
        created = await createPurchaseInvoice(payload, auth.user);
      } catch (error) {
        created = {
          ok: false,
          status: 500,
          error: error.message
        };
      }
      if (!created.ok) {
        // فشل الإنشاء = لا فاتورة — أعد البند معتمداً مع سبب الفشل.
        await sql`
          UPDATE accounting_invoice_batch_items
          SET status = 'approved', error = ${created.error || "فشل إنشاء الفاتورة"},
              updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${itemId} AND status = 'submitting'
        `;
        return Response.json({
          error: created.error || "فشل إنشاء الفاتورة"
        }, {
          status: created.status || 500
        });
      }
      await sql`
        UPDATE accounting_invoice_batch_items
        SET status = 'submitted',
            invoice_id = ${created.invoice.id},
            error = NULL,
            submitted_at = (NOW() AT TIME ZONE 'Asia/Riyadh'),
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId}
      `;
      logPurchaseAudit({
        entityType: "invoice_batch",
        entityId: batchId,
        action: "submitted",
        summary: `أُرسلت «${claimed[0].file_name || itemId}» إلى الفواتير (فاتورة #${created.invoice.id})`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        item_status: "submitted",
        invoice_id: created.invoice.id
      });
    }
    if (action === "retry") {
      if (!["failed", "needs_attention"].includes(item.status)) {
        return Response.json({
          error: "لا حاجة لإعادة المحاولة"
        }, {
          status: 409
        });
      }
      await sql`
        UPDATE accounting_invoice_batch_items
        SET status = 'uploaded', error = NULL,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${itemId} AND status IN ('failed', 'needs_attention')
      `;
      return Response.json({
        ok: true,
        item_status: "uploaded"
      });
    }
    return Response.json({
      error: "إجراء غير معروف"
    }, {
      status: 400
    });
  } catch (error) {
    console.error("invoice batch patch error", error);
    return Response.json({
      error: "فشل تنفيذ الإجراء",
      details: error.message
    }, {
      status: 500
    });
  }
}

// DELETE — حذف بند واحد (?item_id=) أو الدفعة كلها. الفواتير التي
// أُرسلت فعلاً تبقى في النظام؛ الحذف يخص الدفعة وبنودها فقط.
async function DELETE(request, {
  params: {
    id
  }
}) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureInvoiceBatchSchema();
    const batchId = Number(id);
    const owned = await loadOwnedBatch(batchId, auth.user);
    if (owned.error) {
      return Response.json({
        error: owned.error
      }, {
        status: owned.status
      });
    }
    const url = new URL(request.url);
    const itemId = Number(url.searchParams.get("item_id"));
    if (Number.isFinite(itemId) && itemId > 0) {
      await sql`
        DELETE FROM accounting_invoice_batch_items
        WHERE id = ${itemId} AND batch_id = ${batchId}
      `;
      return Response.json({
        ok: true
      });
    }
    await sql`DELETE FROM accounting_invoice_batch_items WHERE batch_id = ${batchId}`;
    await sql`DELETE FROM accounting_invoice_batches WHERE id = ${batchId}`;
    logPurchaseAudit({
      entityType: "invoice_batch",
      entityId: batchId,
      action: "deleted",
      summary: "حُذفت دفعة رفع جماعي",
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("invoice batch delete error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PATCH };
