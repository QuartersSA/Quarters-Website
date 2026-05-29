import { Search } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function EmployeeSearchBar({ searchTerm, onSearchChange }) {
  return (
    <div className="flex-1 relative">
      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-400 dark:dark:text-slate-400 dark:dark:dark:text-white/35" />
      <input
        type="text"
        placeholder="ابحث عن موظف (الاسم، اسم المستخدم، البريد)"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className={`${ws.input} pr-12 pl-4 py-3`}
      />
    </div>
  );
}
