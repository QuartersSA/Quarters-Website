"use client";

import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import WorkspaceSidebar from "@/components/Workspace/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { Plus, Send, ChevronLeft, MessageSquare, Search } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { formatTime as formatTimeRiyadh } from "@/utils/dateUtils";

// Wrapper: dateUtils.formatTime returns "—" for empty/invalid; the
// inbox UI prefers an empty string in those slots.
function formatTime(ts) {
  if (!ts) return "";
  const out = formatTimeRiyadh(ts);
  return out === "—" ? "" : out;
}

function initials(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(" ").filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  const raw = `${first}${second}`.trim();
  return raw ? raw.toUpperCase() : "";
}

export default function WorkspaceInboxPage() {
  const { employeeId, user } = useWorkspaceUser();
  const queryClient = useQueryClient();

  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [compose, setCompose] = useState("");
  const [search, setSearch] = useState("");
  // Tracks whether the auto-select-first-thread effect has already fired
  // once for this mount. Without this, refetch (refetchInterval = 15s)
  // would re-open the first thread every 15 seconds even after the user
  // explicitly hit "back" to the thread list on desktop.
  const [autoSelected, setAutoSelected] = useState(false);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newToUserId, setNewToUserId] = useState("");

  const myId = employeeId;

  const messagesEndRef = useRef(null);

  const threadsQuery = useQuery({
    queryKey: ["workspaceThreads", myId],
    enabled: !!myId,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/threads?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/threads, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });

  const threads = threadsQuery.data?.threads || [];

  React.useEffect(() => {
    // UX: على الجوال ابدأ بقائمة المحادثات، وعلى الشاشات الكبيرة افتح أول
    // محادثة تلقائياً — مرة واحدة فقط في كل mount. autoSelected guard يمنع
    // الـ refetch من إعادة اختيار threads[0] بعد ما المستخدم رجع للقائمة.
    if (autoSelected || selectedThreadId || threads.length === 0) {
      return;
    }

    try {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop) {
        setSelectedThreadId(threads[0].id);
        setAutoSelected(true);
      }
    } catch {
      // ignore
    }
  }, [selectedThreadId, threads, autoSelected]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;

    const result = threads.filter((t) => {
      const members = Array.isArray(t.members) ? t.members : [];
      const names = members.map((m) => (m?.name || "").toLowerCase()).join(" ");
      const lastBody = (t.last_message_body || "").toLowerCase();
      return names.includes(q) || lastBody.includes(q);
    });

    return result;
  }, [threads, search]);

  const selectedThread = useMemo(() => {
    const found = threads.find((t) => t.id === selectedThreadId);
    return found || null;
  }, [threads, selectedThreadId]);

  const otherMemberName = useMemo(() => {
    if (!selectedThread) return "";
    const members = Array.isArray(selectedThread.members)
      ? selectedThread.members
      : [];

    const other = members.find((m) => Number(m.id) !== Number(myId));
    return other?.name || selectedThread.title || "محادثة";
  }, [selectedThread, myId]);

  const otherMemberInitials = useMemo(() => {
    return initials(otherMemberName);
  }, [otherMemberName]);

  const messagesQuery = useQuery({
    queryKey: ["workspaceMessages", selectedThreadId, myId],
    enabled: !!myId && !!selectedThreadId,
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await fetch(
        `/api/workspace/threads/${selectedThreadId}/messages?employeeId=${myId}`,
      );
      if (!res.ok) {
        throw new Error(
          `When fetching messages, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });

  const messages = messagesQuery.data?.messages || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const usersQuery = useQuery({
    queryKey: ["workspaceUsers", myId],
    enabled: !!myId,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/users?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/users, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });

  const users = usersQuery.data?.users || [];

  const createThreadMutation = useMutation({
    mutationFn: async (toEmployeeId) => {
      const res = await fetch("/api/workspace/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: myId,
          otherEmployeeId: toEmployeeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إنشاء محادثة");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["workspaceThreads", myId],
      });
      setShowNewModal(false);
      setNewToUserId("");
      setSelectedThreadId(data.threadId);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      const res = await fetch(
        `/api/workspace/threads/${selectedThreadId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: myId, body: text }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إرسال الرسالة");
      }
      return data;
    },
    onMutate: async (text) => {
      const queryKey = ["workspaceMessages", selectedThreadId, myId];
      await queryClient.cancelQueries({ queryKey });

      const optimisticId = `optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const optimistic = {
        id: optimisticId,
        thread_id: selectedThreadId,
        sender_employee_id: myId,
        sender_name: user?.name || "أنا",
        body: text,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(queryKey, (old) => {
        const oldMessages = old?.messages || [];
        return { ...old, messages: [...oldMessages, optimistic] };
      });

      return { optimisticId, queryKey };
    },
    onError: (err, _text, ctx) => {
      console.error(err);
      if (ctx?.queryKey && ctx?.optimisticId) {
        queryClient.setQueryData(ctx.queryKey, (old) => {
          if (!old?.messages) return old;
          return {
            ...old,
            messages: old.messages.filter((m) => m.id !== ctx.optimisticId),
          };
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaceMessages", selectedThreadId, myId],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaceThreads", myId] });
    },
  });

  const onSend = useCallback(async () => {
    const text = compose.trim();
    if (!text || !selectedThreadId) return;
    setCompose("");
    sendMutation.mutate(text);
  }, [compose, selectedThreadId, sendMutation]);

  const openNewMessage = () => {
    setShowNewModal(true);
  };

  const startNewConversation = () => {
    const idNum = Number(newToUserId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return;
    }
    createThreadMutation.mutate(idNum);
  };

  const isMobileThreadView = !!selectedThreadId;

  const leftPanelClasses =
    "w-full lg:w-[360px] border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-white/10 bg-white/[0.035] backdrop-blur-xl";

  const rightPanelClasses = "flex-1 bg-transparent flex flex-col min-h-[70vh]";

  const mobileListHidden = isMobileThreadView ? "hidden lg:block" : "block";
  const mobileChatHidden = !isMobileThreadView ? "hidden lg:flex" : "flex";

  const topBarClass = ws.topBar;

  const inputClass = `${ws.input} pr-10 pl-4 py-2.5`;

  const softCardClass = `${ws.glass} ${ws.card}`;

  const primaryBtnClass = `${ws.btnPrimary} px-3 py-2`;

  const newMessageOptions = useMemo(() => {
    const opts = users
      .filter((u) => Number(u.id) !== Number(myId))
      .map((u) => ({
        value: String(u.id),
        label: `${u.name} ${u.role === "Admin" ? "(مدير)" : ""}`.trim(),
      }));

    return [{ value: "", label: "—" }, ...opts];
  }, [users, myId]);

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <WorkspaceSidebar active="inbox" />

      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <MessageSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
                الوارد
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 truncate">رسائل الفريق</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openNewMessage}
            className={primaryBtnClass}
          >
            <Plus className="w-4 h-4" />
            جديد
          </button>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 min-h-[100svh] flex">
        {/* Left: threads */}
        <div className={`${leftPanelClasses} ${mobileListHidden}`}>
          <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`${ws.iconBox} w-9 h-9`}>
                <MessageSquare className="w-4 h-4 text-slate-700 dark:text-white/70" />
              </div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">الوارد</div>
            </div>
            <button
              type="button"
              onClick={openNewMessage}
              className={`hidden lg:inline-flex ${primaryBtnClass}`}
            >
              <Plus className="w-4 h-4" />
              جديد
            </button>
          </div>

          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputClass}
                placeholder="ابحث…"
              />
            </div>
          </div>

          <div className="p-3">
            {threadsQuery.isLoading ? (
              <div className="p-4 text-slate-600 dark:text-white/60">جاري التحميل…</div>
            ) : threadsQuery.error ? (
              <div className="p-4 text-red-700 dark:text-red-300">فشل تحميل المحادثات</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-slate-600 dark:text-white/60">
                لا توجد محادثات. اضغط "جديد" لبدء محادثة.
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isActive = t.id === selectedThreadId;
                const members = Array.isArray(t.members) ? t.members : [];
                const other = members.find(
                  (m) => Number(m.id) !== Number(myId),
                );
                const title = other?.name || t.title || "محادثة";
                const lastText = t.last_message_body || "";
                const time = formatTime(t.last_message_at);
                const unread = t.unread_count || 0;

                const avatar = initials(title) || "";

                const itemClass = isActive
                  ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/20"
                  : "bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-white border-slate-200 dark:border-white/10";

                const subtitleClass = "text-slate-600 dark:text-white/55";

                const avatarClass = isActive
                  ? "bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border-emerald-400/25"
                  : "bg-slate-100 dark:bg-white/[0.05] text-slate-900 dark:text-white/90 border-slate-200 dark:border-white/10";

                const badge =
                  unread > 0 ? (
                    <div className="min-w-[26px] h-[26px] px-2 rounded-full bg-emerald-400/20 text-emerald-700 dark:text-emerald-200 text-xs font-bold flex items-center justify-center border border-emerald-400/25">
                      {unread}
                    </div>
                  ) : null;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`w-full text-right rounded-3xl p-4 mb-2 transition-colors border ${itemClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold border shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] ${avatarClass}`}
                        >
                          {avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate tracking-tight">
                            {title}
                          </div>
                          <div
                            className={`text-sm mt-1 truncate ${subtitleClass}`}
                          >
                            {lastText || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`text-xs ${subtitleClass}`}>{time}</div>
                        {badge}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: messages */}
        <div className={`${rightPanelClasses} ${mobileChatHidden}`}>
          <div className={`p-4 ${topBarClass} flex items-center gap-3`}>
            <button
              type="button"
              onClick={() => setSelectedThreadId(null)}
              className="lg:hidden p-2 rounded-2xl hover:bg-slate-100 dark:bg-white/[0.06]"
              aria-label="رجوع"
            >
              <ChevronLeft className="w-5 h-5 text-slate-900 dark:text-white" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 flex items-center justify-center font-bold text-slate-900 dark:text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
              {otherMemberInitials || ""}
            </div>

            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate tracking-tight">
                {otherMemberName || "محادثة"}
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55">الرسائل</div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {messagesQuery.isLoading ? (
              <div className="text-slate-600 dark:text-white/60">جاري تحميل الرسائل…</div>
            ) : messagesQuery.error ? (
              <div className="text-red-700 dark:text-red-300">فشل تحميل الرسائل</div>
            ) : messages.length === 0 ? (
              <div className="text-slate-600 dark:text-white/60">ابدأ أول رسالة…</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  // في RTL عادةً رسائلي تكون على اليمين
                  const mine = Number(m.sender_employee_id) === Number(myId);
                  const rowClass = mine ? "justify-end" : "justify-start";
                  const bubbleClass = mine
                    ? "bg-emerald-400 text-[#071018]"
                    : "bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10";

                  const time = formatTime(m.created_at);

                  return (
                    <div key={m.id} className={`flex ${rowClass}`}>
                      <div className="max-w-[85%]">
                        <div
                          className={`rounded-3xl px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] ${bubbleClass}`}
                        >
                          <div className="text-[15px] leading-6 whitespace-pre-wrap">
                            {m.body}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-white/45">{time}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className={`p-4 border-t border-slate-200 dark:border-white/10 ${topBarClass}`}>
            <div className="flex items-center gap-3">
              <input
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="flex-1 px-4 py-3 rounded-3xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:text-white/35 focus:outline-none focus:border-slate-300 dark:border-white/20"
                placeholder={
                  selectedThreadId ? "اكتب رسالة…" : "اختر محادثة أولاً"
                }
                disabled={!selectedThreadId}
              />
              <button
                type="button"
                onClick={onSend}
                // Don't gate on sendMutation.isPending: compose clears
                // optimistically and the optimistic update already shows the
                // message — keeping it disabled until the network round-trip
                // settles creates ~300-500ms input lag where a freshly-typed
                // second message can't be sent. Multiple in-flight mutates
                // is OK because each optimistic batch is appended to prev.
                disabled={!compose.trim() || !selectedThreadId}
                className="inline-flex items-center justify-center w-12 h-12 rounded-3xl bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border border-emerald-400/25 disabled:opacity-50 hover:bg-emerald-400/20"
                aria-label="إرسال"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {showNewModal ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md ${softCardClass} overflow-hidden`}
            dir="rtl"
          >
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                رسالة جديدة
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className={`${ws.btnNeutral} px-3 py-1`}
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70">
                اختر المستخدم
              </label>

              <GlassSelect
                value={newToUserId}
                onChange={setNewToUserId}
                options={newMessageOptions}
                buttonClassName="px-4 py-3"
              />

              <button
                type="button"
                onClick={startNewConversation}
                disabled={!newToUserId || createThreadMutation.isPending}
                className={`${ws.btnPrimary} w-full justify-center py-3 disabled:opacity-50`}
              >
                بدء المحادثة
              </button>

              {createThreadMutation.error ? (
                <div className="text-sm text-red-700 dark:text-red-300">
                  {createThreadMutation.error.message}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
