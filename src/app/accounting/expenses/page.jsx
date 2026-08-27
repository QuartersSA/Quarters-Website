"use client";

import { Navigate } from "react-router";

// قسم المصروفات انتقل داخل قسم المشتريات (تبويب «المصروفات»).
// This route only survives to keep old links and bookmarks working.
export default function ExpensesPage() {
  return <Navigate to="/accounting/purchases?tab=expenses" replace />;
}
