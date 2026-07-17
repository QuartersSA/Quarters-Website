"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/ui";
import { authedFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

/**
 * بطاقة ربط واتساب — في صفحة إدارة الموظفين لأنها مركز الإشعارات:
 * هنا يُقترن رقم النظام (الاستضافة الذاتية Baileys) وهنا تُضبط
 * تفضيلات كل موظف من نافذته.
 *
 * تظهر فقط عندما WHATSAPP_PROVIDER=baileys على الخادم؛ مع مزود خارجي
 * (Wasender) لا حاجة لاقتران فتختفي.
 */
export function WhatsAppConnectCard() {
  const [pairPhone, setPairPhone] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairCode, setPairCode] = useState(null);
  const [pairError, setPairError] = useState("");
  // رسالة تجريبية بعد الاقتران — لأي رقم غير الرقم المقترن.
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.whatsappStatus(),
    // غير متصل: استطلاع سريع (3 ثوانٍ) لالتقاط اكتمال الاقتران؛
    // متصل: استطلاع مريح (30 ثانية) حتى يظهر أي انقطاع تلقائياً
    // بدل بقاء «متصل» قديمة على الشاشة حتى التحديث اليدوي.
    refetchInterval: (query) =>
      query.state.data?.provider !== "baileys"
        ? false
        : query.state.data?.connected
          ? 30000
          : 3000,
    queryFn: async () => {
      const response = await authedFetch("/api/whatsapp/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل قراءة الحالة");
      return data;
    },
  });
  const status = statusQuery.data || null;

  // الرقم الثابت: آخر رقم مقترن محفوظ في القاعدة يعبّي الخانة
  // تلقائياً — ما يضيع بإعادة تحميل الصفحة أو انقطاع الجلسة.
  useEffect(() => {
    if (status?.pairedPhone && !pairPhone) {
      setPairPhone(String(status.pairedPhone));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.pairedPhone]);

  // أثناء التحميل أو عند فشل القراءة لا نعرض شيئاً؛ أما مزود غير
  // ذاتي فنعرض بطاقة إرشادية بدل الاختفاء الصامت.
  if (!status) return null;

  if (status.provider !== "baileys") {
    return (
      <div className={`${ws.glass} ${ws.card} p-4 mb-6`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`${ws.iconBox} w-10 h-10 text-slate-500 dark:text-white/50 shrink-0`}>
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 dark:text-white">
              إشعارات واتساب — الاستضافة الذاتية غير مفعّلة
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5 leading-relaxed">
              الإرسال حالياً عبر المزود الخارجي (Wasender). للتحول للربط
              الذاتي المجاني: أضف المتغير{" "}
              <code className="font-mono text-[11px] bg-slate-100 dark:bg-white/10 px-1 py-0.5 rounded" dir="ltr">
                WHATSAPP_PROVIDER=baileys
              </code>{" "}
              في متغيرات الخادم (Railway ← Variables) وأعد النشر — ثم
              ارجع هنا لربط الرقم برمز الاقتران.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sendTest = async () => {
    if (!testPhone.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await authedFetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل الإرسال");
      setTestResult({ ok: true, text: "أُرسلت — تحقق من وصولها للرقم." });
    } catch (error) {
      setTestResult({ ok: false, text: error.message });
    } finally {
      setTesting(false);
    }
  };

  const requestPairing = async () => {
    if (!pairPhone.trim() || pairing) return;
    setPairing(true);
    setPairError("");
    setPairCode(null);
    try {
      const response = await authedFetch("/api/whatsapp/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pairPhone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل طلب الرمز");
      setPairCode(data.code);
    } catch (error) {
      setPairError(error.message);
    } finally {
      setPairing(false);
    }
  };

  return (
    <div className={`${ws.glass} ${ws.card} p-4 mb-6`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200 shrink-0`}>
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 dark:text-white">
            إشعارات واتساب — ربط رقم النظام
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
            {status.connected
              ? "متصل — تفضيلات الإشعارات تُضبط من نافذة كل موظف أدناه."
              : "أدخل رقم الواتساب المخصص للنظام واطلب رمز الاقتران، ثم في جوال الرقم: الإعدادات ← الأجهزة المرتبطة ← ربط بجهاز ← «الربط برقم الهاتف بدلاً من ذلك»."}
          </div>
        </div>

        {status.connected ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            متصل
            {status.phone ? (
              <span className="font-mono text-xs" dir="ltr">
                +{status.phone}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            غير متصل
            {status.pairedPhone ? (
              <span className="font-mono text-xs text-slate-500 dark:text-white/45" dir="ltr">
                +{status.pairedPhone}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        {status.connected ? null : (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="tel"
              value={pairPhone}
              onChange={(event) => setPairPhone(event.target.value)}
              placeholder="9665xxxxxxxx"
              className={`${ws.input} px-2.5 py-1.5 text-sm w-44 text-left`}
              dir="ltr"
            />
            <button
              type="button"
              onClick={requestPairing}
              disabled={!pairPhone.trim() || pairing}
              className={`${ws.btnPrimary} px-3 py-1.5 text-xs disabled:opacity-50`}
            >
              {pairing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              اطلب رمز الاقتران
            </button>
          </div>
        )}
      </div>

      {/* تقييد واتساب على الحساب: قفل «المحادثات الجديدة» (رمز 463) —
          الخادم يقبل الرسالة ثم يسقطها لكل مستلم لم يراسل الرقم من
          قبل. الحل: كل مستلم جديد يرسل رسالة واحدة لرقم النظام. */}
      {status.connected &&
      (status.reachoutTimelock?.isActive ||
        /capped|restricted|locked|exhausted/i.test(
          String(status.newChatCap?.capping_status || ""),
        )) ? (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
          <span className="font-bold">تنبيه — الرقم مقيّد من فتح محادثات جديدة: </span>
          واتساب يقبل الرسائل ثم لا يسلّمها لأي رقم لم يراسل هذا الحساب
          من قبل (حماية الأرقام الحديثة). العلاج: اطلب من كل موظف جديد
          إرسال رسالة واحدة (مثل «مرحبا») إلى رقم النظام — بعدها تصله
          الإشعارات دائماً. تكرار المحاولات قبل ذلك يطيل مدة التقييد.
          <div className="mt-1.5 font-semibold">
            {status.reachoutTimelock?.timeEnforcementEnds ? (
              <>
                ⏳ ينتهي القيد:{" "}
                {new Intl.DateTimeFormat("ar-SA", {
                  timeZone: "Asia/Riyadh",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(status.reachoutTimelock.timeEnforcementEnds))}
                {(() => {
                  const remainingH = Math.max(
                    0,
                    Math.round(
                      (new Date(status.reachoutTimelock.timeEnforcementEnds) -
                        Date.now()) /
                        3600000,
                    ),
                  );
                  return remainingH > 0 ? ` (متبقي ≈ ${remainingH} ساعة)` : "";
                })()}
              </>
            ) : (
              "⏳ لم يعلن واتساب موعد انتهاء القيد — يرتفع تلقائياً عادة خلال 1–3 أيام من التوقف الكامل عن مراسلة الأرقام الجديدة."
            )}
            {Number(status.newChatCap?.total_quota) > 0 ? (
              <div className="mt-0.5 font-normal">
                حصة المحادثات الجديدة: {Number(status.newChatCap.used_quota) || 0}
                {" / "}
                {Number(status.newChatCap.total_quota)}
                {status.newChatCap.cycle_end_timestamp
                  ? ` — تتجدد ${new Intl.DateTimeFormat("ar-SA", {
                      timeZone: "Asia/Riyadh",
                      day: "numeric",
                      month: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(Number(status.newChatCap.cycle_end_timestamp) * 1000))}`
                  : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* اختبار الإرسال — متاح دائماً؛ عند عدم الاتصال يرجع الخطأ
          الفعلي بدل النجاح الصامت. */}
      {(
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <span className="text-[11px] font-bold text-slate-600 dark:text-white/55 shrink-0">
            اختبار الإرسال:
          </span>
          <input
            type="tel"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
            placeholder="05xxxxxxxx — رقم المستلم"
            className={`${ws.input} px-2.5 py-1.5 text-sm w-52 text-left`}
            dir="ltr"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={!testPhone.trim() || testing}
            className={`${ws.btnNeutral} px-3 py-1.5 text-xs disabled:opacity-50`}
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            أرسل رسالة تجريبية
          </button>
          {testResult ? (
            <span
              className={`text-[11px] font-semibold ${testResult.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
            >
              {testResult.text}
            </span>
          ) : null}
        </div>
      )}

      {!status.connected && pairCode ? (
        <div className="text-center py-2 mt-2 border-t border-slate-200 dark:border-white/10">
          <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1 mt-2">
            أدخل هذا الرمز في جوال الرقم خلال دقيقة:
          </div>
          <div
            className="text-2xl font-bold font-mono tracking-widest text-emerald-800 dark:text-emerald-200"
            dir="ltr"
          >
            {pairCode}
          </div>
        </div>
      ) : null}
      {!status.connected && pairError ? (
        <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-2">
          {pairError}
        </div>
      ) : null}
      {status.connected ? null : (
        <div className="mt-2">
          <button
            type="button"
            onClick={async () => {
              if (
                !window.confirm(
                  "مسح جلسة الواتساب بالكامل والبدء من جديد؟ ستحتاج اقتراناً جديداً.",
                )
              )
                return;
              try {
                await authedFetch("/api/whatsapp/pair", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "reset" }),
                });
                setPairCode(null);
                setPairError("");
              } catch {
                // تجاهل — الحالة ستنعكس في الاستعلام الدوري
              }
            }}
            className="text-[11px] text-slate-400 hover:text-red-600 dark:text-white/35 dark:hover:text-red-300 underline"
          >
            إعادة تعيين الجلسة والبدء من جديد
          </button>
        </div>
      )}

      {!status.connected && status.libError ? (
        <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-2 font-mono break-all" dir="ltr">
          مكتبة واتساب غير متاحة على الخادم: {status.libError} (node {status.nodeVersion})
        </div>
      ) : null}
      {!status.connected && !pairError && status.lastError ? (
        <div className="text-[11px] text-slate-400 dark:text-white/35 mt-2" dir="ltr">
          آخر خطأ اتصال: {status.lastError}
        </div>
      ) : null}
    </div>
  );
}
