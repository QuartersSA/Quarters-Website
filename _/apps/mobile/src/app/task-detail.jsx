import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import {
  X,
  CheckCircle2,
  Circle,
  PlayCircle,
  Calendar,
  Flag,
  Users,
  MessageSquare,
  ListChecks,
  Send,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

const STATUS_OPTIONS = [
  { value: "Todo", label: "للإنجاز", color: "#FCD34D" },
  { value: "In Progress", label: "قيد التنفيذ", color: "#7DD3FC" },
  { value: "Done", label: "مكتملة", color: "#6EE7B7" },
];

const PRIORITY_OPTIONS = [
  { value: "Low", label: "منخفضة", color: "#9CA3AF" },
  { value: "Normal", label: "عادية", color: "#60A5FA" },
  { value: "High", label: "عالية", color: "#FB923C" },
  { value: "Urgent", label: "عاجلة", color: "#F87171" },
];

function formatDate(d) {
  if (!d) return "—";
  try {
    const s = String(d).split("T")[0];
    const parts = s.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {
    return "—";
  }
}

function formatDateShort(d) {
  if (!d) return "";
  try {
    const s = String(d).split("T")[0];
    const parts = s.split("-");
    return `${parts[2]}/${parts[1]}`;
  } catch {
    return "";
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `قبل ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `قبل ${hrs} س`;
    const days = Math.floor(hrs / 24);
    return `قبل ${days} ي`;
  } catch {
    return "";
  }
}

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const taskId = params.id;
  const { employeeId } = useWorkspaceAuth();
  const queryClient = useQueryClient();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [saving, setSaving] = useState(false);

  const [editingField, setEditingField] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [checklistItems, setChecklistItems] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState("");
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!taskId || !employeeId) return;
    try {
      const res = await fetch(
        `${BASE}/api/workspace/tasks?employeeId=${employeeId}&scope=team&status=all`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const found = (data.tasks || []).find(
        (t) => String(t.id) === String(taskId),
      );
      if (found) {
        setTask(found);
        setEditTitle(found.title);
        setEditDescription(found.description || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [taskId, employeeId]);

  const fetchChecklist = useCallback(async () => {
    if (!taskId || !employeeId) return;
    setLoadingChecklist(true);
    try {
      const res = await fetch(
        `${BASE}/api/workspace/tasks/${taskId}/checklist?employeeId=${employeeId}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChecklistItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChecklist(false);
    }
  }, [taskId, employeeId]);

  const fetchUpdates = useCallback(async () => {
    if (!taskId || !employeeId) return;
    setLoadingUpdates(true);
    try {
      const res = await fetch(
        `${BASE}/api/workspace/tasks/${taskId}/updates?employeeId=${employeeId}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUpdates(data.updates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUpdates(false);
    }
  }, [taskId, employeeId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  useEffect(() => {
    if (activeTab === "checklist") fetchChecklist();
    if (activeTab === "updates") fetchUpdates();
  }, [activeTab, fetchChecklist, fetchUpdates]);

  const handleUpdateField = useCallback(
    async (fieldUpdates) => {
      if (!taskId || !employeeId) return;
      setSaving(true);
      try {
        const res = await fetch(`${BASE}/api/workspace/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, ...fieldUpdates }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.task) {
          setTask((prev) => ({ ...prev, ...data.task }));
          setEditTitle(data.task.title || "");
          setEditDescription(data.task.description || "");
        }
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } catch (e) {
        console.error(e);
        Alert.alert("خطأ", "فشل التحديث");
      } finally {
        setSaving(false);
        setEditingField(null);
      }
    },
    [taskId, employeeId, queryClient],
  );

  const handleStatusChange = useCallback(
    (newStatus) => {
      setShowStatusPicker(false);
      handleUpdateField({ status: newStatus });
    },
    [handleUpdateField],
  );

  const handlePriorityChange = useCallback(
    (newPriority) => {
      setShowPriorityPicker(false);
      handleUpdateField({ priority: newPriority });
    },
    [handleUpdateField],
  );

  const handleAddCheckItem = useCallback(async () => {
    const title = newCheckItem.trim();
    if (!title || !taskId || !employeeId) return;
    try {
      const res = await fetch(
        `${BASE}/api/workspace/tasks/${taskId}/checklist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, title }),
        },
      );
      if (!res.ok) throw new Error();
      setNewCheckItem("");
      fetchChecklist();
    } catch (e) {
      console.error(e);
    }
  }, [newCheckItem, taskId, employeeId, fetchChecklist]);

  const handleToggleCheckItem = useCallback(
    async (itemId, currentState) => {
      try {
        await fetch(`${BASE}/api/workspace/tasks/${taskId}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            itemId,
            is_completed: !currentState,
          }),
        });
        fetchChecklist();
      } catch (e) {
        console.error(e);
      }
    },
    [taskId, employeeId, fetchChecklist],
  );

  const handleDeleteCheckItem = useCallback(
    async (itemId) => {
      try {
        await fetch(`${BASE}/api/workspace/tasks/${taskId}/checklist`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, itemId }),
        });
        fetchChecklist();
      } catch (e) {
        console.error(e);
      }
    },
    [taskId, employeeId, fetchChecklist],
  );

  const handleSendUpdate = useCallback(async () => {
    const text = newUpdate.trim();
    if (!text || !taskId || !employeeId) return;
    setSendingUpdate(true);
    try {
      const res = await fetch(`${BASE}/api/workspace/tasks/${taskId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, body: text }),
      });
      if (!res.ok) throw new Error();
      setNewUpdate("");
      fetchUpdates();
    } catch (e) {
      console.error(e);
      Alert.alert("خطأ", "فشل إرسال التحديث");
    } finally {
      setSendingUpdate(false);
    }
  }, [newUpdate, taskId, employeeId, fetchUpdates]);

  const handleDeleteTask = useCallback(() => {
    Alert.alert("حذف المهمة", "هل أنت متأكد من حذف هذه المهمة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${BASE}/api/workspace/tasks/${taskId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ employeeId }),
            });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            router.back();
          } catch (e) {
            console.error(e);
            Alert.alert("خطأ", "فشل حذف المهمة");
          }
        },
      },
    ]);
  }, [taskId, employeeId, queryClient]);

  const statusInfo = useMemo(
    () =>
      STATUS_OPTIONS.find((s) => s.value === task?.status) || STATUS_OPTIONS[0],
    [task?.status],
  );

  const priorityInfo = useMemo(
    () =>
      PRIORITY_OPTIONS.find((p) => p.value === task?.priority) ||
      PRIORITY_OPTIONS[1],
    [task?.priority],
  );

  const checklistProgress = useMemo(() => {
    if (checklistItems.length === 0) return null;
    const done = checklistItems.filter((c) => c.is_completed).length;
    return {
      done,
      total: checklistItems.length,
      percent: Math.round((done / checklistItems.length) * 100),
    };
  }, [checklistItems]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B0B10",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!task) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B0B10",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
        }}
      >
        <StatusBar style="light" />
        <AlertTriangle size={40} color="#F87171" />
        <Text style={{ color: "#FCA5A5", marginTop: 12, fontSize: 16 }}>
          المهمة غير موجودة
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 20, padding: 12 }}
        >
          <Text style={{ color: "#7DD3FC", fontSize: 15 }}>رجوع</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#0B0B10" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <X size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
            تفاصيل المهمة
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {saving ? (
              <ActivityIndicator size={18} color="rgba(255,255,255,0.5)" />
            ) : null}
            <Pressable onPress={handleDeleteTask} style={{ padding: 4 }}>
              <Trash2 size={20} color="#F87171" />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row-reverse",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.06)",
          }}
        >
          {[
            { key: "details", label: "التفاصيل" },
            { key: "checklist", label: "القائمة" },
            { key: "updates", label: "التحديثات" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? "#fff" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                    fontSize: 13,
                    fontWeight: isActive ? "800" : "600",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeTab === "details" ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {editingField === "title" ? (
            <View style={{ marginBottom: 16 }}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                autoFocus
                multiline
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: "900",
                  textAlign: "right",
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.15)",
                  minHeight: 60,
                }}
              />
              <View
                style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}
              >
                <Pressable
                  onPress={() => handleUpdateField({ title: editTitle })}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: "#6EE7B7",
                  }}
                >
                  <Text
                    style={{
                      color: "#0B0B10",
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    حفظ
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditTitle(task.title);
                    setEditingField(null);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    إلغاء
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingField("title")}
              style={{ marginBottom: 16 }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: "900",
                  textAlign: "right",
                  lineHeight: 30,
                }}
              >
                {task.title}
              </Text>
              {task.space_name ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 12,
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {task.space_name}
                </Text>
              ) : null}
            </Pressable>
          )}

          <View
            style={{ flexDirection: "row-reverse", gap: 10, marginBottom: 16 }}
          >
            <Pressable
              onPress={() => setShowStatusPicker(true)}
              style={{
                flex: 1,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                padding: 14,
                borderRadius: 16,
                backgroundColor: `${statusInfo.color}12`,
                borderWidth: 1,
                borderColor: `${statusInfo.color}30`,
              }}
            >
              {task.status === "Done" ? (
                <CheckCircle2 size={20} color={statusInfo.color} />
              ) : task.status === "In Progress" ? (
                <PlayCircle size={20} color={statusInfo.color} />
              ) : (
                <Circle size={20} color={statusInfo.color} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>
                  الحالة
                </Text>
                <Text
                  style={{
                    color: statusInfo.color,
                    fontSize: 14,
                    fontWeight: "700",
                    textAlign: "right",
                  }}
                >
                  {statusInfo.label}
                </Text>
              </View>
              <ChevronDown size={16} color={statusInfo.color} />
            </Pressable>

            <Pressable
              onPress={() => setShowPriorityPicker(true)}
              style={{
                flex: 1,
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                padding: 14,
                borderRadius: 16,
                backgroundColor: `${priorityInfo.color}12`,
                borderWidth: 1,
                borderColor: `${priorityInfo.color}30`,
              }}
            >
              <Flag size={20} color={priorityInfo.color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>
                  الأولوية
                </Text>
                <Text
                  style={{
                    color: priorityInfo.color,
                    fontSize: 14,
                    fontWeight: "700",
                    textAlign: "right",
                  }}
                >
                  {priorityInfo.label}
                </Text>
              </View>
              <ChevronDown size={16} color={priorityInfo.color} />
            </Pressable>
          </View>

          <View style={sectionStyle}>
            <View style={infoRowStyle}>
              <Calendar size={16} color="rgba(255,255,255,0.4)" />
              <Text style={infoLabelStyle}>تاريخ الاستحقاق</Text>
              <Text
                style={{
                  color: task.due_date ? "#fff" : "rgba(255,255,255,0.3)",
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {formatDate(task.due_date)}
              </Text>
            </View>
            <View style={infoRowStyle}>
              <Users size={16} color="rgba(255,255,255,0.4)" />
              <Text style={infoLabelStyle}>المكلّفون</Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "left",
                  flex: 1,
                }}
                numberOfLines={2}
              >
                {Array.isArray(task.assignees) && task.assignees.length > 0
                  ? task.assignees.map((a) => a.name).join("، ")
                  : "—"}
              </Text>
            </View>
            <View style={infoRowStyle}>
              <Edit3 size={16} color="rgba(255,255,255,0.4)" />
              <Text style={infoLabelStyle}>أنشأها</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                {task.created_by_name || "—"}
              </Text>
            </View>
            <View style={{ ...infoRowStyle, borderBottomWidth: 0 }}>
              <Clock size={16} color="rgba(255,255,255,0.4)" />
              <Text style={infoLabelStyle}>تاريخ الإنشاء</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                {formatDate(task.created_at)}
              </Text>
            </View>
          </View>

          <View style={sectionStyle}>
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign: "right",
                }}
              >
                الوصف
              </Text>
              <Pressable
                onPress={() => setEditingField("description")}
                style={{ padding: 4 }}
              >
                <Edit3 size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
            {editingField === "description" ? (
              <View>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  autoFocus
                  multiline
                  placeholder="أضف وصف للمهمة..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    textAlign: "right",
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.3)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                    minHeight: 80,
                    lineHeight: 22,
                  }}
                />
                <View
                  style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}
                >
                  <Pressable
                    onPress={() =>
                      handleUpdateField({ description: editDescription })
                    }
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: "#6EE7B7",
                    }}
                  >
                    <Text
                      style={{
                        color: "#0B0B10",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      حفظ
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditDescription(task.description || "");
                      setEditingField(null);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      إلغاء
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text
                style={{
                  color: task.description
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(255,255,255,0.3)",
                  fontSize: 14,
                  textAlign: "right",
                  lineHeight: 22,
                }}
              >
                {task.description || "لا يوجد وصف"}
              </Text>
            )}
          </View>

          {task.tags && task.tags.length > 0 ? (
            <View
              style={{
                flexDirection: "row-reverse",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 16,
              }}
            >
              {task.tags
                .filter(
                  (t) =>
                    t !== "__system_deleted__" &&
                    t !== "__closed_not_completed__",
                )
                .map((tag, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: "rgba(167,139,250,0.12)",
                      borderWidth: 1,
                      borderColor: "rgba(167,139,250,0.25)",
                    }}
                  >
                    <Text
                      style={{
                        color: "#A78BFA",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {activeTab === "checklist" ? (
        <View style={{ flex: 1 }}>
          {checklistProgress ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row-reverse",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ color: "#6EE7B7", fontSize: 12, fontWeight: "600" }}
                >
                  {checklistProgress.done} / {checklistProgress.total}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  {checklistProgress.percent}%
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: `${checklistProgress.percent}%`,
                    backgroundColor: "#6EE7B7",
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
          ) : null}
          {loadingChecklist ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <FlatList
              data={checklistItems}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 80,
                paddingTop: 4,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: item.is_completed
                      ? "rgba(110,231,183,0.06)"
                      : "rgba(255,255,255,0.03)",
                    borderWidth: 1,
                    borderColor: item.is_completed
                      ? "rgba(110,231,183,0.15)"
                      : "rgba(255,255,255,0.06)",
                    marginBottom: 6,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      handleToggleCheckItem(item.id, item.is_completed)
                    }
                    style={{ padding: 2 }}
                  >
                    {item.is_completed ? (
                      <CheckCircle2 size={22} color="#6EE7B7" />
                    ) : (
                      <Circle size={22} color="rgba(255,255,255,0.3)" />
                    )}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: item.is_completed
                          ? "rgba(255,255,255,0.4)"
                          : "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                        textAlign: "right",
                        textDecorationLine: item.is_completed
                          ? "line-through"
                          : "none",
                      }}
                    >
                      {item.title}
                    </Text>
                    {item.assignee_name ? (
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 11,
                          textAlign: "right",
                          marginTop: 2,
                        }}
                      >
                        {item.assignee_name}
                      </Text>
                    ) : null}
                  </View>
                  {item.due_date ? (
                    <Text
                      style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
                    >
                      {formatDateShort(item.due_date)}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => handleDeleteCheckItem(item.id)}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={16} color="rgba(248,113,113,0.6)" />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <ListChecks size={36} color="rgba(255,255,255,0.15)" />
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 10,
                      fontSize: 14,
                    }}
                  >
                    لا توجد عناصر في القائمة
                  </Text>
                </View>
              }
            />
          )}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: insets.bottom + 12,
              backgroundColor: "rgba(11,11,16,0.95)",
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              flexDirection: "row-reverse",
              gap: 10,
            }}
          >
            <TextInput
              value={newCheckItem}
              onChangeText={setNewCheckItem}
              placeholder="عنصر جديد..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              onSubmitEditing={handleAddCheckItem}
              returnKeyType="done"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 14,
                paddingHorizontal: 14,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 14,
                textAlign: "right",
              }}
            />
            <Pressable
              onPress={handleAddCheckItem}
              disabled={!newCheckItem.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: newCheckItem.trim()
                  ? "#6EE7B7"
                  : "rgba(255,255,255,0.06)",
              }}
            >
              <Plus
                size={20}
                color={
                  newCheckItem.trim() ? "#0B0B10" : "rgba(255,255,255,0.3)"
                }
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      {activeTab === "updates" ? (
        <View style={{ flex: 1 }}>
          {loadingUpdates ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <FlatList
              data={updates}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 80,
                paddingTop: 12,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row-reverse",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      {item.author_name}
                    </Text>
                    <Text
                      style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}
                    >
                      {timeAgo(item.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 14,
                      textAlign: "right",
                      lineHeight: 22,
                    }}
                  >
                    {item.body}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <MessageSquare size={36} color="rgba(255,255,255,0.15)" />
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 10,
                      fontSize: 14,
                    }}
                  >
                    لا توجد تحديثات
                  </Text>
                </View>
              }
            />
          )}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: insets.bottom + 12,
              backgroundColor: "rgba(11,11,16,0.95)",
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              flexDirection: "row-reverse",
              gap: 10,
            }}
          >
            <TextInput
              value={newUpdate}
              onChangeText={setNewUpdate}
              placeholder="أضف تحديث..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 100,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 14,
                textAlign: "right",
              }}
            />
            <Pressable
              onPress={handleSendUpdate}
              disabled={!newUpdate.trim() || sendingUpdate}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  newUpdate.trim() && !sendingUpdate
                    ? "#7DD3FC"
                    : "rgba(255,255,255,0.06)",
              }}
            >
              {sendingUpdate ? (
                <ActivityIndicator size={16} color="#0B0B10" />
              ) : (
                <Send
                  size={20}
                  color={newUpdate.trim() ? "#0B0B10" : "rgba(255,255,255,0.3)"}
                  style={{ transform: [{ scaleX: -1 }] }}
                />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={showStatusPicker} transparent animationType="fade">
        <Pressable
          onPress={() => setShowStatusPicker(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              backgroundColor: "#1A1A24",
              borderRadius: 20,
              padding: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleStatusChange(opt.value)}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor:
                    task.status === opt.value
                      ? `${opt.color}15`
                      : "transparent",
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: opt.color,
                  }}
                />
                <Text
                  style={{
                    color:
                      task.status === opt.value
                        ? opt.color
                        : "rgba(255,255,255,0.7)",
                    fontSize: 16,
                    fontWeight: task.status === opt.value ? "800" : "600",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showPriorityPicker} transparent animationType="fade">
        <Pressable
          onPress={() => setShowPriorityPicker(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              backgroundColor: "#1A1A24",
              borderRadius: 20,
              padding: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handlePriorityChange(opt.value)}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor:
                    task.priority === opt.value
                      ? `${opt.color}15`
                      : "transparent",
                }}
              >
                <Flag size={16} color={opt.color} />
                <Text
                  style={{
                    color:
                      task.priority === opt.value
                        ? opt.color
                        : "rgba(255,255,255,0.7)",
                    fontSize: 16,
                    fontWeight: task.priority === opt.value ? "800" : "600",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingAnimatedView>
  );
}

const sectionStyle = {
  marginBottom: 16,
  padding: 16,
  borderRadius: 18,
  backgroundColor: "rgba(255,255,255,0.03)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
};
const infoRowStyle = {
  flexDirection: "row-reverse",
  alignItems: "center",
  gap: 10,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255,255,255,0.06)",
};
const infoLabelStyle = {
  color: "rgba(255,255,255,0.5)",
  fontSize: 13,
  fontWeight: "600",
  flex: 1,
  textAlign: "right",
};
