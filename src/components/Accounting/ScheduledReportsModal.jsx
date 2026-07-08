"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { authedFetch } from "@/utils/apiAuth";

/**
 * التقارير المجدولة — ملخص مشتريات يصل واتساب تلقائياً:
 * أسبوعي (صباح كل اثنين عن الأسبوع الماضي) أو شهري (صباح أول الشهر
 * عن الشهر الماضي). مجدول داخل عملية الخادم يفحص كل 5 دقائق ويرسل
 * بعد 8:00 صباحاً بتوقيت الرياض — يصل في وقته دون أن يفتح أحد
 * النظام. «أرسل الآن» يرسل ملخص آخر 30 يوماً للاختبار.
 */

const SCHEDULES_KEY = ["scheduled-purchase-reports"];

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "شهري — صباح أول الشهر عن الشهر الماضي" },
  { value: "weekly", label: "أسبوعي — صباح كل اثنين عن الأسبوع الماضي" },
];

const EMPTY_FORM = {
  id: null,
  title: "",
  frequency: "monthly",
  phone: "",
  is_active: true,
};

export default function ScheduledReportsModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const [sendNote, setSendNote] = useState(null);

  const schedulesQuery = useQuery({
    queryKey: SCHEDULES_KEY,
    enabled: open,
    queryFn: async () => {
      const response = await authedFetch(
        "/api/accounting/scheduled-purchase-reports",
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل التحميل");
      return data;
    },
  });
  const schedules = schedulesQuery.data?.schedules || [];
  const whatsappConfigured = schedulesQuery.data?.whatsappConfigured !== false;

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      const response = await authedFetch(
        "/api/accounting/scheduled-purchase-reports",
        {
          method: payload.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل الحفظ");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY });
      setForm(null);
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const response = await authedFetch(
        `/api/accounting/scheduled-purchase-reports?id=${id}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل الحذف");
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  });

  const sendNow = async (schedule) => {
    setSendingId(schedule.id);
    setSendNote(null);
    try {
      const response = await authedFetch(
        "/api/accounting/scheduled-purchase-reports",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send-now", id: schedule.id }),
        },
      );
      const data = await response.json().catch(() => ({}));
      setSendNote(
        response.ok
          ? { ok: true, text: `أُرسل «${schedule.title}» بنجاح` }
          : { ok: false, text: data?.error || "فشل الإرسال" },
      );
    } catch {
      setSendNote({ ok: false, text: "فشل الاتصال بالخادم" });
    } finally {
      setSendingId(null);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const submitForm = (event) => {
    event.preventDefault();
    if (saveMut.isPending) return;
    saveMut.mutate({
      id: form.id || undefined,
      title: form.title,
      frequency: form.frequency,
      phone: form.phone,
      is_active: form.is_active,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`${ws.glass} ${ws.card} w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}>
        <div className={`sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-[#0e7a5f] dark:text-emerald-200`}>
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                جدولة تقارير واتساب
              </div>
              <div className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5">
                يصل تلقائياً صباح موعده — بعد 8:00 بتوقيت الرياض.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!whatsappConfigured ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              خدمة واتساب غير مفعلة على الخادم — الجدولة ستُحفظ لكن لن
              تُرسل حتى ضبط WASENDER_API_KEY.
            </div>
          ) : null}

          {form ? (
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                  اسم التقرير <span className="text-rose-600">*</span>
                </div>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="مثال: ملخص المشتريات للإدارة"
                  className={`${ws.input} px-3 py-2`}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    التكرار
                  </div>
                  <GlassSelect
                    value={form.frequency}
                    onChange={(value) => setForm({ ...form, frequency: value })}
                    options={FREQUENCY_OPTIONS}
                    buttonClassName="text-sm py-2 px-3"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    رقم واتساب <span className="text-rose-600">*</span>
                  </div>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    placeholder="05xxxxxxxx"
                    className={`${ws.input} px-3 py-2 text-left`}
                    dir="ltr"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm({ ...form, is_active: event.target.checked })
                  }
                  className="accent-[#0e7a5f]"
                />
                الجدولة فعّالة
              </label>
              {error ? (
                <div className="text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saveMut.isPending}
                  className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50`}
                >
                  {saveMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {form.id ? "حفظ التعديلات" : "إضافة الجدولة"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(null);
                    setError("");
                  }}
                  className={`${ws.btnNeutral} px-4 py-2`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-white/45">
                  {schedules.length} جدولة
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setForm({ ...EMPTY_FORM });
                  }}
                  className={`${ws.btnPrimary} px-3 py-2 text-xs`}
                >
                  <Plus className="w-4 h-4" />
                  جدولة جديدة
                </button>
              </div>

              {sendNote ? (
                <div
                  className={`text-xs ${sendNote.ok ? "text-[#0e7a5f] dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
                >
                  {sendNote.text}
                </div>
              ) : null}

              {schedulesQuery.isLoading ? (
                <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                  جاري التحميل…
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="w-8 h-8 mx-auto text-slate-400 dark:text-white/30 mb-2" />
                  <div className="text-sm text-slate-600 dark:text-white/60">
                    لا توجد جدولات — أضف جدولة ليصل ملخص المشتريات
                    واتساب تلقائياً.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`${ws.glassSoft} ${ws.card} px-3.5 py-3 flex items-center gap-3 ${schedule.is_active === false ? "opacity-60" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {schedule.title}
                          {schedule.is_active === false ? (
                            <span className="mr-2 text-[10px] font-normal text-slate-500 dark:text-white/45">
                              (موقوفة)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            {schedule.frequency === "weekly" ? "أسبوعي" : "شهري"}
                          </span>
                          <span>•</span>
                          <span dir="ltr">{schedule.phone}</span>
                          {schedule.last_sent_at ? (
                            <>
                              <span>•</span>
                              <span dir="ltr">آخر إرسال {schedule.last_sent_at}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => sendNow(schedule)}
                          disabled={sendingId === schedule.id}
                          className={`${ws.btnNeutral} px-2.5 py-1.5 text-[11px] disabled:opacity-50`}
                          title="إرسال ملخص آخر 30 يوماً الآن"
                        >
                          {sendingId === schedule.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          أرسل الآن
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setForm({
                              id: schedule.id,
                              title: schedule.title || "",
                              frequency: schedule.frequency || "monthly",
                              phone: schedule.phone || "",
                              is_active: schedule.is_active !== false,
                            });
                          }}
                          className={`${ws.iconButton} w-8 h-8`}
                          title="تعديل"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(`حذف جدولة «${schedule.title}»؟`)
                            ) {
                              deleteMut.mutate(schedule.id);
                            }
                          }}
                          className={`${ws.iconButton} w-8 h-8 hover:text-red-700 dark:hover:text-red-200`}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
