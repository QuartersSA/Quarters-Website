import { Send } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function MonthEmptyCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      اختر الشهر لعرض المسير.
      <div className="mt-3">
        <a
          href="/hr/deductions"
          className={`${ws.btnNeutral} px-4 py-2 inline-flex`}
        >
          الذهاب إلى الخصميات (HR)
        </a>
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      جاري التحميل…
    </div>
  );
}

export function ErrorCard({ message }) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-red-300`}>
      {message}
    </div>
  );
}

export function NoRunCard({ monthHint, onRebuild, isRebuilding }) {
  return (
    <>
      <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
        لا يوجد مسير محفوظ لهذا الشهر ({monthHint}).
        <div className="text-white/50 text-sm mt-2">
          اضغط "تحديث مسير الرواتب" من الأسفل لإنشاء المسير لهذا الشهر.
        </div>
      </div>
      <div className={`${ws.glassSoft} ${ws.card} p-4`}>
        <button
          type="button"
          onClick={onRebuild}
          disabled={isRebuilding}
          className={`${ws.btnPrimary} px-5 py-2.5 justify-center w-full sm:w-auto`}
        >
          <Send className="w-4 h-4" />
          <span className="font-semibold">
            {isRebuilding ? "جاري إنشاء المسير…" : "إنشاء/تحديث مسير الرواتب"}
          </span>
        </button>
      </div>
    </>
  );
}

export function LoginCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      لازم تسجيل دخول الإدارة أولًا.
      <div className="mt-2">
        <a
          href="/admin/login"
          className={`${ws.btnPrimary} px-4 py-2 inline-flex`}
        >
          تسجيل دخول الإدارة
        </a>
      </div>
    </div>
  );
}

export function NotAccountingCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
      هذه الصفحة للمحاسبة فقط.
    </div>
  );
}
