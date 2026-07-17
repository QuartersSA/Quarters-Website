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
      const phone = sock?.user?.id ? sock.user.id.split(":")[0] : null;
      if (phone) writePairedPhone(phone).catch(() => {});
      console.log(
        `whatsapp (baileys) connected as ${sock?.user?.id || "unknown"}`,
      );
    }
    if (connection === "close") {
      connected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      lastError = lastDisconnect?.error?.message || null;
      if (statusCode === DisconnectReason.loggedOut) {
        // خروج من الجوال — الجلسة انتهت نهائياً: امسحها (مع إبقاء
        // الرقم المحفوظ) ليبدأ اقتران جديد نظيف.
        console.error("whatsapp (baileys) logged out — clearing session");
        sql`DELETE FROM whatsapp_auth_state WHERE key <> 'paired_phone'`.catch(
          () => {},
        );
        sock = null;
        return;
      }
      if (!stopping) {
        // انتهت محاولات QR بلا اقتران؟ لا تعد فتح قناة غير مقترنة
        // للأبد (هدر + احتمال تقييد) — انتظر طلب رمز جديد من البطاقة.
        if (/QR refs attempts ended/i.test(lastDisconnect?.error?.message || "")) {
          sock = null;
          starting = null;
          return;
        }
        // «conflict/replaced» = نسخة خادم أخرى تستخدم الجلسة (تداخل
        // نشر Railway: الحاوية الجديدة تعمل قبل موت القديمة) — أمهل
        // 45 ثانية حتى تموت المنافسة ثم اخطف الجلسة بهدوء. غير ذلك
        // انقطاع عادي: أعد خلال 5 ثوانٍ.
        const isConflict =
          statusCode === DisconnectReason.connectionReplaced ||
          statusCode === 440 ||
          /conflict|replaced/i.test(lastDisconnect?.error?.message || "");
        const delay = isConflict ? 45000 : 5000;
        if (isConflict) {
          console.error(
            "whatsapp (baileys) session conflict — another instance holds it; retrying in 45s",
          );
        }
        setTimeout(() => {
          starting = null;
          startWhatsApp().catch(() => {});
        }, delay);
      }
    }
  });
}

// الرقم المقترن يبقى محفوظاً في القاعدة — يظهر في البطاقة دائماً
// حتى بعد الانقطاع أو إعادة النشر أو إعادة تعيين الجلسة.
async function writePairedPhone(digits) {
  await ensureAuthTable();
  await sql`
    INSERT INTO whatsapp_auth_state (key, value)
    VALUES ('paired_phone', ${JSON.stringify(String(digits))})
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
  `;
}

