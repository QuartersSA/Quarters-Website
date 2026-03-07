import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import { LogIn, Package, Calculator, Shield } from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useWorkspaceAuth();

  const [mode, setMode] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0;
  }, [username, password]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/employees/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || "فشل تسجيل الدخول";
        throw new Error(msg);
      }

      const employee = data?.employee;
      const token = data?.token;
      if (!employee?.id) {
        throw new Error("بيانات المستخدم غير مكتملة");
      }
      if (!token) {
        throw new Error("تعذر الحصول على توكن الدخول");
      }

      if (mode === "admin") {
        if (!employee.can_access_workspace && employee.role !== "Admin") {
          throw new Error("حسابك لا يملك صلاحية دخول الإدارة");
        }
        await setUser({ ...employee, token, loginMode: "admin" });
        router.replace("/(tabs)/home");
      } else if (mode === "inventory") {
        if (!employee.can_do_inventory && !employee.can_manage_inventory) {
          throw new Error("حسابك لا يملك صلاحية الجرد");
        }
        const branches = Array.isArray(employee.branches)
          ? employee.branches
          : [];
        if (branches.length === 0) {
          throw new Error("لا يوجد فروع مرتبطة بحسابك");
        }
        await setUser({
          ...employee,
          token,
          loginMode: "inventory",
          branchId: branches[0].id,
          branchName: branches[0].name,
        });
        router.replace("/employee-inventory");
      } else if (mode === "shift") {
        if (!employee.can_close_shift) {
          throw new Error("حسابك لا يملك صلاحية تقفيلة الشفت");
        }
        const branches = Array.isArray(employee.branches)
          ? employee.branches
          : [];
        if (branches.length === 0) {
          throw new Error("لا يوجد فروع مرتبطة بحسابك");
        }
        await setUser({ ...employee, token, loginMode: "shift", branches });
        router.replace("/shift-close");
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, loading, username, password, setUser, mode]);

  const modeOptions = [
    {
      key: "admin",
      icon: Shield,
      title: "الإدارة",
      subtitle: "المهام والمخزون",
      color: "#6EE7B7",
    },
    {
      key: "inventory",
      icon: Package,
      title: "الجرد",
      subtitle: "جرد يومي للموظفين",
      color: "#7DD3FC",
    },
    {
      key: "shift",
      icon: Calculator,
      title: "تقفيلة الشفت",
      subtitle: "تقفيلة كاش وشبكة",
      color: "#C4B5FD",
    },
  ];

  if (!mode) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
      >
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: "900",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            مرحباً بك
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 15,
              textAlign: "center",
              marginBottom: 40,
            }}
          >
            اختر نوع الدخول
          </Text>

          {modeOptions.map((opt) => {
            const IconComp = opt.icon;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setMode(opt.key);
                  setError(null);
                  setUsername("");
                  setPassword("");
                }}
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  gap: 16,
                  padding: 20,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    backgroundColor: `${opt.color}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconComp size={26} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 13,
                      textAlign: "right",
                      marginTop: 2,
                    }}
                  >
                    {opt.subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => router.push("/privacy-policy")}
            style={{
              marginTop: 20,
              alignItems: "center",
              padding: 12,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              سياسة الخصوصية
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const selectedMode = modeOptions.find((m) => m.key === mode);
  const ModeIcon = selectedMode?.icon || LogIn;
  const modeColor = selectedMode?.color || "#fff";

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#0B0B10" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 18,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            setMode(null);
            setError(null);
          }}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 6,
            marginBottom: 20,
            alignSelf: "flex-end",
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
            رجوع
          </Text>
        </Pressable>

        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: `${modeColor}18`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <ModeIcon size={32} color={modeColor} />
          </View>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
            {selectedMode?.title}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              marginTop: 6,
              fontSize: 14,
            }}
          >
            أدخل بيانات الدخول
          </Text>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            gap: 14,
          }}
        >
          <View style={{ gap: 8 }}>
            <Text
              style={{ color: "rgba(255,255,255,0.75)", textAlign: "right" }}
            >
              اسم المستخدم
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              style={{
                height: 48,
                borderRadius: 14,
                paddingHorizontal: 14,
                backgroundColor: "rgba(0,0,0,0.35)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                color: "#fff",
                textAlign: "right",
                fontSize: 15,
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text
              style={{ color: "rgba(255,255,255,0.75)", textAlign: "right" }}
            >
              كلمة المرور
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              secureTextEntry
              style={{
                height: 48,
                borderRadius: 14,
                paddingHorizontal: 14,
                backgroundColor: "rgba(0,0,0,0.35)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                color: "#fff",
                textAlign: "right",
                fontSize: 15,
              }}
              onSubmitEditing={onSubmit}
              returnKeyType="done"
            />
          </View>

          {error ? (
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(239,68,68,0.12)",
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.22)",
              }}
            >
              <Text style={{ color: "#FCA5A5", textAlign: "right" }}>
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || loading}
            style={{
              height: 50,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                !canSubmit || loading ? "rgba(255,255,255,0.10)" : "#FFFFFF",
            }}
          >
            {loading ? (
              <ActivityIndicator color={canSubmit ? "#0B0B10" : "#fff"} />
            ) : (
              <Text
                style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}
              >
                دخول
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/privacy-policy")}
            style={{
              marginTop: 8,
              alignItems: "center",
              padding: 8,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              سياسة الخصوصية
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}
