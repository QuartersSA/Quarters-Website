"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import WorkspaceSidebar from "@/components/Workspace/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { Plus, Users, FolderKanban } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export default function WorkspaceTeamPage() {
  const { employeeId } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const myId = employeeId;

  const spacesQuery = useQuery({
    queryKey: ["workspaceSpaces", myId],
    enabled: !!myId,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/spaces?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/spaces, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });

  const spaces = spacesQuery.data?.spaces || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workspace/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: myId,
          name,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إنشاء الـ Space");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceSpaces", myId] });
      setShowCreate(false);
      setName("");
      setDescription("");
    },
  });

  const header = useMemo(() => {
    return {
      title: "مساحات الفريق",
      subtitle: "أنشئ مساحات لتنظيم عمل الفريق والمهام",
    };
  }, []);

  const cardClass = `${ws.glassSoft} ${ws.card} p-5`;
  const topBarClass = ws.topBar;
  const primaryBtnClass = `${ws.btnPrimary} px-3 py-2`;

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <WorkspaceSidebar active="team" />

      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {header.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 truncate">
                {header.subtitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={primaryBtnClass}
          >
            <Plus className="w-4 h-4" />
            جديد
          </button>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="hidden lg:flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={ws.iconBox}>
                <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {header.title}
                </div>
                <div className="text-slate-600 dark:text-white/55 mt-1">{header.subtitle}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={`${ws.btnPrimary} px-4 py-3`}
            >
              <Plus className="w-5 h-5" />
              إضافة مساحة
            </button>
          </div>

          <div className="mb-5">
            <div className={`${ws.glassSoft} ${ws.card} p-4`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border border-emerald-400/25 flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                    المساحات
                  </div>
                  <div className="text-sm text-slate-600 dark:text-white/55">
                    أنشئ مساحات لفريقك ونظّم المهام داخلها
                  </div>
                </div>
              </div>
            </div>
          </div>

          {spacesQuery.isLoading ? (
            <div className="text-slate-600 dark:text-white/60">جاري التحميل…</div>
          ) : spacesQuery.error ? (
            <div className="text-red-300">فشل تحميل المساحات</div>
          ) : spaces.length === 0 ? (
            <div className={cardClass}>
              <div className="text-slate-600 dark:text-white/60">
                لا يوجد مساحات حالياً. اضغط "إضافة مساحة" لبدء تنظيم الفريق.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {spaces.map((s) => {
                const tasksCount = s.tasks_count || 0;
                const desc = s.description || "";

                return (
                  <div key={s.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate tracking-tight">
                          {s.name}
                        </div>
                        {desc ? (
                          <div className="text-sm text-slate-700 dark:text-white/70 mt-1 line-clamp-2">
                            {desc}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 dark:text-white/40 mt-1">
                            بدون وصف
                          </div>
                        )}
                      </div>
                      <div className={ws.iconBox}>
                        <FolderKanban className="w-5 h-5 text-slate-700 dark:text-white/70" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <div className="inline-flex items-center gap-2 text-slate-600 dark:text-white/60">
                        <Users className="w-4 h-4" />
                        <span>الفريق</span>
                      </div>
                      <div className="text-slate-900 dark:text-white font-bold">
                        {tasksCount} مهام
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-slate-500 dark:text-white/45">
                      أنشأه: {s.created_by_name || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showCreate ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg ${ws.glass} ${ws.card} overflow-hidden`}
            dir="rtl"
          >
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                إضافة مساحة
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={`${ws.btnNeutral} px-3 py-1`}
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  الاسم
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: فريق المشتريات"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  الوصف
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${ws.input} px-4 py-3 min-h-[110px]`}
                  placeholder="تفاصيل…"
                />
              </div>

              {createMutation.error ? (
                <div className="text-sm text-red-300">
                  {createMutation.error.message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50`}
              >
                {createMutation.isPending ? "جاري الحفظ…" : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
