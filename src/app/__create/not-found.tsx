import { ArrowRight, Home, MapPinOff } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ws } from "@/components/Workspace/ui";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className={`min-h-[100svh] px-4 py-10 flex items-center justify-center ${ws.appBg}`}
      dir="rtl"
    >
      <main className="w-full max-w-lg text-center">
        <div
          className={`${ws.iconBox} w-16 h-16 mx-auto mb-5 text-amber-700 dark:text-amber-200`}
        >
          <MapPinOff className="w-8 h-8" aria-hidden="true" />
        </div>

        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">
          404
        </p>
        <h1 className={`text-2xl sm:text-3xl ${ws.title} mb-3`}>
          الصفحة غير موجودة
        </h1>
        <p className={`${ws.muted} leading-7 mb-7`}>
          قد يكون الرابط غير صحيح أو تم نقل الصفحة إلى مكان آخر.
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`${ws.btnNeutral} min-h-11 px-5 py-2.5 justify-center`}
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            رجوع
          </button>
          <Link
            to="/"
            className={`${ws.btnPrimary} min-h-11 px-5 py-2.5 justify-center`}
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            الصفحة الرئيسية
          </Link>
        </div>
      </main>
    </div>
  );
}
