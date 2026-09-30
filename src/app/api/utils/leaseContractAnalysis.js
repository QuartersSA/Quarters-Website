import Anthropic from "@anthropic-ai/sdk";
import sql from "@/app/api/utils/sql";
import { ensureLeaseSchema } from "@/app/api/utils/leaseContracts";
import { LEASE_FREQUENCIES } from "@/utils/leaseMath";

// التحليل الذكي لعقود الإيجار — يقرأ المستند (PDF/صورة) ويستخرج:
// رقم العقد، المؤجر، الموقع، تاريخي البداية والانتهاء، فترة الإشعار،
// تكرار الدفعات وقيمتها، وجدول الدفعات إن طُبع. نفس عقد
// invoiceAnalysis: يتطلب ANTHROPIC_API_KEY وإلا { ok:false, status:503 }.

export const FILE_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
// حروف base64؛ ≈ 3MB من الملف الخام — الطلبات الأكبر تصطدم بحد الجسم
// (4.5MB) على الخادم أصلًا.
export const MAX_FILE_BASE64 = 4 * 1024 * 1024;

const LEASE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "contract_number",
    "lessor_name",
    "lessor_vat_number",
    "lessor_contact_id",
    "tenant_name",
    "location",
    "start_date",
    "end_date",
    "notice_period_days",
    "notice_period_text",
    "payment_frequency",
    "installment_amount",
    "vat_rate",
    "amount_includes_vat",
    "total_contract_value",
    "first_due_date",
    "payments",
    "currency",
    "operator_note",
  ],
  properties: {
    contract_number: { type: ["string", "null"], description: "رقم العقد كما طُبع" },
    lessor_name: {
      type: ["string", "null"],
      description: "اسم المؤجر (الطرف الأول/المالك) مصححًا إلى عربية مقروءة",
    },
    lessor_vat_number: {
      type: ["string", "null"],
      description: "الرقم الضريبي للمؤجر أرقامًا فقط (السعودية: 15 خانة تبدأ بـ3). null إن لم يُطبع",
    },
    lessor_contact_id: {
      type: ["integer", "null"],
      description: "id من قائمة الموردين/المؤجرين المرفقة عند المطابقة، وإلا null",
    },
    tenant_name: { type: ["string", "null"], description: "اسم المستأجر (الطرف الثاني)" },
    location: { type: ["string", "null"], description: "موقع/عنوان العين المؤجرة" },
    start_date: { type: ["string", "null"], description: "ميلادي YYYY-MM-DD" },
    end_date: { type: ["string", "null"], description: "ميلادي YYYY-MM-DD" },
    notice_period_days: {
      type: ["integer", "null"],
      description: "فترة الإشعار بالأيام (ثلاثة أشهر = 90)",
    },
    notice_period_text: {
      type: ["string", "null"],
      description: "نص شرط الإشعار كما ورد في العقد باختصار",
    },
    payment_frequency: {
      type: ["string", "null"],
      description:
        "تكرار الدفعات، إحدى القيم حرفيًا: monthly | quarterly | semi_annual | annual | custom — أو null",
    },
    installment_amount: {
      type: ["number", "null"],
      description: "قيمة الدفعة الواحدة قبل الضريبة",
    },
    vat_rate: { type: ["number", "null"], description: "نسبة الضريبة بالمئة، مثلًا 15" },
    amount_includes_vat: {
      type: "boolean",
      description: "true إذا كانت قيمة الدفعة المذكورة شاملة الضريبة",
    },
    total_contract_value: {
      type: ["number", "null"],
      description: "إجمالي قيمة العقد كما طُبع (شامل الضريبة إن ذُكر)",
    },
    first_due_date: {
      type: ["string", "null"],
      description: "تاريخ أول استحقاق YYYY-MM-DD (افتراضيًا تاريخ البداية)",
    },
    payments: {
      type: "array",
      description: "جدول الدفعات الصريح إن طُبع في العقد؛ وإلا مصفوفة فارغة",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["due_date", "amount", "description"],
        properties: {
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          amount: { type: "number", description: "مبلغ الدفعة كما طُبع" },
          description: { type: ["string", "null"] },
        },
      },
    },
    currency: { type: "string", description: "رمز العملة ISO، افتراضيًا SAR" },
    operator_note: {
      type: ["string", "null"],
      description: "ملاحظة عربية قصيرة للمشغّل عند وجود شك أو تحويل تواريخ. null إن كان كل شيء واضحًا",
    },
  },
};

