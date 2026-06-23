"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function ConnectionStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed top-3 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg dark:bg-amber-950 dark:text-amber-100"
      role="status"
      dir="rtl"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      لا يوجد اتصال بالإنترنت. ستُحدّث البيانات عند عودة الاتصال.
    </div>
  );
}
