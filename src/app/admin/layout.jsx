"use client";

import React from "react";
import {
  Briefcase,
  ClipboardList,
  Calculator,
  AlertTriangle,
  Users,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function readAdminUser() {
  try {
    const raw = localStorage.getItem("adminUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function allowedModes(adminUser) {
  // SECURITY: deny by default.
  //
  // Previously, missing/undefined permission flags were treated as "allow"
  // for backward compatibility with old DB schemas that lacked the columns.
  // That meant any schema-drift on the production DB silently granted full
  // access to every admin section. The login API now returns false (not
  // undefined) for every can_* column via COALESCE(..., false), so the
  // "missing column" scenario is no longer a real concern, and the fail-
  // open default is pure risk. Default is now `false`.
  if (!adminUser) {
    return { inventory: false, workspace: false, accounting: false, hr: false };
  }

  // HR has a legacy alias: older deployments gated HR via `can_manage_employees`.
  // Either flag grants access.
  const hrFlag = !!adminUser.can_access_hr || !!adminUser.can_manage_employees;

  // Deductions-only users get partial HR access (handled at HR page level).
  return {
    workspace: !!adminUser.can_access_workspace,
    inventory: !!adminUser.can_manage_inventory,
    accounting: !!adminUser.can_manage_accounting,
    hr: hrFlag || !!adminUser.can_manage_deductions,
  };
}

export default function AdminLayout({ children }) {
  const [showChooser, setShowChooser] = React.useState(false);
  const [noAccess, setNoAccess] = React.useState(false);

  const goInventory = React.useCallback(() => {
    try {
      localStorage.setItem("adminMode", "inventory");
      localStorage.removeItem("workspaceUser");
    } catch {
      // ignore
    }
    setShowChooser(false);
  }, []);

  const goWorkspace = React.useCallback(() => {
    try {
      localStorage.setItem("adminMode", "workspace");
      const adminUser = localStorage.getItem("adminUser");
      if (adminUser) {
        localStorage.setItem("workspaceUser", adminUser);
      }
    } catch {
      // ignore
    }
    window.location.href = "/workspace/inbox";
  }, []);

  const goAccounting = React.useCallback(() => {
    try {
      localStorage.setItem("adminMode", "accounting");
      const adminUser = localStorage.getItem("adminUser");
      if (adminUser) {
        localStorage.setItem("workspaceUser", adminUser);
      }
    } catch {
      // ignore
    }
    window.location.href = "/accounting/shift-close";
  }, []);

  const goHR = React.useCallback(() => {
    try {
      localStorage.setItem("adminMode", "hr");
      localStorage.removeItem("workspaceUser");

      const adminUser = readAdminUser();
      const hrRaw =
        adminUser?.can_access_hr === undefined ||
        adminUser?.can_access_hr === null
          ? adminUser?.can_manage_employees
          : adminUser?.can_access_hr;

      const target = hrRaw ? "/hr" : "/hr/deductions";
      window.location.href = target;
      return;
    } catch {
      // ignore
    }
    window.location.href = "/hr";
  }, []);

  React.useEffect(() => {
    try {
      const auth = localStorage.getItem("adminAuth");
      if (!auth) {
        return;
      }

      const adminUser = readAdminUser();
      const can = allowedModes(adminUser);
      const allowedKeys = Object.entries(can)
        .filter(([, v]) => !!v)
        .map(([k]) => k);

      if (allowedKeys.length === 0) {
        setNoAccess(true);
        setShowChooser(false);
        return;
      }

      const mode = localStorage.getItem("adminMode");

      // If no mode picked yet:
      if (!mode) {
        if (allowedKeys.length === 1) {
          const only = allowedKeys[0];
          if (only === "inventory") {
            goInventory();
          } else if (only === "workspace") {
            goWorkspace();
          } else if (only === "accounting") {
            goAccounting();
          } else {
            goHR();
          }
          return;
        }

        setShowChooser(true);
        return;
      }

      // If a mode is picked but user is not allowed, force chooser again
      if (mode === "inventory" && !can.inventory) {
        localStorage.removeItem("adminMode");
        setShowChooser(true);
      }
      if (mode === "workspace" && !can.workspace) {
        localStorage.removeItem("adminMode");
        setShowChooser(true);
      }
      if (mode === "accounting" && !can.accounting) {
        localStorage.removeItem("adminMode");
        setShowChooser(true);
      }
      if (mode === "hr" && !can.hr) {
        localStorage.removeItem("adminMode");
        setShowChooser(true);
      }
    } catch {
      // ignore
    }
  }, [goInventory, goWorkspace, goAccounting, goHR]);

  const Background = (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[90px]" />
      <div className="absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px]" />
    </div>
  );

  // `readAdminUser()` parses localStorage on every call. Previously this
  // ran on every render of AdminLayout (which mounts on every admin page).
  // Memoize once per mount; the chooser UI is decided then, and changes
  // to adminUser only happen on login/logout (full reload).
  const adminUserForUI = React.useMemo(
    () => (typeof window === "undefined" ? null : readAdminUser()),
    [],
  );
  const can = React.useMemo(
    () => (typeof window === "undefined" ? null : allowedModes(adminUserForUI)),
    [adminUserForUI],
  );

  const showInventoryBtn = can ? !!can.inventory : true;
  const showWorkspaceBtn = can ? !!can.workspace : true;
  const showAccountingBtn = can ? !!can.accounting : true;
  const showHRBtn = can ? !!can.hr : true;

  return (
    <div className={`min-h-[100svh] ${ws.appBg}`} dir="rtl">
      {Background}

      <div className="relative">{children}</div>

      {noAccess ? (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-xl ${ws.glass} ${ws.card} p-6`}>
            <div className="flex items-start gap-3">
              <div className={`${ws.iconBox} w-12 h-12`}>
                <AlertTriangle className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <div className="text-white text-xl font-bold tracking-tight">
                  لا توجد صلاحيات
                </div>
                <div className="text-white/60 mt-1">
                  هذا الحساب الإداري لا يملك أي صلاحية لعرض الأقسام (Workspace /
                  إدارة الجرد / Accounting / HR).
                </div>
                <div className="text-white/45 text-sm mt-3">
                  حدّث الصلاحيات من شاشة الموظفين.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showChooser ? (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-4xl ${ws.glass} ${ws.card} overflow-hidden`}
          >
            <div className={`p-6 border-b ${ws.divider}`}>
              <div className="text-white text-2xl font-bold tracking-tight">
                اختر القسم
              </div>
              <div className="text-white/60 mt-2">
                الأقسام الظاهرة هنا حسب صلاحيات الحساب.
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {showInventoryBtn ? (
                <button
                  type="button"
                  onClick={goInventory}
                  className="p-5 rounded-3xl text-right transition-colors border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                >
                  <div className={`${ws.iconBox} mb-4`}>
                    <ClipboardList className="w-6 h-6 text-emerald-200" />
                  </div>
                  <div className="text-white font-bold text-lg tracking-tight">
                    إدارة الجرد
                  </div>
                  <div className="text-white/55 text-sm mt-1">
                    إدارة المخزون + عمليات الجرد
                  </div>
                </button>
              ) : null}

              {showWorkspaceBtn ? (
                <button
                  type="button"
                  onClick={goWorkspace}
                  className="p-5 rounded-3xl text-right transition-colors border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                >
                  <div className={`${ws.iconBox} mb-4`}>
                    <Briefcase className="w-6 h-6 text-sky-200" />
                  </div>
                  <div className="text-white font-bold text-lg tracking-tight">
                    Workspace
                  </div>
                  <div className="text-white/55 text-sm mt-1">
                    Inbox + My Tasks + Team Space
                  </div>
                </button>
              ) : null}

              {showAccountingBtn ? (
                <button
                  type="button"
                  onClick={goAccounting}
                  className="p-5 rounded-3xl text-right transition-colors border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                >
                  <div className={`${ws.iconBox} mb-4`}>
                    <Calculator className="w-6 h-6 text-fuchsia-200" />
                  </div>
                  <div className="text-white font-bold text-lg tracking-tight">
                    Accounting
                  </div>
                  <div className="text-white/55 text-sm mt-1">
                    تقفيلة الشفت + تقارير المحاسبة
                  </div>
                </button>
              ) : null}

              {showHRBtn ? (
                <button
                  type="button"
                  onClick={goHR}
                  className="p-5 rounded-3xl text-right transition-colors border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                >
                  <div className={`${ws.iconBox} mb-4`}>
                    <Users className="w-6 h-6 text-amber-200" />
                  </div>
                  <div className="text-white font-bold text-lg tracking-tight">
                    HR
                  </div>
                  <div className="text-white/55 text-sm mt-1">
                    الموظفين + الصلاحيات
                  </div>
                </button>
              ) : null}
            </div>

            <div className="px-6 pb-6 text-xs text-white/45">
              تقدر تبدّل بين الأقسام لاحقًا من نفس شاشة الإدارة.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
