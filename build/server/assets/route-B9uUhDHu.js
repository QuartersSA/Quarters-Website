import Anthropic from '@anthropic-ai/sdk';
import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureAccountsSchema } from './accountsTree-Bl8Y8djJ.js';
import '@neondatabase/serverless';
import 'crypto';

// Admin accounting, قسم المشتريات admins, or the dedicated field
// entry permission (رفع فاتورة مشتريات) — the entry flow scans too.
const REQUIRE_ACCOUNTING = {
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

// AI invoice analysis (تحليل ذكي للفاتورة).
//
// The client posts the invoice FILE itself (base64 PDF/image, ≤3MB —
// the Hono bodyLimit is 4.5MB and base64 inflates ×1.33) and/or its
// extracted text. Claude reads the document visually — scanned
// receipts, photos, native PDFs alike — and reconstructs the invoice
// (number, dates, supplier, line items with qty × unit price),
// repairs OCR/extraction mistakes arithmetically (net + VAT = total,
// qty × price = net), matches the supplier against the contacts list
// by VAT number then name, and classifies every line onto the
// best-fitting شجرة الحسابات expense account. Structured outputs
// guarantee parseable JSON.
//
// Requires ANTHROPIC_API_KEY in the environment; without it the
// endpoint returns 503 and the client falls back to its local
// heuristics.

const FILE_MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);
// base64 chars; ~3MB of raw file. Larger requests would trip the
// server-wide 4.5MB body limit anyway — reject with a clear error.
const MAX_FILE_BASE64 = 4 * 1024 * 1024;
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["invoice_number", "invoice_date", "due_date", "supplier_name", "supplier_vat_number", "contact_id", "contact_matched_by", "currency", "total", "discount", "tax", "items", "operator_note"],
  properties: {
    invoice_number: {
      type: ["string", "null"]
    },
    invoice_date: {
      type: ["string", "null"],
      description: "Gregorian ISO YYYY-MM-DD"
    },
    due_date: {
      type: ["string", "null"],
      description: "ISO YYYY-MM-DD"
    },
    supplier_name: {
      type: ["string", "null"],
      description: "Seller name, corrected to readable Arabic/English"
    },
    supplier_vat_number: {
      type: ["string", "null"],
      description: "SELLER's VAT registration number as printed, digits only (KSA: 15 digits starting with 3). NOT the buyer/customer VAT. Null when absent."
    },
    contact_id: {
      type: ["integer", "null"],
      description: "id from the provided contacts list, null if no match"
    },
    contact_matched_by: {
      type: ["string", "null"],
      description: "\"vat\" or \"name\", null when no match"
    },
    currency: {
      type: "string",
      description: "ISO code, default SAR"
    },
    total: {
      type: ["number", "null"],
      description: "Grand total incl. VAT"
    },
    discount: {
      type: ["number", "null"],
      description: "Invoice-level discount amount applied BEFORE tax, as printed. Null/0 when none."
    },
    tax: {
      type: ["number", "null"],
      description: "Total VAT amount"
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit_price", "tax_rate", "amount_includes_tax", "account_id"],
        properties: {
          description: {
            type: "string",
            description: "Readable item name (fix mirrored/garbled Arabic)"
          },
          quantity: {
            type: "number"
          },
          unit_price: {
            type: "number"
          },
          tax_rate: {
            type: "number",
            description: "Percent, e.g. 15"
          },
          amount_includes_tax: {
            type: "boolean",
            description: "true when unit_price includes VAT"
          },
          account_id: {
            type: ["integer", "null"],
            description: "Best-fitting expense account id from the provided tree"
          }
        }
      }
    },
    operator_note: {
      type: ["string", "null"],
      description: "Short Arabic note for the operator when something needs review (garbled rows, uncertain totals). Null when clean."
    }
  }
};
const SYSTEM_PROMPT = `أنت خبير محاسبة سعودي متخصص في قراءة فواتير المشتريات وإيصالات نقاط البيع.

يصلك مستند الفاتورة نفسه (PDF أو صورة — قد تكون ممسوحة/مصورة بجودة ضعيفة)، وأحياناً معه نص مستخرج آلياً قد يكون مشوهاً:
- نص عربي معكوس الحروف ("ةروتاف" = "فاتورة") أو مفصول الحروف ("ف ا ت و ر ة")
- أخطاء OCR في الأرقام (فاصلة عشرية ضائعة: "1370" قد تكون "13.70")
- أعمدة الجدول مبعثرة أو معكوسة الترتيب

عند إرفاق المستند اقرأه أنت بصرياً — هو المصدر الأساسي؛ النص المستخرج مجرد مساعد ثانوي.

مهمتك إعادة بناء الفاتورة بدقة:
1. صحّح النص العربي المعكوس/المفصول إلى صيغة مقروءة.
2. تحقق من الأرقام حسابياً: الصافي + الضريبة = الإجمالي، والكمية × سعر الوحدة = صافي البند. استخدم هذه المعادلات لتصحيح أخطاء القراءة (فاصلة عشرية ضائعة، رقم ملتصق بآخر). لا تخترع أرقاماً لا يدعمها المستند.
3. لا تخلط بين المبالغ والأرقام الأخرى: الرموز البريدية، أرقام الهواتف، السجل التجاري، الأرقام الضريبية، الباركود — ليست مبالغ.
4. الفاتورة عادة تحمل رقمين ضريبيين: البائع والمشتري. طابق رقم **البائع** مع قائمة الموردين (المشتري غالباً "مقهى ليلة وصباح / كوارتز" برقم 302189184400003 — تجاهله).
5. طابق المورد بالرقم الضريبي أولاً (مطابقة أرقام تامة). إن لم يكن في الفاتورة رقم ضريبي أو لم يطابق أي مورد، خمّن اسم المنشأة البائعة من الترويسة/الشعار/الختم وابحث عنه في قائمة الموردين بمرونة: تجاهل (ال) التعريف وكلمات شركة/مؤسسة/محل/مصنع وفروق الهمزات (أ/إ/آ/ا) والتاء المربوطة/الهاء والمسافات. طابق عند تشابه واضح فقط؛ وإلا اترك contact_id فارغاً وضع الاسم المخمّن في supplier_name. وفي كل الأحوال أرجع الرقم الضريبي المطبوع للبائع في supplier_vat_number (أرقاماً فقط، وفي السعودية 15 خانة تبدأ عادة بـ3) — حتى يُنشأ المورد الجديد به مباشرة؛ null إن لم يُطبع.
6. صنّف كل بند على أنسب حساب مصروفات من الشجرة المرفقة حسب طبيعة الصنف (حليب → حساب الحليب/الألبان إن وجد، وإلا الأنسب دلالياً). إن كان للمورد default_account_id استخدمه ما لم يكن هناك حساب أدق دلالياً للبند. إن لم يوجد شيء مناسب اترك account_id فارغاً.
7. التواريخ: "تاريخ الإصدار" هو تاريخ الفاتورة. أعدها بصيغة YYYY-MM-DD ميلادية. إيصالات نقاط البيع لا تحمل تاريخ استحقاق — اتركه فارغاً.
8. tax_rate القياسي بالسعودية 15. حدّد amount_includes_tax حسابياً لا تخميناً: إذا مجموع (الكمية × سعر الوحدة) لكل البنود = الإجمالي النهائي الشامل للضريبة فالأسعار شاملة → true (شائع في إيصالات نقاط البيع). إذا المجموع = الصافي قبل الضريبة فالأسعار غير شاملة → false.
9. **كل منتج في جدول الأصناف بند مستقل** — إيصالات نقاط البيع وفواتير الجملة تكتب كل منتج في سطر باسمه وكميته وسعره؛ استخرجها كلها واحداً واحداً ولا تدمج منتجات مختلفة في بند واحد أبداً. افحص المستند بعناية: عدد البنود التي تُرجعها يجب أن يساوي عدد أسطر المنتجات المطبوعة في الجدول.
10. الخصم: لا توزّعه على البنود ولا تغيّر أسعارها المطبوعة أبداً. أرجع قيمة الخصم الإجمالي (قبل الضريبة) كما هي مطبوعة في حقل discount، واترك البنود بأسعارها الأصلية. النظام يخصمه من الإجمالي قبل الضريبة.
11. مجموع البنود ناقص الخصم زائد الضريبة يجب أن يطابق الإجمالي النهائي. البند المجمّع الواحد بوصف "إجمالي الفاتورة" حل أخير فقط عندما يستحيل تمييز أسطر المنتجات إطلاقاً — واذكر السبب في operator_note.

أرجع JSON فقط حسب المخطط.`;
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      error: "التحليل الذكي غير مفعّل — أضف ANTHROPIC_API_KEY"
    }, {
      status: 503
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const text = body?.text ? String(body.text).slice(0, 30000) : "";
    const fileBase64 = body?.file_base64 ? String(body.file_base64) : "";
    const mediaType = body?.media_type ? String(body.media_type) : "";
    const hasFile = fileBase64.length > 0 && FILE_MEDIA_TYPES.has(mediaType);
    if (fileBase64.length > MAX_FILE_BASE64) {
      return Response.json({
        error: "حجم الملف يتجاوز حد التحليل الذكي (3MB)"
      }, {
        status: 413
      });
    }
    if (!hasFile && text.trim().length < 10) {
      return Response.json({
        error: "نص الفاتورة فارغ"
      }, {
        status: 400
      });
    }
    await ensureAccountsSchema();
    const contacts = await sql`
      SELECT id, name, vat_number, default_account_id
      FROM accounting_contacts
      WHERE is_active = TRUE
      ORDER BY name
    `;
    const accounts = await sql`
      SELECT id, code, name, name_en
      FROM accounting_accounts
      WHERE account_type = 'expense' AND is_postable AND is_active
      ORDER BY code
    `;
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: {
        type: "adaptive"
      },
      output_config: {
        format: {
          type: "json_schema",
          schema: OUTPUT_SCHEMA
        }
      },
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
        // The document itself first — Claude reads it visually,
        // which beats any client-side OCR on scanned receipts.
        ...(hasFile ? [mediaType === "application/pdf" ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBase64
          }
        } : {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: fileBase64
          }
        }] : []), {
          type: "text",
          text: ["## الموردون المسجلون", JSON.stringify(contacts), "", "## شجرة حسابات المصروفات (القابلة للترحيل)", JSON.stringify(accounts), ...(text.trim().length >= 10 ? ["", "## نص الفاتورة المستخرج آلياً (مساعد ثانوي)", text] : [])].join("\n")
        }]
      }]
    });
    if (response.stop_reason === "refusal") {
      return Response.json({
        error: "تعذر تحليل هذا المستند"
      }, {
        status: 422
      });
    }
    const textBlock = response.content.find(block => block.type === "text");
    if (!textBlock?.text) {
      return Response.json({
        error: "رد فارغ من المحلل"
      }, {
        status: 502
      });
    }
    const analysis = JSON.parse(textBlock.text);

    // Server-side sanity: the model may only reference real ids.
    const contactIds = new Set(contacts.map(contact => contact.id));
    if (analysis.contact_id && !contactIds.has(analysis.contact_id)) {
      analysis.contact_id = null;
      analysis.contact_matched_by = null;
    }

    // Fuzzy name fallback: no VAT match and the model left contact_id
    // empty, but it did read a seller name — try to find that
    // establishment in the contacts list ourselves (Arabic-normalized:
    // hamza forms, ta marbuta, ال, entity-type words, spacing).
    if (!analysis.contact_id && analysis.supplier_name) {
      const normalizeName = value => String(value || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/(^|\s)(شركه|مؤسسه|محل|مصنع|متجر|مخبز|مقهى)(\s|$)/g, " ").replace(/(^|\s)ال(?=\S)/g, "$1").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
      const target = normalizeName(analysis.supplier_name);
      if (target.length >= 3) {
        const hit = contacts.find(contact => {
          const name = normalizeName(contact.name);
          return name.length >= 3 && (name === target || name.includes(target) || target.includes(name));
        });
        if (hit) {
          analysis.contact_id = hit.id;
          analysis.contact_matched_by = "name";
        }
      }
    }
    const accountIds = new Set(accounts.map(account => account.id));
    for (const item of analysis.items || []) {
      if (item.account_id && !accountIds.has(item.account_id)) {
        item.account_id = null;
      }
    }

    // Arithmetic guard on the tax-inclusive flag: the model sometimes
    // marks POS-receipt prices as tax-exclusive even though qty×price
    // already sums to the grand total, inflating everything by 15%.
    // The grand total is the ground truth — flip the flag to whichever
    // interpretation reproduces it.
    const items = Array.isArray(analysis.items) ? analysis.items : [];
    const grandTotal = Number(analysis.total);
    if (items.length > 0 && Number.isFinite(grandTotal) && grandTotal > 0) {
      const sumRaw = items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unit_price), 0);
      const sumPlusTax = items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unit_price) * (1 + (Number(item.tax_rate) || 0) / 100), 0);
      const close = (a, b) => Math.abs(a - b) <= Math.max(0.02 * items.length, 0.05);
      if (items.some(item => !item.amount_includes_tax) && close(sumRaw, grandTotal) && !close(sumPlusTax, grandTotal)) {
        for (const item of items) item.amount_includes_tax = true;
      } else if (items.some(item => item.amount_includes_tax) && close(sumPlusTax, grandTotal) && !close(sumRaw, grandTotal)) {
        for (const item of items) item.amount_includes_tax = false;
      }

      // Discount sanity. Line prices stay AS PRINTED — an
      // invoice-level discount lives in analysis.discount and is
      // deducted from the pre-tax subtotal by the invoice form. When
      // the model missed it, derive it from the gap between the item
      // sum and the grand total (pre-tax terms, proportional tax).
      const netSum = items.reduce((acc, item) => {
        const rate = (Number(item.tax_rate) || 0) / 100;
        const base = Number(item.quantity) * Number(item.unit_price);
        return acc + (item.amount_includes_tax ? base / (1 + rate) : base);
      }, 0);
      const grossSum = items.reduce((acc, item) => {
        const rate = (Number(item.tax_rate) || 0) / 100;
        const base = Number(item.quantity) * Number(item.unit_price);
        return acc + (item.amount_includes_tax ? base : base * (1 + rate));
      }, 0);
      const reported = Number(analysis.discount);
      if (!Number.isFinite(reported) || reported < 0) analysis.discount = 0;
      if (!analysis.discount && grossSum > 0 && netSum > 0 && grossSum > grandTotal && !close(grossSum, grandTotal)) {
        // total = grossSum × (1 − D/netSum)  ⟹  D:
        const derived = Math.round(netSum * (1 - grandTotal / grossSum) * 100) / 100;
        if (derived >= 0.01 && derived <= netSum * 0.5) {
          analysis.discount = derived;
          const note = `رصدنا فرقاً بين مجموع البنود والإجمالي — سُجّل كخصم ${derived} قبل الضريبة، تأكد منه.`;
          analysis.operator_note = analysis.operator_note ? `${analysis.operator_note} ${note}` : note;
        }
      }
    }
    return Response.json({
      ok: true,
      analysis
    });
  } catch (error) {
    console.error("invoice analyze error", error);
    return Response.json({
      error: "فشل التحليل الذكي",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
