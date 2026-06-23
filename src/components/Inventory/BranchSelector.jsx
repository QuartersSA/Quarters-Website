import { useQuery } from "@tanstack/react-query";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../../utils/queryKeys.js";

export default function BranchSelector({ selectedBranch, onSelectBranch }) {
  const { data: branches, isLoading } = useQuery({
    queryKey: queryKeys.branches(),
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-4`} dir="rtl">
        <div className="animate-pulse h-10 bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.06] rounded-2xl border border-slate-200 dark:border-slate-200 dark:border-white/10" />
      </div>
    );
  }

  const options = [
    { value: "", label: "All Branches" },
    ...(branches || []).map((b) => ({
      value: String(b.id),
      label: `${b.name}${b.location ? ` - ${b.location}` : ""}`,
    })),
  ];

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`} dir="rtl">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
        Select Branch
      </label>

      <GlassSelect
        value={selectedBranch ? String(selectedBranch) : ""}
        onChange={(v) => onSelectBranch(v ? parseInt(v) : null)}
        options={options}
        buttonClassName="w-full md:w-96 px-4 py-2"
      />
    </div>
  );
}
