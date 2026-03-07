import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import { router } from "expo-router";
import {
  ClipboardList,
  Circle,
  CheckCircle2,
  PlayCircle,
  Search,
  Plus,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

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

const STATUS_CYCLE = ["Todo", "In Progress", "Done"];

function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return "In Progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

const PRIORITY_COLORS = {
  Urgent: "#F87171",
  High: "#FB923C",
  Normal: "#60A5FA",
  Low: "#9CA3AF",
};

const STATUS_LABELS = {
  Todo: "للإنجاز",
  "In Progress": "قيد التنفيذ",
  Done: "مكتملة",
};

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { user, employeeId } = useWorkspaceAuth();
  const myId = employeeId;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [changingId, setChangingId] = useState(null);

  const fetchTasks = useCallback(
    async (isRefresh) => {
      if (!myId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(
          `${BASE}/api/workspace/tasks?employeeId=${myId}&scope=my&status=all`,
        );
        if (!res.ok) throw new Error("فشل التحميل");
        const data = await res.json();
        setTasks(data.tasks || []);
        setError(null);
      } catch (e) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [myId],
  );

  useEffect(() => {
    fetchTasks(false);
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.space_name || "").toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const handleQuickStatus = useCallback(
    async (taskId, newStatus) => {
      setChangingId(taskId);
      try {
        const res = await fetch(`${BASE}/api/workspace/tasks/quick-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: myId, taskId, status: newStatus }),
        });
        if (!res.ok) throw new Error("فشل");
        fetchTasks(false);
      } catch (e) {
        console.error(e);
      } finally {
        setChangingId(null);
      }
    },
    [myId, fetchTasks],
  );

  const stats = useMemo(() => {
    let todo = 0;
    let inProg = 0;
    let done = 0;
    for (const t of tasks) {
      if (t.status === "Todo") todo++;
      else if (t.status === "In Progress") inProg++;
      else if (t.status === "Done") done++;
    }
    return { todo, inProg, done, total: tasks.length };
  }, [tasks]);

  const renderTask = useCallback(
    ({ item }) => {
      const status = item.status || "Todo";
      const isDone = status === "Done";
      const isChanging = changingId === item.id;
      const priorityColor =
        PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.Normal;

      const statusIcon = isChanging ? (
        <ActivityIndicator size={18} color="rgba(255,255,255,0.4)" />
      ) : isDone ? (
        <CheckCircle2 size={20} color="#6EE7B7" />
      ) : status === "In Progress" ? (
        <PlayCircle size={20} color="#7DD3FC" />
      ) : (
        <Circle size={20} color="rgba(255,255,255,0.3)" />
      );

      return (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/task-detail", params: { id: item.id } })
          }
          onLongPress={() => handleQuickStatus(item.id, nextStatus(status))}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 12,
            padding: 14,
            marginHorizontal: 16,
            marginBottom: 8,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            opacity: isDone ? 0.55 : 1,
          }}
        >
          <Pressable
            onPress={() => handleQuickStatus(item.id, nextStatus(status))}
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {statusIcon}
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
                textAlign: "right",
                textDecorationLine: isDone ? "line-through" : "none",
              }}
            >
              {item.title}
            </Text>
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              {item.space_name ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    textAlign: "right",
                  }}
                >
                  {item.space_name}
                </Text>
              ) : null}
              {item.due_date ? (
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                  {formatDateShort(item.due_date)}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: `${priorityColor}22`,
                borderWidth: 1,
                borderColor: `${priorityColor}44`,
              }}
            >
              <Text
                style={{
                  color: priorityColor,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {item.priority}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [changingId, handleQuickStatus],
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
    >
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 10,
          }}
        >
          <ClipboardList size={22} color="#6EE7B7" />
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
            المهام
          </Text>
        </View>
        <View
          style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}
        >
          <Pressable
            onPress={() => router.push("/create-task")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(110,231,183,0.15)",
              borderWidth: 1,
              borderColor: "rgba(110,231,183,0.25)",
            }}
          >
            <Plus size={18} color="#6EE7B7" />
          </Pressable>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {stats.todo} للإنجاز
            </Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            height: 42,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Search size={16} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="بحث في المهام…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{
              flex: 1,
              color: "#fff",
              fontSize: 14,
              textAlign: "right",
            }}
          />
        </View>
      </View>

      {/* Task List */}
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color="#fff" />
          <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
            جاري التحميل…
          </Text>
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <AlertTriangle size={32} color="#F87171" />
          <Text
            style={{ color: "#FCA5A5", marginTop: 12, textAlign: "center" }}
          >
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTask}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: insets.bottom + 80,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTasks(true)}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              <ClipboardList size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
                لا توجد مهام
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
