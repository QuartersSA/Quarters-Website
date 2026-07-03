import Anthropic from '@anthropic-ai/sdk';
import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureAccountsSchema } from './accountsTree-D8TS0rGA.js';
import '@neondatabase/serverless';
import 'crypto';

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};

// AI invoice analysis (تحليل ذكي للفاتورة).
//
// The client extracts the PDF's text (native layer or OCR) and posts
// it here. Claude reads the raw — often mirrored / letter-spaced /
// OCR-garbled — text, reconstructs the invoice (number, dates,
// supplier, line items with qty × unit price), repairs OCR mistakes
// arithmetically (net + VAT = total, qty × price = net), matches the
// supplier against the contacts list by VAT number then name, and
// classifies every line onto the best-fitting شجرة الحسابات expense
// account. Structured outputs guarantee parseable JSON.
//
// Requires ANTHROPIC_API_KEY in the environment; without it the
// endpoint returns 503 and the client falls back to its local
// heuristics.

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["invoice_number", "invoice_date", "due_date", "supplier_name", "contact_id", "contact_matched_by", "currency", "total", "tax", "items", "operator_note"],
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

يصلك نص مستخرج آلياً من PDF فاتورة — وقد يكون مشوهاً بشدة:
- نص عربي معكوس الحروف ("ةروتاف" = "فاتورة") أو مفصول الحروف ("ف ا ت و ر ة")
- أخطاء OCR في الأرقام (فاصلة عشرية ضائعة: "1370" قد تكون "13.70")
- أعمدة الجدول مبعثرة أو معكوسة الترتيب

مهمتك إعادة بناء الفاتورة بدقة:
1. صحّح النص العربي المعكوس/المفصول إلى صيغة مقروءة.
2. تحقق من الأرقام حسابياً: الصافي + الضريبة = الإجمالي، والكمية × سعر الوحدة = صافي البند. استخدم هذه المعادلات لتصحيح أخطاء OCR (فاصلة عشرية ضائعة، رقم ملتصق بآخر). لا تخترع أرقاماً لا يدعمها النص.
3. لا تخلط بين المبالغ والأرقام الأخرى: الرموز البريدية، أرقام الهواتف، السجل التجاري، الأرقام الضريبية، الباركود — ليست مبالغ.
4. الفاتورة عادة تحمل رقمين ضريبيين: البائع والمشتري. طابق رقم **البائع** مع قائمة الموردين (المشتري غالباً "مقهى ليلة وصباح / كوارتز" برقم 302189184400003 — تجاهله).
5. طابق المورد بالرقم الضريبي أولاً (مطابقة أرقام تامة)، ثم بالاسم. إن لم يطابق أحد، اترك contact_id فارغاً وضع اسم البائع في supplier_name.
6. صنّف كل بند على أنسب حساب مصروفات من الشجرة المرفقة حسب طبيعة الصنف (حليب → حساب الحليب/الألبان إن وجد، وإلا الأنسب دلالياً). إن كان للمورد default_account_id استخدمه ما لم يكن هناك حساب أدق دلالياً للبند. إن لم يوجد شيء مناسب اترك account_id فارغاً.
7. التواريخ: "تاريخ الإصدار" هو تاريخ الفاتورة. أعدها بصيغة YYYY-MM-DD ميلادية. إيصالات نقاط البيع لا تحمل تاريخ استحقاق — اتركه فارغاً.
8. tax_rate القياسي بالسعودية 15. amount_includes_tax=true إذا كان سعر الوحدة شاملاً للضريبة.
9. مجموع البنود يجب أن يطابق الإجمالي. إن تعذر فك البنود بثقة، أرجع بنداً واحداً مجمّعاً بوصف "إجمالي الفاتورة" واذكر السبب في operator_note.

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
    if (text.trim().length < 10) {
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
        content: [{
          type: "text",
          text: ["## الموردون المسجلون", JSON.stringify(contacts), "", "## شجرة حسابات المصروفات (القابلة للترحيل)", JSON.stringify(accounts), "", "## نص الفاتورة المستخرج", text].join("\n")
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
    const accountIds = new Set(accounts.map(account => account.id));
    for (const item of analysis.items || []) {
      if (item.account_id && !accountIds.has(item.account_id)) {
        item.account_id = null;
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
