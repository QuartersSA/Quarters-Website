import sql from "@/app/api/utils/sql";

// واتساب مستضاف ذاتياً عبر Baileys — بلا وسيط ولا اشتراك:
// الخادم نفسه «جهاز مرتبط» بحساب واتساب الرقم المخصص، متصل بسيرفرات
// واتساب مباشرة عبر WebSocket (بلا متصفح).
//
// - جلسة الاقتران (المفاتيح والاعتمادات) محفوظة في Postgres فتنجو
//   من إعادة النشر على Railway — الاقتران مرة واحدة فقط.
// - الاقتران برمز 8 خانات (أسهل من QR): الجوال ← الأجهزة المرتبطة
//   ← ربط بجهاز ← «الربط برقم الهاتف بدلاً من ذلك».
// - إعادة اتصال تلقائية عند الانقطاع؛ «تسجيل الخروج» من الجوال
//   يمسح الجلسة ويعيد الحالة إلى «يحتاج اقتراناً».
// - يُفعَّل بمتغير البيئة WHATSAPP_PROVIDER=baileys — والرجوع
//   لمزود Wasender الخارجي بتغيير المتغير فقط.
//
// تحذير تشغيلي: هذا المسار غير رسمي (خارج شروط واتساب) — استخدم
// رقماً مخصصاً للنظام لا رقم المنشأة التجاري.

let baileysPromise = null;
function loadBaileys() {
  if (!baileysPromise) baileysPromise = import("baileys");
  return baileysPromise;
}

let sock = null;
let connected = false;
let starting = null;
let stopping = false;
let lastError = null;

async function ensureAuthTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
}

// مخزن اعتمادات Baileys في Postgres — بديل useMultiFileAuthState
// الملفّي (ملفات Railway تُمسح مع كل نشر). Buffers تُرمّز عبر
// BufferJSON من المكتبة نفسها.
async function usePostgresAuthState() {
  const { initAuthCreds, BufferJSON, proto } = await loadBaileys();
  await ensureAuthTable();

  const readData = async (key) => {
    const [row] = await sql`
      SELECT value FROM whatsapp_auth_state WHERE key = ${key}
    `;
    if (!row) return null;
    try {
      return JSON.parse(row.value, BufferJSON.reviver);
    } catch {
      return null;
    }
  };
  const writeData = async (key, data) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await sql`
      INSERT INTO whatsapp_auth_state (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    `;
  };
  const removeData = async (key) => {
    await sql`DELETE FROM whatsapp_auth_state WHERE key = ${key}`;
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            if (value) data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) {
              const value = data[type][id];
              const key = `${type}-${id}`;
              if (value) await writeData(key, value);
              else await removeData(key);
            }
          }
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
  };
}

async function startSocket() {
  const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers,
  } = await loadBaileys();
  const pino = (await import("pino")).default;

  const { state, saveCreds } = await usePostgresAuthState();
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: undefined,
  }));

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
    logger: pino({ level: "warn" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      connected = true;
      lastError = null;
      console.log(
        `whatsapp (baileys) connected as ${sock?.user?.id || "unknown"}`,
      );
    }
    if (connection === "close") {
      connected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      lastError = lastDisconnect?.error?.message || null;
      if (statusCode === DisconnectReason.loggedOut) {
        // خروج من الجوال — الجلسة انتهت نهائياً: امسحها ليبدأ
        // اقتران جديد نظيف.
        console.error("whatsapp (baileys) logged out — clearing session");
        sql`DELETE FROM whatsapp_auth_state`.catch(() => {});
        sock = null;
        return;
      }
      if (!stopping) {
        // انقطاع عادي (شبكة/إعادة تشغيل سيرفرات واتساب) — أعد الاتصال.
        setTimeout(() => {
          starting = null;
          startWhatsApp().catch(() => {});
        }, 5000);
      }
    }
  });
}

export async function startWhatsApp() {
  if ((process.env.WHATSAPP_PROVIDER || "").toLowerCase() !== "baileys") {
    return;
  }
  if (!starting) {
    starting = startSocket().catch((error) => {
      console.error("whatsapp (baileys) start failed", error);
      lastError = error.message;
      starting = null;
    });
  }
  return starting;
}

export async function whatsappStatus() {
  const provider = (process.env.WHATSAPP_PROVIDER || "wasender").toLowerCase();
  let hasSession = false;
  try {
    await ensureAuthTable();
    const [row] = await sql`
      SELECT value FROM whatsapp_auth_state WHERE key = 'creds'
    `;
    hasSession = !!row && row.value.includes('"registered":true');
  } catch {
    // ignore
  }
  return {
    provider,
    connected,
    phone: connected && sock?.user?.id ? sock.user.id.split(":")[0] : null,
    hasSession,
    lastError,
  };
}

// رمز الاقتران — يتطلب socket غير مقترن بعد. النتيجة 8 خانات تُدخل
// في جوال الرقم المخصص خلال ~دقيقة.
export async function requestWhatsAppPairingCode(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) {
    throw new Error("رقم غير صالح — أدخله بالصيغة الدولية مثل 9665xxxxxxxx");
  }
  await startWhatsApp();
  // مهلة قصيرة حتى يفتح الـsocket قناته قبل طلب الرمز.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  if (!sock) throw new Error("تعذر تشغيل اتصال واتساب — راجع سجلات الخادم");
  if (connected) {
    throw new Error("الرقم مقترن ومتصل بالفعل — لا حاجة لاقتران جديد");
  }
  const code = await sock.requestPairingCode(digits);
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// الإرسال — نفس عقد Wasender: { ok, error? }.
export async function sendViaBaileys({ to, text }) {
  if (!sock || !connected) {
    return {
      ok: false,
      error:
        "واتساب غير متصل — اربط الرقم من «جدولة واتساب» في تقارير المشتريات",
    };
  }
  try {
    await sock.sendMessage(`${to}@s.whatsapp.net`, { text: String(text) });
    return { ok: true };
  } catch (error) {
    console.error("whatsapp (baileys) send failed", error);
    return { ok: false, error: `فشل الإرسال: ${error.message}` };
  }
}
