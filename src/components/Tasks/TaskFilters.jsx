import { Search, SlidersHorizontal, Users2, LayoutGrid } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export function TaskFilters({
  q,
  setQ,
  statusFilter,
  setStatusFilter,
  spaceFilter,
  setSpaceFilter,
  assigneeFilter,
  setAssigneeFilter,
  spaces,
  users,
  showAssigneeFilter = true,
}) {
  const cardClass = `${ws.glassSoft} ${ws.card} p-4`;

  const inputClass = `${ws.input} pr-11 pl-4 py-3`;
  const selectClass = `${ws.select} px-4 py-3`;

  const labelClass = "text-xs font-semibold text-white/55 mb-2";

  const statusOptions = [
    { value: "all", label: "كل الحالات" },
    { value: "Todo", label: "للإنجاز" },
    { value: "In Progress", label: "قيد التنفيذ" },
    { value: "Done", label: "مكتملة" },
  ];

  const spaceOptions = [
    { value: "", label: "كل المساحات" },
    ...spaces.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const assigneeOptions = [
    { value: "all", label: "كل المكلفين" },
    ...users.map((u) => ({ value: String(u.id), label: u.name })),
  ];

  const gridColsClass = showAssigneeFilter
    ? "grid grid-cols-1 lg:grid-cols-12 gap-3"
    : "grid grid-cols-1 lg:grid-cols-9 gap-3";

  const searchColClass = "lg:col-span-4";
  const statusColClass = "lg:col-span-2";
  const spaceColClass = "lg:col-span-3";

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <SlidersHorizontal className="w-5 h-5 text-white/70" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white tracking-tight">الفلاتر</div>
          <div className="text-xs text-white/50">ابحث وفلتر بسرعة</div>
        </div>
      </div>

      <div className={gridColsClass}>
        <div className={searchColClass}>
          <div className={labelClass}>بحث</div>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث في المهام…"
              className={inputClass}
            />
          </div>
        </div>

        <div className={statusColClass}>
          <div className={labelClass}>الحالة</div>
          <GlassSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            className="w-full"
            buttonClassName={selectClass}
          />
        </div>

        <div className={spaceColClass}>
          <div className={labelClass}>المساحة</div>
          <div className="relative">
            <LayoutGrid className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
            <GlassSelect
              value={spaceFilter}
              onChange={setSpaceFilter}
              options={spaceOptions}
              className="w-full"
              buttonClassName={`${selectClass} pr-11`}
              placeholder="كل المساحات"
            />
          </div>
        </div>

        {showAssigneeFilter ? (
          <div className="lg:col-span-3">
            <div className={labelClass}>المكلف</div>
            <div className="relative">
              <Users2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
              <GlassSelect
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={assigneeOptions}
                className="w-full"
                buttonClassName={`${selectClass} pr-11`}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
