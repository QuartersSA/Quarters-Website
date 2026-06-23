"use client";

import { ScrollText, X, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/ui";
import { HREmployeeLogPanel } from "@/components/HR/HREmployeeLogPanel";
import { queryKeys } from "../../utils/queryKeys.js";

// Standalone log modal opened from the employees table row. The
// actual log rendering lives in HREmployeeLogPanel so it can be
// shared with the embedded view inside HREmployeeModal.
export function HREmployeeLogsModal({ isOpen, employee, onClose }) {
  const queryClient = useQueryClient();
  const employeeId = employee?.id;
  const employeeName = employee?.name;

  if (!isOpen) return null;

  const title = employeeName ? `سجل الموظف: ${employeeName}` : "سجل الموظف";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      dir="rtl"
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-3xl max-h-[90svh] overflow-hidden`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/85`}>
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </div>
              <div className="text-sm text-slate-600 dark:text-white/55">
                آخر 200 حركة
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.hrEmployeeLogs(Number(employeeId)),
                })
              }
              className={`${ws.iconButton} text-slate-700 dark:text-white/70`}
              aria-label="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.iconButton} text-slate-700 dark:text-white/70`}
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90svh-84px)]">
          <HREmployeeLogPanel employeeId={employeeId} enabled={isOpen} />
        </div>
      </div>
    </div>
  );
}
