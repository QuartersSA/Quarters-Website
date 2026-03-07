import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  MessageSquare,
  PlayCircle,
  ListTodo,
  HeartPulse,
  LogOut,
  Settings,
} from "lucide-react-native";
import { router } from "expo-router";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

function greetingText() {
  const hr = new Date().getHours();
  if (hr < 12) return "صباح الخير";
  return "مساء الخير";
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

const STATUS_CYCLE = ["Todo", "In Progress", "Done"];
function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return "In Progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function TaskRow({ task, onQuickStatus, changingId }) {
  const status = task.status || "Todo";
  const isDone = status === "Done";
  const isChanging = changingId === task.id;

  const statusIcon = isChanging ? (
    <ActivityIndicator size={16} color="rgba(255,255,255,0.4)" />
  ) : isDone ? (
    <CheckCircle2 size={18} color="#6EE7B7" />
  ) : status === "In Progress" ? (
    <PlayCircle size={18} color="#7DD3FC" />
  ) : (
    <Circle size={18} color="rgba(255,255,255,0.3)" />
  );

  return (
    <Pressable
      onPress={() => onQuickStatus(task.id, nextStatus(status))}
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        marginBottom: 6,
        opacity: isDone ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {statusIcon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: "#fff",
            fontSize: 14,
            fontWeight: "600",
            textAlign: "right",
            textDecorationLine: isDone ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {task.space_name ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              textAlign: "right",
              marginTop: 2,
            }}
          >
            {task.space_name}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function HealthScoreSection({ healthScore }) {
  const { percent, onTime, late, totalDone } = healthScore;

  if (totalDone === 0) {
    return (
      <View style={sectionStyle}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <HeartPulse size={18} color="rgba(255,255,255,0.4)" />
          <Text
            style={{
              color: "#fff",
              fontSize: 15,
              fontWeight: "800",
              textAlign: "right",
            }}
          >
            مؤشر صحة المهام
          </Text>
        </View>
        <Text
          style={{
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            paddingVertical: 16,
            fontSize: 13,
          }}
        >
          لا توجد مهام مكتملة هذا الشهر بعد
        </Text>
      </View>
    );
  }

  const safePercent = typeof percent === "number" ? percent : 0;
  const gaugeColor =
    safePercent >= 80 ? "#6EE7B7" : safePercent >= 50 ? "#FCD34D" : "#F87171";
  const gaugeLabel =
    safePercent >= 80 ? "ممتاز" : safePercent >= 50 ? "مقبول" : "ضعيف";

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <View style={sectionStyle}>
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <HeartPulse size={18} color={gaugeColor} />
        <View>
          <Text
            style={{
              color: "#fff",
              fontSize: 15,
              fontWeight: "800",
              textAlign: "right",
            }}
          >
            مؤشر صحة المهام
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              textAlign: "right",
            }}
          >
            المهام المُقفلة هذا الشهر بناءً على سجل التأخير
          </Text>
        </View>
      </View>

      <View
        style={{ flexDirection: "row-reverse", alignItems: "center", gap: 18 }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg
            width={100}
            height={100}
            viewBox="0 0 100 100"
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            <SvgCircle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={8}
            />
            <SvgCircle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
            />
          </Svg>
          <View style={{ position: "absolute", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>
              {safePercent}%
            </Text>
            <Text
              style={{ color: gaugeColor, fontSize: 11, fontWeight: "700" }}
            >
              {gaugeLabel}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row-reverse", gap: 6 }}>
            <View style={detailBoxStyle}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
                {totalDone}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
                مُقفلة
              </Text>
            </View>
            <View
              style={{
                ...detailBoxStyle,
                backgroundColor: "rgba(110,231,183,0.08)",
                borderColor: "rgba(110,231,183,0.18)",
              }}
            >
              <Text
                style={{ color: "#6EE7B7", fontSize: 18, fontWeight: "800" }}
              >
                {onTime}
              </Text>
              <Text style={{ color: "rgba(110,231,183,0.6)", fontSize: 10 }}>
                بدون تأخير
              </Text>
            </View>
          </View>
          <View
            style={{
              ...detailBoxStyle,
              backgroundColor: "rgba(248,113,113,0.08)",
              borderColor: "rgba(248,113,113,0.18)",
            }}
          >
            <Text style={{ color: "#F87171", fontSize: 18, fontWeight: "800" }}>
              {late}
            </Text>
            <Text style={{ color: "rgba(248,113,113,0.6)", fontSize: 10 }}>
              سجل المتأخرة
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, employeeId, signOut } = useWorkspaceAuth();
  const myId = employeeId;
  const userName = user?.name || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changingId, setChangingId] = useState(null);

  const fetchSummary = useCallback(
    async (isRefresh) => {
      if (!myId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(
          `${BASE}/api/workspace/summary?employeeId=${myId}`,
        );
        if (!res.ok) throw new Error("فشل التحميل");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [myId],
  );

  useEffect(() => {
    fetchSummary(false);
  }, [fetchSummary]);

  const handleQuickStatus = useCallback(
    async (taskId, newStatus) => {
      setChangingId(taskId);
      try {
        await fetch(`${BASE}/api/workspace/tasks/quick-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: myId, taskId, status: newStatus }),
        });
        fetchSummary(false);
      } catch (e) {
        console.error(e);
      } finally {
        setChangingId(null);
      }
    },
    [myId, fetchSummary],
  );

  const stats = data?.stats || { todo: 0, inProgress: 0, done: 0 };
  const todayTasks = data?.myTasksToday || [];
  const overdueTasks = data?.myOverdueTasks || [];
  const upcomingTasks = data?.upcomingTasks || [];
  const unreadCount = data?.unreadCount || 0;
  const healthScore = data?.healthScore || {
    percent: null,
    onTime: 0,
    late: 0,
    totalDone: 0,
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
    >
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSummary(true)}
            tintColor="#fff"
          />
        }
      >
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                color: "#fff",
                fontSize: 22,
                fontWeight: "900",
                textAlign: "right",
              }}
            >
              {greetingText()}، {userName}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                marginTop: 4,
                textAlign: "right",
              }}
            >
              ملخص يومك
            </Text>
          </View>
          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/settings")}
              style={{
                padding: 8,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Settings size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace("/login");
              }}
              style={{
                padding: 8,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <LogOut size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
            >
              <View
                style={{
                  flexDirection: "row-reverse",
                  gap: 10,
                  paddingHorizontal: 18,
                  paddingBottom: 14,
                }}
              >
                <View style={statCardStyle("#FCD34D")}>
                  <ListTodo size={20} color="#FCD34D" />
                  <Text style={statNumStyle}>{stats.todo}</Text>
                  <Text style={statLabelStyle}>للإنجاز</Text>
                </View>
                <View style={statCardStyle("#7DD3FC")}>
                  <PlayCircle size={20} color="#7DD3FC" />
                  <Text style={statNumStyle}>{stats.inProgress}</Text>
                  <Text style={statLabelStyle}>قيد التنفيذ</Text>
                </View>
                <View style={statCardStyle("#6EE7B7")}>
                  <CheckCircle2 size={20} color="#6EE7B7" />
                  <Text style={statNumStyle}>{stats.done}</Text>
                  <Text style={statLabelStyle}>مكتملة</Text>
                </View>
                <View
                  style={statCardStyle(
                    unreadCount > 0 ? "#F87171" : "rgba(255,255,255,0.4)",
                  )}
                >
                  <MessageSquare
                    size={20}
                    color={
                      unreadCount > 0 ? "#F87171" : "rgba(255,255,255,0.4)"
                    }
                  />
                  <Text style={statNumStyle}>{unreadCount}</Text>
                  <Text style={statLabelStyle}>رسائل</Text>
                </View>
              </View>
            </ScrollView>

            <HealthScoreSection healthScore={healthScore} />

            {overdueTasks.length > 0 ? (
              <View style={sectionStyle}>
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#F87171" />
                  <Text
                    style={{
                      color: "#F87171",
                      fontSize: 15,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    متأخرة ({overdueTasks.length})
                  </Text>
                </View>
                {overdueTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onQuickStatus={handleQuickStatus}
                    changingId={changingId}
                  />
                ))}
              </View>
            ) : null}

            <View style={sectionStyle}>
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <CalendarDays size={18} color="#6EE7B7" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  مهام اليوم
                </Text>
              </View>
              {todayTasks.length === 0 ? (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    textAlign: "center",
                    paddingVertical: 16,
                  }}
                >
                  🎉 لا توجد مهام مستحقة اليوم
                </Text>
              ) : (
                todayTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onQuickStatus={handleQuickStatus}
                    changingId={changingId}
                  />
                ))
              )}
            </View>

            {upcomingTasks.length > 0 ? (
              <View style={sectionStyle}>
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <Clock size={18} color="#A78BFA" />
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    القادمة (7 أيام)
                  </Text>
                </View>
                {upcomingTasks.map((t) => (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: "600",
                          textAlign: "right",
                        }}
                      >
                        {t.title}
                      </Text>
                    </View>
                    <Text
                      style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}
                    >
                      {formatDateShort(t.due_date)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const statCardStyle = () => ({
  width: 100,
  padding: 14,
  borderRadius: 18,
  backgroundColor: "rgba(255,255,255,0.04)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  alignItems: "center",
  gap: 6,
});

const statNumStyle = {
  color: "#fff",
  fontSize: 22,
  fontWeight: "900",
};

const statLabelStyle = {
  color: "rgba(255,255,255,0.5)",
  fontSize: 11,
  fontWeight: "600",
};

const sectionStyle = {
  marginHorizontal: 18,
  marginBottom: 16,
  padding: 16,
  borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.03)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
};

const detailBoxStyle = {
  flex: 1,
  padding: 10,
  borderRadius: 14,
  backgroundColor: "rgba(255,255,255,0.03)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  alignItems: "center",
  gap: 2,
};
