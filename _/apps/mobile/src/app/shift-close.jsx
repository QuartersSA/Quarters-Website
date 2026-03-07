import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import {
  Calculator,
  LogOut,
  CheckCircle2,
  Info,
  Send,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

function safeNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function diffInfo(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0)
    return { label: "متطابق", color: "rgba(255,255,255,0.5)" };
  if (n < 0) return { label: "عجز", color: "#F87171" };
  return { label: "زيادة", color: "#6EE7B7" };
}

export default function ShiftCloseScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useWorkspaceAuth();

  const branches = useMemo(() => {
    return Array.isArray(user?.branches)
      ? user.branches.filter((b) => b && b.id)
      : [];
  }, [user]);

  const [branchId, setBranchId] = useState(() =>
    branches.length > 0 ? String(branches[0].id) : "",
  );
  const [shiftDate, setShiftDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [shiftLabel, setShiftLabel] = useState(""); // "صباحي" | "مسائي"
  const [actualCash, setActualCash] = useState("");
  const [actualCard, setActualCard] = useState("");
  const [foodicsCash, setFoodicsCash] = useState("");
  const [foodicsCard, setFoodicsCard] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut]);

  const money = useMemo(() => {
    const ac = safeNum(actualCash) ?? 0;
    const acd = safeNum(actualCard) ?? 0;
    const fc = safeNum(foodicsCash) ?? 0;
    const fcd = safeNum(foodicsCard) ?? 0;
    const cashDiff = ac - fc;
    const cardDiff = acd - fcd;
    const totalDiff = cashDiff + cardDiff;
    return { cashDiff, cardDiff, totalDiff };
  }, [actualCash, actualCard, foodicsCash, foodicsCard]);

  const canSubmit = useMemo(() => {
    return (
      !!branchId &&
      !!shiftDate &&
      !!shiftLabel &&
      safeNum(actualCash) !== null &&
      safeNum(actualCard) !== null &&
      safeNum(foodicsCash) !== null &&
      safeNum(foodicsCard) !== null
    );
  }, [
    branchId,
    shiftDate,
    shiftLabel,
    actualCash,
    actualCard,
    foodicsCash,
    foodicsCard,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${BASE}/api/accounting/shift-closings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: user?.id,
          branchId: Number(branchId),
          shiftDate,
          shiftLabel,
          actualCash: safeNum(actualCash),
          actualCard: safeNum(actualCard),
          foodicsCash: safeNum(foodicsCash),
          foodicsCard: safeNum(foodicsCard),
          note: note.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل حفظ التقفيلة");

      const td = Number(data?.closing?.total_diff);
      const info = diffInfo(td);
      setSuccess(`تم الحفظ — ${info.label} (${formatMoney(td)})`);

      // Reset form
      setShiftLabel("");
      setActualCash("");
      setActualCard("");
      setFoodicsCash("");
      setFoodicsCard("");
      setNote("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    submitting,
    token,
    user,
    branchId,
    shiftDate,
    shiftLabel,
    actualCash,
    actualCard,
    foodicsCash,
    foodicsCard,
    note,
  ]);

  const cashInfo = diffInfo(money.cashDiff);
  const cardInfo = diffInfo(money.cardDiff);
  const totalInfo = diffInfo(money.totalDiff);

  const inputStyle = {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    color: "#fff",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#0B0B10" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />

      <View style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
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
            <Calculator size={22} color="#C4B5FD" />
            <View>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
                تقفيلة الشفت
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                {user?.name || ""}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleLogout}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 6,
              padding: 8,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <LogOut size={16} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              خروج
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info */}
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderRadius: 16,
            backgroundColor: "rgba(196,181,253,0.08)",
            borderWidth: 1,
            borderColor: "rgba(196,181,253,0.15)",
            marginBottom: 16,
          }}
        >
          <Info size={18} color="#C4B5FD" />
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              flex: 1,
              textAlign: "right",
              lineHeight: 20,
            }}
          >
            الفرق = الفعلي − فودكس{"\n"}سالب = عجز، موجب = زيادة
          </Text>
        </View>

        {/* Branch */}
        <Text style={labelStyle}>الفرع</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: 16 }}
        >
          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            {branches.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => setBranchId(String(b.id))}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor:
                    branchId === String(b.id)
                      ? "rgba(196,181,253,0.15)"
                      : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor:
                    branchId === String(b.id)
                      ? "rgba(196,181,253,0.3)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    color:
                      branchId === String(b.id)
                        ? "#C4B5FD"
                        : "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Date */}
        <Text style={labelStyle}>التاريخ</Text>
        <TextInput
          value={shiftDate}
          onChangeText={setShiftDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={{
            ...inputStyle,
            textAlign: "right",
            fontSize: 15,
            fontWeight: "600",
            marginBottom: 16,
          }}
        />

        {/* Shift type */}
        <Text style={labelStyle}>نوع الشفت</Text>
        <View
          style={{ flexDirection: "row-reverse", gap: 10, marginBottom: 16 }}
        >
          {[
            { key: "صباحي", label: "صباحي ☀️" },
            { key: "مسائي", label: "مسائي 🌙" },
          ].map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setShiftLabel(s.key)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor:
                  shiftLabel === s.key
                    ? "rgba(196,181,253,0.15)"
                    : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor:
                  shiftLabel === s.key
                    ? "rgba(196,181,253,0.3)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              <Text
                style={{
                  color:
                    shiftLabel === s.key ? "#C4B5FD" : "rgba(255,255,255,0.6)",
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Money inputs */}
        <View style={{ gap: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>الكاش الفعلي</Text>
              <TextInput
                value={actualCash}
                onChangeText={setActualCash}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>الشبكة الفعلية</Text>
              <TextInput
                value={actualCard}
                onChangeText={setActualCard}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={inputStyle}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>كاش فودكس</Text>
              <TextInput
                value={foodicsCash}
                onChangeText={setFoodicsCash}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>شبكة فودكس</Text>
              <TextInput
                value={foodicsCard}
                onChangeText={setFoodicsCard}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={inputStyle}
              />
            </View>
          </View>
        </View>

        {/* Note */}
        <Text style={labelStyle}>ملاحظة (اختياري)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="أي توضيح…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={{
            ...inputStyle,
            textAlign: "right",
            fontSize: 14,
            fontWeight: "500",
            marginBottom: 16,
          }}
        />

        {/* Summary cards */}
        <View
          style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 16 }}
        >
          {[
            { label: "فرق الكاش", value: money.cashDiff, info: cashInfo },
            { label: "فرق الشبكة", value: money.cardDiff, info: cardInfo },
            { label: "الإجمالي", value: money.totalDiff, info: totalInfo },
          ].map((c, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>
                {c.label}
              </Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                {formatMoney(c.value)}
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: `${c.info.color}18`,
                }}
              >
                <Text
                  style={{
                    color: c.info.color,
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {c.info.label}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Error / Success */}
        {error ? (
          <View
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: "rgba(239,68,68,0.12)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.22)",
              marginBottom: 12,
            }}
          >
            <Text
              style={{ color: "#FCA5A5", textAlign: "right", fontSize: 13 }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {success ? (
          <View
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: "rgba(110,231,183,0.12)",
              borderWidth: 1,
              borderColor: "rgba(110,231,183,0.22)",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "#6EE7B7",
                textAlign: "right",
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {success}
            </Text>
          </View>
        ) : null}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            height: 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row-reverse",
            gap: 8,
            backgroundColor:
              !canSubmit || submitting ? "rgba(255,255,255,0.08)" : "#C4B5FD",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#0B0B10" />
          ) : (
            <>
              <Send size={18} color="#0B0B10" />
              <Text
                style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}
              >
                حفظ وإرسال
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}

const labelStyle = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 13,
  fontWeight: "600",
  textAlign: "right",
  marginBottom: 6,
};
