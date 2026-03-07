import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import {
  X,
  Flag,
  Calendar,
  Users,
  Layers,
  Send,
  Check,
  ChevronDown,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

const PRIORITY_OPTIONS = [
  { value: "Low", label: "منخفضة", color: "#9CA3AF" },
  { value: "Normal", label: "عادية", color: "#60A5FA" },
  { value: "High", label: "عالية", color: "#FB923C" },
  { value: "Urgent", label: "عاجلة", color: "#F87171" },
];

export default function CreateTaskScreen() {
  const insets = useSafeAreaInsets();
  const { employeeId } = useWorkspaceAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);

  const [spaces, setSpaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        const [spacesRes, usersRes] = await Promise.all([
          fetch(`${BASE}/api/workspace/spaces?employeeId=${employeeId}`),
          fetch(`${BASE}/api/workspace/users?employeeId=${employeeId}`),
        ]);
        if (spacesRes.ok) {
          const d = await spacesRes.json();
          setSpaces(d.spaces || []);
        }
        if (usersRes.ok) {
          const d = await usersRes.json();
          setUsers(d.users || []);
          setSelectedAssigneeIds([employeeId]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [employeeId]);

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && dueDate && selectedSpaceId;
  }, [title, dueDate, selectedSpaceId]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/workspace/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueDate,
          spaceId: selectedSpaceId,
          assigneeEmployeeIds:
            selectedAssigneeIds.length > 0 ? selectedAssigneeIds : [employeeId],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "فشل إنشاء المهمة");
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    submitting,
    employeeId,
    title,
    description,
    priority,
    dueDate,
    selectedSpaceId,
    selectedAssigneeIds,
    queryClient,
  ]);

  const priorityInfo = useMemo(
    () =>
      PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[1],
    [priority],
  );
  const selectedSpace = useMemo(
    () => spaces.find((s) => s.id === selectedSpaceId),
    [spaces, selectedSpaceId],
  );
  const selectedAssigneeNames = useMemo(
    () =>
      users
        .filter((u) => selectedAssigneeIds.includes(u.id))
        .map((u) => u.name),
    [users, selectedAssigneeIds],
  );

  const toggleAssignee = useCallback((userId) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }, []);

  if (loadingData) {
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
            مهمة جديدة
          </Text>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>العنوان *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان المهمة..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "800",
              textAlign: "right",
              padding: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              minHeight: 56,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>الوصف</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="أضف وصف..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            style={{
              color: "#fff",
              fontSize: 14,
              textAlign: "right",
              padding: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              minHeight: 80,
              lineHeight: 22,
            }}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>المساحة *</Text>
          <Pressable
            onPress={() => setShowSpacePicker(true)}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: selectedSpaceId
                ? "rgba(167,139,250,0.3)"
                : "rgba(255,255,255,0.10)",
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Layers
                size={18}
                color={selectedSpaceId ? "#A78BFA" : "rgba(255,255,255,0.4)"}
              />
              <Text
                style={{
                  color: selectedSpaceId ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {selectedSpace?.name || "اختر المساحة"}
              </Text>
            </View>
            <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>تاريخ الاستحقاق *</Text>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
              padding: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Calendar size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                flex: 1,
                color: "#fff",
                fontSize: 15,
                fontWeight: "600",
                textAlign: "right",
              }}
            />
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>الأولوية</Text>
          <Pressable
            onPress={() => setShowPriorityPicker(true)}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 14,
              borderRadius: 16,
              backgroundColor: `${priorityInfo.color}12`,
              borderWidth: 1,
              borderColor: `${priorityInfo.color}30`,
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Flag size={18} color={priorityInfo.color} />
              <Text
                style={{
                  color: priorityInfo.color,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {priorityInfo.label}
              </Text>
            </View>
            <ChevronDown size={16} color={priorityInfo.color} />
          </Pressable>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={labelStyle}>المكلّفون</Text>
          <Pressable
            onPress={() => setShowAssigneePicker(true)}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <Users size={18} color="rgba(255,255,255,0.4)" />
              <Text
                numberOfLines={1}
                style={{
                  color:
                    selectedAssigneeNames.length > 0
                      ? "#fff"
                      : "rgba(255,255,255,0.4)",
                  fontSize: 14,
                  fontWeight: "600",
                  flex: 1,
                  textAlign: "right",
                }}
              >
                {selectedAssigneeNames.length > 0
                  ? selectedAssigneeNames.join("، ")
                  : "اختر المكلّفين"}
              </Text>
            </View>
            <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            height: 52,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row-reverse",
            gap: 8,
            backgroundColor:
              !canSubmit || submitting ? "rgba(255,255,255,0.08)" : "#6EE7B7",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#0B0B10" />
          ) : (
            <>
              <Send
                size={18}
                color="#0B0B10"
                style={{ transform: [{ scaleX: -1 }] }}
              />
              <Text
                style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}
              >
                إنشاء المهمة
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>

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
                onPress={() => {
                  setPriority(opt.value);
                  setShowPriorityPicker(false);
                }}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor:
                    priority === opt.value ? `${opt.color}15` : "transparent",
                }}
              >
                <Flag size={16} color={opt.color} />
                <Text
                  style={{
                    color:
                      priority === opt.value
                        ? opt.color
                        : "rgba(255,255,255,0.7)",
                    fontSize: 16,
                    fontWeight: priority === opt.value ? "800" : "600",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showSpacePicker} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            paddingTop: 80,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#0B0B10",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                borderBottomWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
                اختر المساحة
              </Text>
              <Pressable onPress={() => setShowSpacePicker(false)}>
                <X size={22} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <FlatList
              data={spaces}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedSpaceId(item.id);
                    setShowSpacePicker(false);
                  }}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderColor: "rgba(255,255,255,0.05)",
                    backgroundColor:
                      selectedSpaceId === item.id
                        ? "rgba(167,139,250,0.08)"
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: selectedSpaceId === item.id ? "#A78BFA" : "#fff",
                      fontSize: 15,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    {item.name}
                  </Text>
                  {selectedSpaceId === item.id ? (
                    <Check size={18} color="#A78BFA" />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <Text style={{ color: "rgba(255,255,255,0.4)" }}>
                    لا توجد مساحات
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAssigneePicker} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            paddingTop: 80,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#0B0B10",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                borderBottomWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
                اختر المكلّفين
              </Text>
              <Pressable onPress={() => setShowAssigneePicker(false)}>
                <X size={22} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <FlatList
              data={users}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = selectedAssigneeIds.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggleAssignee(item.id)}
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderColor: "rgba(255,255,255,0.05)",
                      backgroundColor: isSelected
                        ? "rgba(110,231,183,0.08)"
                        : "transparent",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: isSelected ? "#6EE7B7" : "#fff",
                          fontSize: 15,
                          fontWeight: "600",
                          textAlign: "right",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontSize: 11,
                          textAlign: "right",
                        }}
                      >
                        {item.role}
                      </Text>
                    </View>
                    {isSelected ? <Check size={18} color="#6EE7B7" /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingAnimatedView>
  );
}

const labelStyle = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 13,
  fontWeight: "700",
  textAlign: "right",
  marginBottom: 8,
};