const SYSTEM_PROMPT = `أنت خبير عقود وعقارات سعودي متخصص في قراءة عقود الإيجار التجاري (عقود إيجار، عقود «إيجار» الموحدة، اتفاقيات تأجير محلات ومستودعات ومكاتب).

يصلك مستند العقد نفسه (PDF أو صورة — قد يكون ممسوحًا بجودة ضعيفة أو متعدد الصفحات)، وأحيانًا معه نص مستخرج آليًا قد يكون مشوهًا (عربي معكوس الحروف أو مفصولها، أرقام ناقصة الفاصلة). اقرأ المستند أنت بصريًا — هو المصدر الأساسي؛ النص المستخرج مساعد ثانوي.

مهمتك استخراج بيانات العقد بدقة لملء نموذج «عقد تأجيري» في نظام المشتريات:
1. رقم العقد كما طُبع (رقم عقد إيجار/رقم المرجع)، وإلا null.
2. المؤجر = الطرف الأول/المالك/من يستلم الأجرة. المستأجر = الطرف الثاني (غالبًا «مقهى ليلة وصباح / كوارتز» أو شركة المستخدم). لا تخلط بينهما. أعد اسم المؤجر مصححًا مقروءًا في lessor_name، ورقمه الضريبي المطبوع (أرقامًا فقط) في lessor_vat_number.
3. طابق المؤجر مع القائمة المرفقة بالرقم الضريبي أولًا (مطابقة تامة)، ثم بالاسم بمرونة: تجاهل (ال) التعريف وكلمات شركة/مؤسسة/مكتب/عقارات وفروق الهمزات والتاء المربوطة والمسافات. طابق عند تشابه واضح فقط، وإلا اترك lessor_contact_id فارغًا.
4. الموقع: عنوان/وصف العين المؤجرة (المدينة، الحي، رقم المحل/الوحدة) في سطر واحد.
5. التواريخ: أعد تاريخي البداية والانتهاء بصيغة ميلادية YYYY-MM-DD. إن كان العقد بالتقويم الهجري فحوّله إلى الميلادي واذكر في operator_note أنك حوّلت تواريخ هجرية (مع الأصل). إن ذُكرت مدة العقد فقط (سنتان من تاريخ كذا) فاحسب تاريخ الانتهاء = البداية + المدة − يوم.
6. فترة الإشعار: عبارات مثل «إشعار قبل 90 يومًا»، «قبل ثلاثة أشهر من انتهاء العقد»، «إخطار كتابي قبل شهرين» → notice_period_days بالأيام (شهر = 30، ثلاثة أشهر = 90، سنة = 365) وضع النص المختصر في notice_period_text. إن لم يوجد شرط إشعار اتركهما null.
7. الدفعات: حدّد التكرار من نص العقد — «شهري» monthly، «كل ثلاثة أشهر/ربع سنوي» quarterly، «على دفعتين/نصف سنوي» semi_annual، «دفعة واحدة سنويًا» annual. إذا ذُكر إيجار سنوي «يُدفع على دفعتين» فالتكرار semi_annual وقيمة الدفعة = السنوي ÷ 2؛ «على أربع دفعات» quarterly والدفعة = السنوي ÷ 4؛ وهكذا. installment_amount = قيمة الدفعة الواحدة قبل الضريبة.
8. الضريبة: إذا ذُكرت ضريبة القيمة المضافة منفصلة (15%) فـ amount_includes_vat=false وvat_rate=15. إذا نصّ العقد أن المبلغ «شامل ضريبة القيمة المضافة» فـ amount_includes_vat=true. إذا لم تُذكر الضريبة إطلاقًا فاترك vat_rate=15 وamount_includes_vat=false واذكر ذلك في operator_note.
9. إذا طبع العقد جدول دفعات صريحًا (تواريخ ومبالغ لكل دفعة) فأعده كاملًا في payments بترتيب التاريخ، وإذا كانت المبالغ أو الفترات غير منتظمة فاجعل payment_frequency="custom". إن لم يُطبع جدول فاترك payments مصفوفة فارغة وأعد first_due_date (غالبًا تاريخ البداية أو تاريخ توقيع العقد).
10. total_contract_value = إجمالي قيمة العقد كما طُبع (لكل المدة) إن ذُكر، وإلا null. لا تحسبه من عندك.
11. لا تخترع أرقامًا أو تواريخ لا يدعمها المستند. أرقام السجل التجاري والهواتف والصكوك ورقم الوحدة ليست مبالغ. عند أي شك أو تعارض بين صفحات العقد اذكره باختصار في operator_note.

أرجع JSON فقط حسب المخطط.`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value) {
  const text = String(value || "").trim();
  return DATE_RE.test(text) ? text : null;
}

function cleanText(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function cleanAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function cleanInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// تطبيع عربي للمطابقة بالاسم: الهمزات، التاء المربوطة، «ال»، كلمات
// الكيان، المسافات (نفس invoiceAnalysis مع كلمات العقارات).
function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/(^|\s)(شركه|مؤسسه|محل|مصنع|متجر|مكتب|عقارات|العقاريه|مقهى)(\s|$)/g, " ")
    .replace(/(^|\s)ال(?=\S)/g, "$1")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

