"use client";

import React from "react";
import {
  LayoutGrid,
  ClipboardList,
  Calculator,
  Users,
  Megaphone,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function readAdminPermissions() {
  try {
    const auth = localStorage.getItem("adminAuth");
    const raw = localStorage.getItem("adminUser");
    if (!auth || !raw) {
      return null;
    }

    const adminUser = JSON.parse(raw);

    // Backward compat: if flags are missing (older stored sessions), default to true.
    const wsFlag = adminUser?.can_access_workspace;
    const invFlag = adminUser?.can_manage_inventory;
    const accFlag = adminUser?.can_manage_accounting;

    const hrRaw =
      adminUser?.can_access_hr === undefined ||
      adminUser?.can_access_hr === null
        ? adminUser?.can_manage_employees
        : adminUser?.can_access_hr;

    const deductionsFlag = adminUser?.can_manage_deductions;
    const marketingFlag = adminUser?.can_manage_marketing;

    return {
      can_access_workspace:
        wsFlag === undefined || wsFlag === null ? true : !!wsFlag,
      can_manage_inventory:
        invFlag === undefined || invFlag === null ? true : !!invFlag,
      can_manage_accounting:
        accFlag === undefined || accFlag === null ? true : !!accFlag,
      can_access_hr: hrRaw === undefined || hrRaw === null ? true : !!hrRaw,
      can_manage_deductions: !!deductionsFlag,
      can_manage_marketing: !!marketingFlag,
    };
  } catch {
    return null;
  }
}

export default function AppSectionSwitcher({
  active = "workspace",
  className = "",
}) {
  const [perms, setPerms] = React.useState(null);

  React.useEffect(() => {
    setPerms(readAdminPermissions());
  }, []);

  const hrHref = perms?.can_access_hr ? "/hr" : "/hr/deductions";

  const items = [
    {
      key: "workspace",
      href: "/workspace/inbox",
      label: "مساحة العمل",
      Icon: LayoutGrid,
      gate: (p) => (p ? p.can_access_workspace : true),
      onClick: () => {
        try {
          localStorage.setItem("adminMode", "workspace");
          const adminUser = localStorage.getItem("adminUser");
          if (adminUser) {
            localStorage.setItem("workspaceUser", adminUser);
          }
        } catch {
          // ignore
        }
      },
    },
    {
      key: "inventory",
      href: "/admin",
      label: "إدارة الجرد",
      Icon: ClipboardList,
      gate: (p) => (p ? p.can_manage_inventory : true),
      onClick: () => {
        try {
          localStorage.setItem("adminMode", "inventory");
          localStorage.removeItem("workspaceUser");
        } catch {
          // ignore
        }
      },
    },
    {
      key: "accounting",
      href: "/accounting",
      label: "المحاسبة",
      Icon: Calculator,
      gate: (p) => (p ? p.can_manage_accounting : true),
      onClick: () => {
        try {
          localStorage.setItem("adminMode", "accounting");
          const adminUser = localStorage.getItem("adminUser");
          if (adminUser) {
            localStorage.setItem("workspaceUser", adminUser);
          }
        } catch {
          // ignore
        }
      },
    },
    {
      key: "hr",
      href: hrHref,
      label: "الموارد البشرية",
      Icon: Users,
      gate: (p) => (p ? p.can_access_hr || p.can_manage_deductions : true),
      onClick: () => {
        try {
          localStorage.setItem("adminMode", "hr");
          localStorage.removeItem("workspaceUser");
        } catch {
          // ignore
        }
      },
    },
    {
      key: "marketing",
      href: "/marketing/bloggers",
      label: "التسويق",
      Icon: Megaphone,
      gate: (p) => (p ? p.can_manage_marketing : false),
      onClick: () => {
        try {
          localStorage.setItem("adminMode", "marketing");
          const adminUser = localStorage.getItem("adminUser");
          if (adminUser) {
            localStorage.setItem("workspaceUser", adminUser);
          }
        } catch {
          // ignore
        }
      },
    },
  ];

  const visibleItems = items.filter((it) => it.gate(perms));

  const shellClass = `${ws.glassSoft} ${ws.card}`;

  // If only one section is allowed, don't show the switcher.
  if (visibleItems.length <= 1) {
    return null;
  }

  return (
    // inline-flex so the switcher only takes the space its icons need.
    // Previously this was w-full which squeezed sibling content (page title)
    // when used inline in a mobile top bar.
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] shrink-0 ${shellClass} ${className}`}
      dir="rtl"
    >
      {visibleItems.map(({ key, href, label, Icon, onClick }) => {
        const isActive = active === key;

        const btnClass = isActive
          ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/20"
          : "bg-transparent text-slate-600 dark:text-white/60 border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-800 dark:hover:text-white/80";

        return (
          <a
            key={key}
            href={href}
            onClick={onClick}
            className={`flex items-center justify-center px-2.5 py-1.5 rounded-xl border transition-colors ${btnClass}`}
            title={label}
            aria-label={label}
          >
            <Icon
              className={`w-4 h-4 ${isActive ? "text-emerald-700 dark:text-emerald-200" : "text-slate-500 dark:text-white/50"}`}
            />
            {/* Icon-only: every consumer renders inside a narrow container
                (mobile top bar OR desktop w-72 sidebar = 288px). The old
                `2xl:inline` rule showed labels at viewport ≥ 1536px even
                when the container was narrow, causing overflow/truncation.
                `title` + `aria-label` keep the text available via hover
                and screen readers. */}
            <span className="sr-only">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
