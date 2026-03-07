import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import {
  Package,
  CheckCircle2,
  LogOut,
  Edit2,
  Search,
  Zap,
  Filter,
  Check,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

export default function EmployeeInventoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useWorkspaceAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableItems, setAvailableItems] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRemainingOnly, setShowRemainingOnly] = useState(false);

  const branchId = user?.branchId;
  const employeeName = user?.name || user?.username || "";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems(data.filter((it) => it.show_in_inventory !== false));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.name_en || "").toLowerCase().includes(q),
      );
    }
    if (showRemainingOnly) {
      list = list.filter((it) => availableItems[it.id] === undefined);
    }
    return list;
  }, [items, searchQuery, showRemainingOnly, availableItems]);

  const completedCount = Object.keys(availableItems).length;
  const totalCount = items.length;
  const remainingCount = totalCount - completedCount;
  const progressPercent =
    totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;

  const findNextPending = (fromId) => {
    const list = filteredItems.length > 0 ? filteredItems : items;
    const startIdx = Math.max(
      0,
      list.findIndex((it) => it.id === fromId),
    );
    for (let i = startIdx + 1; i < list.length; i++) {
      if (availableItems[list[i].id] === undefined) return list[i].id;
    }
    for (let i = 0; i < startIdx; i++) {
      if (availableItems[list[i].id] === undefined) return list[i].id;
    }
    return null;
  };

  const goToNext = (fromId) => {
    const next = findNextPending(fromId);
    setSelectedItem(next);
    setQuantity("");
  };

  const handleQuickSet = (itemId, value) => {
    setAvailableItems((prev) => ({ ...prev, [itemId]: value }));
    goToNext(itemId);
  };

  const handleConfirmAndNext = () => {
    if (!selectedItem || quantity === "") return;
    setAvailableItems((prev) => ({
      ...prev,
      [selectedItem]: parseFloat(quantity),
    }));
    goToNext(selectedItem);
  };

  const handleEditItem = (itemId) => {
    setSelectedItem(itemId);
    setQuantity(String(availableItems[itemId]));
    setAvailableItems((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (completedCount === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/inventory-operations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId,
          employeeId: user?.id,
          inventoryType: "Daily",
          availableItems,
          unavailableItems: [],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "فشل إرسال الجرد");
      }
      setShowSuccess(true);
      setTimeout(() => {
        setAvailableItems({});
        setShowSuccess(false);
      }, 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (showSuccess) {
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
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(110,231,183,0.15)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={44} color="#6EE7B7" />
        </View>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
          تم إرسال الجرد ✅
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
          شكراً لك
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
    >
      <StatusBar style="light" />

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
          <Package size={22} color="#7DD3FC" />
          <View>
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
              الجرد اليومي
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
              {employeeName}
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

      {/* Progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text style={{ color: "#6EE7B7", fontSize: 12, fontWeight: "600" }}>
            {completedCount} مكتمل
          </Text>
          <Text style={{ color: "#FCD34D", fontSize: 12, fontWeight: "600" }}>
            {remainingCount} متبقي
          </Text>
        </View>
        <View
          style={{
            height: 6,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 6,
              backgroundColor: "#6EE7B7",
              borderRadius: 3,
              width: `${progressPercent}%`,
            }}
          />
        </View>
      </View>

      {/* Search + filter */}
      <View
        style={{
          flexDirection: "row-reverse",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            height: 40,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Search size={15} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="بحث…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{ flex: 1, color: "#fff", fontSize: 13, textAlign: "right" }}
          />
        </View>
        <Pressable
          onPress={() => setShowRemainingOnly(!showRemainingOnly)}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 12,
            height: 40,
            borderRadius: 14,
            backgroundColor: showRemainingOnly
              ? "rgba(110,231,183,0.12)"
              : "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: showRemainingOnly
              ? "rgba(110,231,183,0.25)"
              : "rgba(255,255,255,0.08)",
          }}
        >
          <Filter
            size={14}
            color={showRemainingOnly ? "#6EE7B7" : "rgba(255,255,255,0.4)"}
          />
          <Text
            style={{
              color: showRemainingOnly ? "#6EE7B7" : "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {remainingCount}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasValue = availableItems[item.id] !== undefined;
            const isSelected = selectedItem === item.id;
            const unitText = item.unit || "حبة";

            return (
              <Pressable
                onPress={() => {
                  if (hasValue) {
                    handleEditItem(item.id);
                    return;
                  }
                  setSelectedItem(item.id);
                  setQuantity("");
                }}
                style={{
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 8,
                  backgroundColor: isSelected
                    ? "rgba(125,211,252,0.08)"
                    : hasValue
                      ? "rgba(110,231,183,0.06)"
                      : "rgba(255,255,255,0.03)",
                  borderWidth: 1,
                  borderColor: isSelected
                    ? "rgba(125,211,252,0.25)"
                    : hasValue
                      ? "rgba(110,231,183,0.2)"
                      : "rgba(255,255,255,0.06)",
                }}
              >
                {/* Item header */}
                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      {item.name}
                    </Text>
                    {item.unit ? (
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 11,
                          textAlign: "right",
                          marginTop: 2,
                        }}
                      >
                        {unitText}
                      </Text>
                    ) : null}
                  </View>
                  {hasValue ? (
                    <View
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row-reverse",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 10,
                          backgroundColor: "rgba(0,0,0,0.25)",
                        }}
                      >
                        <CheckCircle2 size={14} color="#6EE7B7" />
                        <Text
                          style={{
                            color: "#6EE7B7",
                            fontSize: 16,
                            fontWeight: "800",
                          }}
                        >
                          {availableItems[item.id]}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleEditItem(item.id)}
                        style={{ padding: 4 }}
                      >
                        <Edit2 size={14} color="rgba(255,255,255,0.4)" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {/* Expanded input area */}
                {isSelected && !hasValue ? (
                  <View
                    style={{
                      marginTop: 12,
                      borderTopWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      paddingTop: 12,
                    }}
                  >
                    {/* Quick buttons */}
                    <View
                      style={{
                        flexDirection: "row-reverse",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <Pressable
                        onPress={() => handleQuickSet(item.id, 0)}
                        style={quickBtnStyle("#F87171")}
                      >
                        <Text
                          style={{
                            color: "#F87171",
                            fontSize: 15,
                            fontWeight: "800",
                          }}
                        >
                          0
                        </Text>
                      </Pressable>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => handleQuickSet(item.id, n)}
                          style={quickBtnStyle("rgba(255,255,255,0.6)")}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontSize: 15,
                              fontWeight: "800",
                            }}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Manual input */}
                    <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                      <TextInput
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        placeholder="الكمية"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        autoFocus
                        onSubmitEditing={handleConfirmAndNext}
                        returnKeyType="done"
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 12,
                          textAlign: "center",
                          backgroundColor: "rgba(0,0,0,0.3)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#fff",
                          fontSize: 20,
                          fontWeight: "800",
                        }}
                      />
                      <Pressable
                        onPress={handleConfirmAndNext}
                        disabled={quantity === ""}
                        style={{
                          width: 60,
                          height: 46,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            quantity === ""
                              ? "rgba(255,255,255,0.08)"
                              : "#6EE7B7",
                        }}
                      >
                        <Check
                          size={22}
                          color={
                            quantity === ""
                              ? "rgba(255,255,255,0.3)"
                              : "#0B0B10"
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      {/* Submit bar */}
      {error ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ color: "#FCA5A5", textAlign: "center", fontSize: 13 }}>
            {error}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: "rgba(11,11,16,0.95)",
          borderTopWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || completedCount === 0}
          style={{
            height: 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              submitting || completedCount === 0
                ? "rgba(255,255,255,0.08)"
                : "#6EE7B7",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#0B0B10" />
          ) : (
            <Text style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}>
              اعتماد الجرد ({completedCount}/{totalCount})
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const quickBtnStyle = (color) => ({
  flex: 1,
  height: 40,
  borderRadius: 10,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
});
