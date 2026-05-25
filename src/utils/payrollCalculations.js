export function calculatePayrollTotals(entries) {
  let totalSalary = 0;
  let totalBonuses = 0;
  let totalDeductions = 0;
  let totalLoanDeductions = 0;
  let net = 0;

  for (const e of entries) {
    totalSalary += Number(e.total_salary || 0);
    totalBonuses += Number(e.total_bonuses || 0);
    totalDeductions += Number(e.total_deductions || 0);
    totalLoanDeductions += Number(e.loan_deduction || 0);
    net += Number(e.net_salary || 0);
  }

  return {
    totalSalary,
    totalBonuses,
    totalDeductions,
    totalLoanDeductions,
    net,
  };
}

export function formatRunCreatedAt(createdAt) {
  if (!createdAt) return "—";
  const s = String(createdAt);

  // Postgres stores TIMESTAMP without timezone; the neon/node-pg
  // driver returns it as a JS Date and JSON.stringify hands the
  // client an ISO UTC string ("...Z"). The old slice-and-replace
  // shortcut printed those UTC numbers verbatim, so on a server in
  // UTC the admin in Asia/Riyadh saw a value 3 hours behind the
  // actual local clock.
  //
  // Now: append "Z" when the value has no timezone marker, parse
  // it as a real Date, then format it in the user's LOCAL timezone
  // (matches the wall clock the admin reads off their machine).
  const hasTz = /Z$|[+-]\d\d:?\d\d$/.test(s);
  let normalized = s;
  if (!hasTz) {
    normalized = (s.includes("T") ? s : s.replace(" ", "T")) + "Z";
  }
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    // Fall back to the raw string if it's something we can't parse —
    // never throw inside a formatter that the table renders directly.
    return s.replace("T", " ").slice(0, 16);
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getPayrollExportColumns() {
  return [
    {
      header: "الموظف",
      accessor: (item) => item.employee_name || "—",
    },
    {
      header: "الفرع",
      accessor: (item) => item.branch_name || "—",
    },
    {
      header: "الراتب الأساسي",
      accessor: (item) => item.base_salary,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "البدلات",
      accessor: (item) => item.other_allowances,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "إجمالي الراتب",
      accessor: (item) => item.total_salary,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "مجموع البونص",
      accessor: (item) => item.total_bonuses,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "مجموع الخصميات",
      accessor: (item) => item.total_deductions,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "قسط السلف",
      accessor: (item) => item.loan_deduction,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "الصافي",
      accessor: (item) => item.net_salary,
      format: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "تم الدفع",
      accessor: (item) => (item.is_paid ? "نعم" : "لا"),
    },
    {
      header: "طريقة الدفع",
      accessor: (item) => {
        if (!item.payment_method) return "—";
        if (item.payment_method === "cash") return "كاش";
        if (item.payment_method === "transfer") return "تحويل";
        return item.payment_method;
      },
    },
    {
      header: "المبلغ المدفوع",
      accessor: (item) => item.paid_amount,
      format: (value) => {
        if (value === null || value === undefined) return "—";
        const n = Number(value);
        if (!Number.isFinite(n)) return "—";
        return n.toLocaleString("ar-SA-u-nu-latn", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      },
    },
    {
      header: "ملاحظة الدفع",
      accessor: (item) => item.payment_note || "—",
    },
  ];
}
