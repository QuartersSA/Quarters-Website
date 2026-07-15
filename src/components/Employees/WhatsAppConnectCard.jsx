"use client";

import { useState } from "react";
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

  const statusQuery = useQuery({
    queryKey: queryKeys.whatsappStatus(),
    refetchInterval: (query) =>
      query.state.data?.provider === "baileys" &&
      !query.state.data?.connected
        ? 5000
        : false,
    queryFn: async () => {
      const response = await authedFetch("/api/whatsapp/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل قراءة الحالة");
      return data;
    },
  });
  const status = statusQuery.data || null;

  if (!status || status.provider !== "baileys") return null;

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
    </div>
  );
}
