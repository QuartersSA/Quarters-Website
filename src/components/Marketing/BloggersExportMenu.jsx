"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, Image as ImageIcon, ChevronDown } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import {
  exportBloggersData,
  exportInvitationImage,
  exportInvitationsZip,
} from "@/utils/marketingExport";

/**
 * Three-way export menu for the bloggers list:
 *   - تصدير الدعوات (كل البلوقرز) → ZIP of PNGs
 *   - تصدير دعوة بلوقر واحد → single PNG
 *   - تصدير بيانات البلوقرز → Excel
 *
 * The dropdown panel is rendered via a portal into document.body so it
 * escapes any parent stacking context (the toolbar card uses
 * backdrop-filter, which would otherwise trap z-index and cause the
 * panel to appear behind the table below).
 */
export default function BloggersExportMenu({ bloggers, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(null); // "zip" | "single" | "data" | null
  const [progress, setProgress] = useState(null); // {done, total}
  const [error, setError] = useState(null);
  const [panelPos, setPanelPos] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  // Settings are needed for image exports (accent / cream / wordmark).
  const settingsQuery = useQuery({
    queryKey: ["marketing-settings"],
    enabled: open,
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/settings");
      if (!r.ok) throw new Error("فشل تحميل الإعدادات");
      return r.json();
    },
    staleTime: 60_000,
  });

  // Position the floating panel under the button. Recompute on open,
  // resize, and scroll so the menu tracks the button.
  useLayoutEffect(() => {
    if (!open) return;
    const recompute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // 288px wide menu (w-72). Anchor right edge of menu to right edge
      // of button (RTL: button is on the right side of toolbar).
      setPanelPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      const insideButton = buttonRef.current?.contains(e.target);
      const insidePanel = panelRef.current?.contains(e.target);
      if (!insideButton && !insidePanel) {
        setOpen(false);
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const list = Array.isArray(bloggers) ? bloggers : [];
  const settings = settingsQuery.data?.settings || null;

  const handleZip = async () => {
    if (busy) return;
    setError(null);
    setBusy("zip");
    setProgress({ done: 0, total: list.length });
    try {
      await exportInvitationsZip(list, settings, undefined, (done, total) =>
        setProgress({ done, total }),
      );
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("تعذّر تصدير الدعوات");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const handleSingle = async (b) => {
    if (busy) return;
    setError(null);
    setBusy("single");
    try {
      await exportInvitationImage(b, settings);
      setOpen(false);
      setShowPicker(false);
    } catch (err) {
      console.error(err);
      setError("تعذّر تصدير الدعوة");
    } finally {
      setBusy(null);
    }
  };

  const handleData = () => {
    if (busy) return;
    setError(null);
    setBusy("data");
    try {
      exportBloggersData(list);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("تعذّر تصدير البيانات");
    } finally {
      setBusy(null);
    }
  };

  const isDisabled = disabled || list.length === 0;

  const panel =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            dir="rtl"
            style={{
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              width: 288,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
              padding: 8,
            }}
          >
            <button
              type="button"
              onClick={handleZip}
              disabled={!!busy}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-xl text-right hover:bg-white/[0.06] disabled:opacity-50"
            >
              <div className={`${ws.iconBox} w-9 h-9 text-pink-200 shrink-0`}>
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold text-sm">
                  تصدير الدعوات (كل البلوقرز)
                </div>
                <div className="text-white/55 text-xs mt-0.5">
                  ملف ZIP يحتوي صورة لكل بلوقر باسمه
                </div>
                {busy === "zip" && progress ? (
                  <div className="text-amber-200 text-xs mt-1">
                    جاري التصدير… {progress.done} / {progress.total}
                  </div>
                ) : null}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              disabled={!!busy}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-xl text-right hover:bg-white/[0.06] disabled:opacity-50"
            >
              <div className={`${ws.iconBox} w-9 h-9 text-emerald-200 shrink-0`}>
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-semibold text-sm flex items-center justify-between gap-2">
                  <span>تصدير دعوة بلوقر واحد</span>
                  <ChevronDown
                    className={`w-4 h-4 opacity-60 transition-transform ${showPicker ? "rotate-180" : ""}`}
                  />
                </div>
                <div className="text-white/55 text-xs mt-0.5">
                  اختر البلوقر من القائمة
                </div>
              </div>
            </button>

            {showPicker ? (
              <div className="mt-1 mb-1 max-h-64 overflow-y-auto border border-white/10 rounded-xl bg-black/30">
                {list.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSingle(b)}
                    disabled={!!busy}
                    className="w-full text-right px-3 py-2 hover:bg-white/[0.06] disabled:opacity-50 border-b border-white/5 last:border-b-0"
                  >
                    <div className="text-white text-sm font-medium truncate">
                      {b.name}
                    </div>
                    {b.handle ? (
                      <div className="text-white/45 text-xs" dir="ltr">
                        @{b.handle}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleData}
              disabled={!!busy}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-xl text-right hover:bg-white/[0.06] disabled:opacity-50"
            >
              <div className={`${ws.iconBox} w-9 h-9 text-sky-200 shrink-0`}>
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold text-sm">
                  تصدير بيانات البلوقرز
                </div>
                <div className="text-white/55 text-xs mt-0.5">
                  Excel: الاسم، الحساب، الحالة، وقت التفعيل
                </div>
              </div>
            </button>

            {error ? (
              <div className="px-3 py-2 text-xs text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl mt-1">
                {error}
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isDisabled}
        className={`${ws.btnNeutral} px-4 py-2.5 ${
          isDisabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <Download className="w-4 h-4" />
        <span>تصدير</span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </button>
      {panel}
    </>
  );
}
