import { ChevronLeft } from "lucide-react";

const PAGE_LABELS = {
  dashboard: "لوحة التحكم",
  branches: "الفروع",
  items: "إدارة الأصناف",
  operations: "عمليات المخزون",
  employees: "الموظفين",
  "low-stock": "الأصناف المنخفضة",
  "items-summary": "ملخص الأصناف",
  // Pages added later — without these the breadcrumb falls back to raw
  // slug ("variance"/"receipts") which leaks English at the user.
  variance: "تقرير الانحراف",
  receipts: "الواردات",
  "over-stock": "الأصناف الفائضة",
};

export function Breadcrumb({ activePage }) {
  if (activePage === "dashboard") return null;

  const crumbs = [{ label: "لوحة التحكم", href: "/admin" }];

  // Add parent breadcrumbs based on page
  if (activePage === "low-stock" || activePage === "items-summary") {
    crumbs.push({ label: "ملخص جرد الأصناف", href: null });
  }

  crumbs.push({ label: PAGE_LABELS[activePage] || activePage, href: null });

  return (
    <nav
      className="flex items-center gap-1.5 text-sm mb-4 flex-wrap"
      aria-label="breadcrumb"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronLeft className="w-3.5 h-3.5 text-white/30" />}
            {crumb.href && !isLast ? (
              <a
                href={crumb.href}
                className="text-white/50 hover:text-white/80 transition-colors"
              >
                {crumb.label}
              </a>
            ) : (
              <span
                className={
                  isLast ? "text-white/80 font-semibold" : "text-white/50"
                }
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
