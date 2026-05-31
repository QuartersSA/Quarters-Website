"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WorkspaceSidebar from "@/components/Workspace/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import {
  Copy,
  Plus,
  Trash2,
  FileText,
  CheckSquare,
  Flag,
  Loader2,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export default function WorkspaceTemplatesPage() {
  const { employeeId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const myId = employeeId;

  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState("Normal");
  const [formSpaceId, setFormSpaceId] = useState("");
  const [formChecklistText, setFormChecklistText] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["workspaceTemplates", myId],
    enabled: !!myId,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/templates?employeeId=${myId}`);
      if (!res.ok) throw new Error("فشل تحميل القوالب");
      return res.json();
    },
  });

  const spacesQuery = useQuery({
    queryKey: ["workspaceSpaces", myId],
    enabled: !!myId,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/spaces?employeeId=${myId}`);
      if (!res.ok) throw new Error("فشل تحميل المساحات");
      return res.json();
    },
  });

  const templates = templatesQuery.data?.templates || [];
  const spaces = spacesQuery.data?.spaces || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const checklistItems = formChecklistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((title) => ({ title }));

      const res = await fetch("/api/workspace/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: myId,
          name: formName,
          title: formTitle,
          description: formDesc || null,
          priority: formPriority,
          spaceId: formSpaceId ? Number(formSpaceId) : null,
          checklistItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل إنشاء القالب");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceTemplates"] });
      setShowCreate(false);
      setFormName("");
      setFormTitle("");
      setFormDesc("");
      setFormPriority("Normal");
      setFormSpaceId("");
      setFormChecklistText("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId) => {
      const res = await fetch("/api/workspace/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: myId, templateId }),
      });
      if (!res.ok) throw new Error("فشل حذف القالب");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceTemplates"] });
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (template) => {
      const today = new Date();
      today.setDate(today.getDate() + 3);
      const dueDate = today.toISOString().split("T")[0];

      const res = await fetch("/api/workspace/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: myId,
          title: template.title,
          description: template.description || "",
          priority: template.priority || "Normal",
          spaceId: template.space_id || null,
          dueDate,
          tags: template.tags || null,
          assigneeEmployeeIds: [myId],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل إنشاء المهمة");
      }
      const data = await res.json();

      // Create checklist items if template has them
      const checklistRaw = template.checklist_items;
      const checklistItems = Array.isArray(checklistRaw) ? checklistRaw : [];
      const taskId = data?.task?.id;

      if (taskId && checklistItems.length > 0) {
        for (const item of checklistItems) {
          const itemTitle = item?.title || "";
          if (!itemTitle) continue;
          await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: myId, title: itemTitle }),
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceTasks"] });
      queryClient.invalidateQueries({ queryKey: ["workspaceSummary"] });
    },
  });

  const cardClass = `${ws.glassSoft} ${ws.card} p-5`;
  const topBarClass = ws.topBar;

  const priorityOptions = [
    { value: "Low", label: "منخفضة" },
    { value: "Normal", label: "عادية" },
    { value: "High", label: "عالية" },
    { value: "Urgent", label: "عاجلة" },
  ];

  const spaceOptions = [
    { value: "", label: "بدون مساحة" },
    ...spaces.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const priorityLabel = {
    Low: "منخفضة",
    Normal: "عادية",
    High: "عالية",
    Urgent: "عاجلة",
  };

  // Reset every form field when modal closes — without this, reopening the
  // modal shows whatever the user typed last time (or after a successful
  // create the fields were cleared via onSuccess, but cancel-with-X kept
  // them dirty). Single source so X-button + backdrop both call this.
  const resetCreateForm = () => {
    setShowCreate(false);
    setFormName("");
    setFormTitle("");
    setFormDesc("");
    setFormPriority("Normal");
    setFormSpaceId("");
    setFormChecklistText("");
  };

  // Wrap delete in a confirmation — destructive action with no undo and
  // the trash icon button is small enough to mis-click on mobile.
  const handleDeleteTemplate = (template) => {
    if (deleteMutation.isPending) return;
    const ok = window.confirm(
      `حذف القالب "${template.name}"؟ لا يمكن التراجع.`,
    );
    if (!ok) return;
    deleteMutation.mutate(template.id);
  };

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <WorkspaceSidebar active="templates" />

      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <FileText className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
                قوالب المهام
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 truncate">
                أنشئ مهام بسرعة من قوالب جاهزة
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={`${ws.btnPrimary} px-3 py-2`}
          >
            <Plus className="w-4 h-4" />
            جديد
          </button>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={ws.iconBox}>
                <FileText className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  قوالب المهام
                </div>
                <div className="text-slate-600 dark:text-white/55 mt-1">
                  أنشئ مهام متكررة بضغطة واحدة
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={`${ws.btnPrimary} px-4 py-3`}
            >
              <Plus className="w-5 h-5" />
              إضافة قالب
            </button>
          </div>

          {/* Success toast */}
          {useTemplateMutation.isSuccess ? (
            <div
              className={`${ws.glassSoft} ${ws.card} p-4 border-emerald-400/20`}
            >
              <div className="text-emerald-200 font-semibold text-sm">
                ✓ تم إنشاء المهمة من القالب بنجاح
              </div>
            </div>
          ) : null}

          {useTemplateMutation.error ? (
            <div className={`${ws.glassSoft} ${ws.card} p-4 border-red-400/20`}>
              <div className="text-red-300 font-semibold text-sm">
                {useTemplateMutation.error.message}
              </div>
            </div>
          ) : null}

          {templatesQuery.isLoading ? (
            <div className={cardClass}>
              <div className="text-slate-600 dark:text-white/60">جاري التحميل…</div>
            </div>
          ) : templatesQuery.error ? (
            <div className={`${cardClass} text-red-300`}>فشل تحميل القوالب</div>
          ) : templates.length === 0 ? (
            <div className={cardClass}>
              <div className="text-slate-600 dark:text-white/60 text-center py-6">
                <FileText className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <div className="font-semibold text-slate-700 dark:text-white/70 mb-1">
                  لا توجد قوالب
                </div>
                <div className="text-sm text-slate-500 dark:text-white/50">
                  أنشئ قالب لتستخدمه كأساس لمهام متكررة
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => {
                const checklist = Array.isArray(t.checklist_items)
                  ? t.checklist_items
                  : [];
                const isUsing = useTemplateMutation.isPending;

                return (
                  <div key={t.id} className={cardClass}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate tracking-tight">
                          {t.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
                          {t.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t)}
                        disabled={deleteMutation.isPending}
                        title="حذف القالب"
                        className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-red-300 hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {t.description ? (
                      <div className="text-xs text-slate-600 dark:text-white/60 line-clamp-2 mb-3">
                        {t.description}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={ws.chip}>
                        <Flag className="w-3.5 h-3.5 text-slate-500 dark:text-white/50" />
                        {priorityLabel[t.priority] || t.priority}
                      </span>
                      {t.space_name ? (
                        <span className={ws.chip}>{t.space_name}</span>
                      ) : null}
                      {checklist.length > 0 ? (
                        <span className={ws.chip}>
                          <CheckSquare className="w-3.5 h-3.5 text-slate-500 dark:text-white/50" />
                          {checklist.length} عناصر
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => useTemplateMutation.mutate(t)}
                      disabled={isUsing}
                      className={`${ws.btnPrimary} w-full justify-center py-2.5 disabled:opacity-50`}
                    >
                      {isUsing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      استخدام القالب
                    </button>

                    <div className="mt-2 text-xs text-slate-400 dark:text-white/40 text-center">
                      {t.created_by_name || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Template Modal */}
      {showCreate ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={resetCreateForm}
        >
          <div
            className={`w-full max-w-lg ${ws.glass} ${ws.card} overflow-hidden max-h-[90vh] flex flex-col`}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                إنشاء قالب مهمة
              </div>
              <button
                type="button"
                onClick={resetCreateForm}
                className={`${ws.btnNeutral} px-3 py-1`}
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  اسم القالب *
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: مهمة توريد أسبوعية"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  عنوان المهمة *
                </label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: متابعة توريد البن الأخضر"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  الوصف
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className={`${ws.input} px-4 py-3 min-h-[80px]`}
                  placeholder="تفاصيل…"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                    الأولوية
                  </label>
                  <GlassSelect
                    value={formPriority}
                    onChange={setFormPriority}
                    options={priorityOptions}
                    buttonClassName="px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                    المساحة
                  </label>
                  <GlassSelect
                    value={formSpaceId}
                    onChange={setFormSpaceId}
                    options={spaceOptions}
                    buttonClassName="px-4 py-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    قائمة المهام الفرعية (سطر لكل عنصر)
                  </div>
                </label>
                <textarea
                  value={formChecklistText}
                  onChange={(e) => setFormChecklistText(e.target.value)}
                  className={`${ws.input} px-4 py-3 min-h-[100px]`}
                  placeholder={"تحضير المواد\nفحص الجودة\nتسليم الطلب"}
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
                disabled={
                  !formName.trim() ||
                  !formTitle.trim() ||
                  createMutation.isPending
                }
                className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50`}
              >
                {createMutation.isPending ? "جاري الحفظ…" : "حفظ القالب"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