// تشغيل التحليل الكامل: { ok:true, analysis } أو { ok:false, status, error }.
export async function runLeaseContractAnalysis({
  fileBase64 = "",
  mediaType = "",
  text = "",
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: "التحليل الذكي غير مفعّل — أضف ANTHROPIC_API_KEY",
    };
  }
  const trimmedText = String(text || "").slice(0, 30000);
  const hasFile = fileBase64.length > 0 && FILE_MEDIA_TYPES.has(mediaType);
  if (fileBase64.length > MAX_FILE_BASE64) {
    return {
      ok: false,
      status: 413,
      error: "حجم الملف يتجاوز حد التحليل الذكي (3MB)",
    };
  }
  if (!hasFile && trimmedText.trim().length < 10) {
    return { ok: false, status: 400, error: "مستند العقد فارغ" };
  }

  await ensureLeaseSchema();
  const contacts = await sql`
    SELECT id, name, vat_number
    FROM accounting_contacts
    WHERE is_active = TRUE
    ORDER BY name
  `;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: LEASE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          // المستند أولًا — القراءة البصرية أدق من أي OCR على الممسوحات.
          ...(hasFile
            ? [
                mediaType === "application/pdf"
                  ? {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: fileBase64,
                      },
                    }
                  : {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mediaType,
                        data: fileBase64,
                      },
                    },
              ]
            : []),
          {
            type: "text",
            text:
              "## الموردون/المؤجرون المسجلون\n" +
              JSON.stringify(contacts) +
              (trimmedText.trim().length >= 10
                ? "\n\n## نص مستخرج\n" + trimmedText
                : ""),
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return { ok: false, status: 422, error: "تعذر تحليل هذا المستند" };
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    return { ok: false, status: 502, error: "رد فارغ من المحلل" };
  }
  let raw;
  try {
    raw = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, status: 502, error: "رد غير مفهوم من المحلل" };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, status: 502, error: "رد غير مفهوم من المحلل" };
  }

  // تعقيم كل حقل: تواريخ YYYY-MM-DD وإلا null، مبالغ ≥ 0، تكرار من القائمة.
  const payments = Array.isArray(raw.payments)
    ? raw.payments
        .map((entry) => ({
          due_date: cleanDate(entry?.due_date),
          amount: cleanAmount(entry?.amount) ?? 0,
          description: cleanText(entry?.description, 300),
        }))
        .filter((entry) => entry.amount > 0)
    : [];

  const frequency = LEASE_FREQUENCIES.includes(raw.payment_frequency)
    ? raw.payment_frequency
    : payments.length > 0
      ? "custom"
      : "monthly";

  const vatRateRaw = Number(raw.vat_rate);
  const vatRate =
    Number.isFinite(vatRateRaw) && vatRateRaw >= 0 && vatRateRaw <= 100
      ? Math.round(vatRateRaw * 100) / 100
      : null;

  const analysis = {
    contract_number: cleanText(raw.contract_number, 120),
    lessor_name: cleanText(raw.lessor_name, 300),
    lessor_vat_number: digitsOnly(raw.lessor_vat_number) || null,
    lessor_contact_id: Number.isInteger(raw.lessor_contact_id) ? raw.lessor_contact_id : null,
    tenant_name: cleanText(raw.tenant_name, 300),
    location: cleanText(raw.location, 300),
    start_date: cleanDate(raw.start_date),
    end_date: cleanDate(raw.end_date),
    notice_period_days: cleanInt(raw.notice_period_days),
    notice_period_text: cleanText(raw.notice_period_text, 300),
    payment_frequency: frequency,
    installment_amount: cleanAmount(raw.installment_amount),
    vat_rate: vatRate,
    amount_includes_vat: raw.amount_includes_vat === true,
    total_contract_value: cleanAmount(raw.total_contract_value),
    first_due_date: cleanDate(raw.first_due_date),
    payments,
    currency: cleanText(raw.currency, 8)?.toUpperCase() || "SAR",
    operator_note: cleanText(raw.operator_note, 1000),
  };

  // نهاية قبل بداية = قراءة خاطئة؛ أفرغ النهاية ونبّه.
  if (analysis.start_date && analysis.end_date && analysis.end_date < analysis.start_date) {
    analysis.end_date = null;
    const note = "تاريخ الانتهاء المقروء قبل تاريخ البداية — تحقق من التواريخ.";
    analysis.operator_note = analysis.operator_note
      ? `${analysis.operator_note} ${note}`
      : note;
  }

  // المطابقة على الخادم: المعرّف لا بد أن يكون حقيقيًا؛ ثم الرقم
  // الضريبي (مطابقة أرقام تامة)؛ ثم الاسم المطبَّع.
  const contactIds = new Set(contacts.map((contact) => contact.id));
  if (analysis.lessor_contact_id && !contactIds.has(analysis.lessor_contact_id)) {
    analysis.lessor_contact_id = null;
  }
  if (!analysis.lessor_contact_id && analysis.lessor_vat_number) {
    const hit = contacts.find(
      (contact) =>
        digitsOnly(contact.vat_number) &&
        digitsOnly(contact.vat_number) === analysis.lessor_vat_number,
    );
    if (hit) analysis.lessor_contact_id = hit.id;
  }
  if (!analysis.lessor_contact_id && analysis.lessor_name) {
    const target = normalizeName(analysis.lessor_name);
    if (target.length >= 3) {
      const hit = contacts.find((contact) => {
        const name = normalizeName(contact.name);
        return (
          name.length >= 3 &&
          (name === target || name.includes(target) || target.includes(name))
        );
      });
      if (hit) analysis.lessor_contact_id = hit.id;
    }
  }

  return { ok: true, analysis };
}
