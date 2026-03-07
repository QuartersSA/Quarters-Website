import { LayoutGrid, List, ArrowUpDown } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

const SORT_OPTIONS = [
  { value: "default", label: "ترتيب افتراضي" },
  { value: "priority", label: "حسب الأولوية" },
  { value: "dueDate", label: "حسب تاريخ الاستحقاق" },
  { value: "newest", label: "الأحدث أولاً" },
];

export function TaskViewControls({
  scope,
  setScope,
  view,
  setView,
  sortBy,
  setSortBy,
}) {
  const containerClass =
    "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3";

  const segWrapClass = `${ws.segWrap}`;
  const baseBtnClass = ws.segBtn;

  const scopeMyClass = scope === "my" ? ws.segActive : ws.segInactive;
  const scopeTeamClass = scope === "team" ? ws.segActive : ws.segInactive;

  const viewBoardClass = view === "board" ? ws.segActive : ws.segInactive;
  const viewListClass = view === "list" ? ws.segActive : ws.segInactive;

  const viewBtnBase =
    "px-3 py-2 rounded-xl font-semibold inline-flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className={segWrapClass}>
          <button
            type="button"
            onClick={() => setScope("my")}
            className={`${baseBtnClass} ${scopeMyClass}`}
          >
            مهامي
          </button>
          <button
            type="button"
            onClick={() => setScope("team")}
            className={`${baseBtnClass} ${scopeTeamClass}`}
          >
            مهام الفريق
          </button>
        </div>

        {sortBy !== undefined && setSortBy ? (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-white/50" />
            <GlassSelect
              value={sortBy || "default"}
              onChange={setSortBy}
              options={SORT_OPTIONS}
              buttonClassName={`${ws.select} px-3 py-2 text-sm min-w-[160px]`}
            />
          </div>
        ) : null}
      </div>

      <div className={segWrapClass}>
        <button
          type="button"
          onClick={() => setView("board")}
          className={`${viewBtnBase} ${viewBoardClass}`}
          title="لوحة"
        >
          <LayoutGrid className="w-4 h-4" />
          لوحة
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`${viewBtnBase} ${viewListClass}`}
          title="قائمة"
        >
          <List className="w-4 h-4" />
          قائمة
        </button>
      </div>
    </div>
  );
}