async function readPairedPhone() {
  try {
    const [row] = await sql`
      SELECT value FROM whatsapp_auth_state WHERE key = 'paired_phone'
    `;
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

// إيقاف Railway للحاوية القديمة عند النشر يرسل SIGTERM — نحرر جلسة
// واتساب فوراً حتى لا تتصارع مع النسخة الجديدة (سبب Stream Errored
// conflict الذي يفصل الرقم بعد كل نشر).
let sigtermHooked = false;
function hookGracefulRelease() {
  if (sigtermHooked) return;
  sigtermHooked = true;
  const release = () => {
    stopping = true;
    try {
      sock?.end?.(new Error("instance shutting down"));
    } catch {
      // ignore
    }
  };
  process.once("SIGTERM", release);
  process.once("SIGINT", release);
}

export async function startWhatsApp() {
  if ((process.env.WHATSAPP_PROVIDER || "").toLowerCase() !== "baileys") {
    return;
  }
  hookGracefulRelease();
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
  // فحص تشخيصي: هل مكتبة baileys قابلة للتحميل في بيئة التشغيل هذه؟
  // (الاستيراد خارجي — يعتمد على node_modules الخادم؛ فشله هو أول
  // مشتبه به عند تعطل الاقتران في بيئة دون أخرى.)
  let libOk = false;
  let libError = null;
  if (provider === "baileys") {
    try {
      await loadBaileys();
      libOk = true;
    } catch (error) {
      libError = `${error.code || ""} ${error.message || error}`.trim();
      // أعد المحاولة في نداء لاحق بدل تعليق وعد فاشل للأبد.
      baileysPromise = null;
    }
  }
  // الرقم الثابت: من الاتصال الحي إن وُجد، وإلا آخر رقم مقترن محفوظ.
  const livePhone =
    connected && sock?.user?.id ? sock.user.id.split(":")[0] : null;
  const pairedPhone = livePhone || (await readPairedPhone());
  return {
    provider,
    connected,
    phone: livePhone,
    pairedPhone,
    hasSession,
    lastError,
    libOk,
    libError,
    nodeVersion: process.version,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// مسح الجلسة بالكامل والبدء بهوية جديدة — يُستدعى تلقائياً قبل كل
// طلب رمز اقتران (بقايا محاولة سابقة غير مكتملة تفسد الربط برسالة
// «Couldn't link device» على الجوال)، ويدوياً من زر إعادة التعيين.
export async function resetWhatsAppSession() {
  stopping = true;
  try {
    sock?.end?.(new Error("manual session reset"));
  } catch {
    // ignore
  }
  sock = null;
  connected = false;
  starting = null;
  lastError = null;
  await ensureAuthTable();
  // الرقم المحفوظ يبقى — إعادة التعيين تخص جلسة التشفير فقط.
  await sql`DELETE FROM whatsapp_auth_state WHERE key <> 'paired_phone'`;
  stopping = false;
}

// رمز الاقتران — يتطلب socket غير مقترن بعد. النتيجة 8 خانات تُدخل
// في جوال الرقم المخصص خلال ~دقيقة.
export async function requestWhatsAppPairingCode(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) {
    throw new Error("رقم غير صالح — أدخله بالصيغة الدولية مثل 9665xxxxxxxx");
  }
  // احفظ الرقم فوراً — يبقى معبأً في البطاقة مهما حدث للجلسة.
  await writePairedPhone(digits).catch(() => {});
  // اقتران نظيف دائماً: ما دام الرقم غير مقترنٍ مكتملاً، أي بقايا
  // جلسة (محاولات فاشلة، انقطاع نشر أثناء الربط) تُمسح ونبدأ بهوية
  // تشفير جديدة — هذا يمنع «Couldn't link device» على الجوال.
  if (!connected) {
    const [row] = await sql`
      SELECT value FROM whatsapp_auth_state WHERE key = 'creds'
    `;
    const registered = !!row && row.value.includes('"registered":true');
    if (!registered) {
      await resetWhatsAppSession();
    }
  }
  // انقطاعات لحظية («Connection Closed/Failure») شائعة من مضيفي
  // السحابة — حتى 3 محاولات عبر دورات إعادة الاتصال قبل الاستسلام.
  let lastAttemptError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!sock) starting = null;
    await startWhatsApp();
    // تهيئة الجلسة + جلب إصدار البروتوكول قد تستغرق ثوانيَ — انتظر
    // الجاهزية حتى 15 ثانية.
    for (let poll = 0; poll < 30 && !sock; poll += 1) {
      await sleep(500);
    }
    if (!sock) {
      lastAttemptError = new Error(lastError || "تعذر فتح الاتصال");
      await sleep(4000);
      continue;
    }
    if (connected) {
      throw new Error("الرقم مقترن ومتصل بالفعل — لا حاجة لاقتران جديد");
    }
    try {
      // مهلة قصيرة حتى تستقر القناة الجديدة قبل طلب الرمز.
      await sleep(1500);
      const code = await sock.requestPairingCode(digits);
      return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
    } catch (error) {
      lastAttemptError = error;
      // انقطع أثناء الطلب — امهل دورة إعادة الاتصال (5 ثوانٍ) وأعد.
      await sleep(6500);
    }
  }
  throw new Error(
    `تعذر توليد الرمز بعد عدة محاولات (${lastAttemptError?.message || "غير معروف"}) — الأرجح تقييد مؤقت من واتساب بسبب تكرار المحاولات: انتظر 30-60 دقيقة ثم جرّب مرة واحدة نظيفة`,
  );
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
