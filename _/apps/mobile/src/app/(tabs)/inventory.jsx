import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import {
  Package,
  HeartPulse,
  DollarSign,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  TrendingDown,
  Search,
  ChevronLeft,
  Plus,
  Truck,
  X,
  Check,
  BarChart3,
  LogOut,
} from "lucide-react-native";
import { router } from "expo-router";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Sub-screens: "dashboard", "operations", "low-stock", "summary", "add-receipt", "transfer"
export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useWorkspaceAuth();
  const [screen, setScreen] = useState("dashboard");

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut]);

  const screenTitle = {
    dashboard: "المخزون",
    operations: "عمليات المخزون",
    "low-stock": "أصناف منخفضة",
    summary: "ملخص الأصناف",
    "add-receipt": "إضافة وارد",
    transfer: "تحويل بين الفروع",
  };

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
          {screen !== "dashboard" ? (
            <Pressable onPress={() => setScreen("dashboard")}>
              <ChevronLeft
                size={22}
                color="rgba(255,255,255,0.6)"
                style={{ transform: [{ scaleX: -1 }] }}
              />
            </Pressable>
          ) : null}
          <Package size={22} color="#7DD3FC" />
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
            {screenTitle[screen]}
          </Text>
        </View>
        {screen === "dashboard" ? (
          <Pressable onPress={handleLogout} style={{ padding: 6 }}>
            <LogOut size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>
        ) : null}
      </View>

      {screen === "dashboard" ? (
        <DashboardScreen token={token} onNavigate={setScreen} insets={insets} />
      ) : screen === "operations" ? (
        <OperationsScreen
          token={token}
          insets={insets}
          onNavigate={setScreen}
        />
      ) : screen === "low-stock" ? (
        <LowStockScreen token={token} insets={insets} />
      ) : screen === "summary" ? (
        <SummaryScreen token={token} insets={insets} />
      ) : screen === "add-receipt" ? (
        <AddReceiptScreen
          token={token}
          insets={insets}
          onDone={() => setScreen("operations")}
        />
      ) : screen === "transfer" ? (
        <TransferScreen
          token={token}
          user={user}
          insets={insets}
          onDone={() => setScreen("operations")}
        />
      ) : null}
    </View>
  );
}

/* ─── DASHBOARD ─── */
function DashboardScreen({ token, onNavigate, insets }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`${BASE}/api/dashboard/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const healthScore = data?.healthScore ?? 0;
  const totalCost = data?.inventoryCost?.totalCost ?? 0;
  const predictions = data?.depletionPredictions || [];
  const alerts = data?.alerts || [];

  const healthColor =
    healthScore >= 80 ? "#6EE7B7" : healthScore >= 50 ? "#FCD34D" : "#F87171";
  const healthLabel =
    healthScore >= 80 ? "ممتاز" : healthScore >= 50 ? "مقبول" : "ضعيف";

  const menuItems = [
    {
      key: "operations",
      icon: BarChart3,
      label: "عمليات المخزون",
      color: "#7DD3FC",
      subtitle: "وارد + تحويل",
    },
    {
      key: "low-stock",
      icon: TrendingDown,
      label: "أصناف منخفضة",
      color: "#F87171",
      subtitle: "تحتاج تعبئة",
    },
    {
      key: "summary",
      icon: Package,
      label: "ملخص الأصناف",
      color: "#C4B5FD",
      subtitle: "كل الفروع",
    },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 80,
        paddingHorizontal: 16,
        paddingTop: 14,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchData(true)}
          tintColor="#fff"
        />
      }
    >
      {/* Health + Cost + Predictions row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 14 }}
      >
        <View style={{ flexDirection: "row-reverse", gap: 10 }}>
          {/* Health Score */}
          <View style={cardStyle}>
            <HeartPulse size={20} color={healthColor} />
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>
              {healthScore}%
            </Text>
            <Text
              style={{ color: healthColor, fontSize: 11, fontWeight: "700" }}
            >
              {healthLabel}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              صحة المخزون
            </Text>
          </View>
          {/* Inventory Cost */}
          <View style={cardStyle}>
            <DollarSign size={20} color="#6EE7B7" />
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
              {formatCompact(totalCost)}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              قيمة المخزون (ر.س)
            </Text>
          </View>
          {/* Predictions */}
          <View style={cardStyle}>
            <Clock size={20} color="#FCD34D" />
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>
              {predictions.length}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              توقع نفاذ
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Alerts */}
      {alerts.length > 0 ? (
        <View style={sectionStyle}>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <AlertTriangle size={18} color="#FCD34D" />
            <Text
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: "800",
                textAlign: "right",
              }}
            >
              تنبيهات
            </Text>
          </View>
          {alerts.map((a, i) => (
            <View
              key={i}
              style={{
                paddingVertical: 8,
                borderBottomWidth: i < alerts.length - 1 ? 1 : 0,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Text
                style={{
                  color:
                    a.type === "danger"
                      ? "#F87171"
                      : a.type === "warning"
                        ? "#FCD34D"
                        : "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  textAlign: "right",
                }}
              >
                {a.message}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Depletion Predictions */}
      {predictions.length > 0 ? (
        <View style={sectionStyle}>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Clock size={18} color="#FCD34D" />
            <Text
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: "800",
                textAlign: "right",
              }}
            >
              توقعات النفاذ
            </Text>
          </View>
          {predictions.slice(0, 8).map((p, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth:
                  i < Math.min(predictions.length, 8) - 1 ? 1 : 0,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: "600",
                    textAlign: "right",
                  }}
                >
                  {p.item_name}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 11,
                    textAlign: "right",
                  }}
                >
                  {p.branch_name}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor:
                    p.days_to_depletion <= 3
                      ? "rgba(248,113,113,0.15)"
                      : "rgba(252,211,77,0.15)",
                }}
              >
                <Text
                  style={{
                    color: p.days_to_depletion <= 3 ? "#F87171" : "#FCD34D",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {p.days_to_depletion} يوم
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Menu */}
      <View style={{ gap: 10 }}>
        {menuItems.map((m) => {
          const IconComp = m.icon;
          return (
            <Pressable
              key={m.key}
              onPress={() => onNavigate(m.key)}
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 14,
                padding: 16,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: `${m.color}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconComp size={22} color={m.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: "700",
                    textAlign: "right",
                  }}
                >
                  {m.label}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    textAlign: "right",
                  }}
                >
                  {m.subtitle}
                </Text>
              </View>
              <ChevronLeft
                size={18}
                color="rgba(255,255,255,0.3)"
                style={{ transform: [{ scaleX: -1 }] }}
              />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ─── OPERATIONS ─── */
function OperationsScreen({ token, insets, onNavigate }) {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOps = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`${BASE}/api/inventory-operations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setOps(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchOps(false);
  }, [fetchOps]);

  const typeColors = {
    Daily: "#7DD3FC",
    Weekly: "#C4B5FD",
    Transfer: "#FCD34D",
    Receipt: "#6EE7B7",
    Opening: "#F9A8D4",
  };
  const typeLabels = {
    Daily: "يومي",
    Weekly: "أسبوعي",
    Transfer: "تحويل",
    Receipt: "وارد",
    Opening: "افتتاحي",
  };

  const actionButtons = [
    { key: "add-receipt", icon: Plus, label: "إضافة وارد", color: "#6EE7B7" },
    { key: "transfer", icon: ArrowRightLeft, label: "تحويل", color: "#FCD34D" },
  ];

  const renderOp = useCallback(({ item }) => {
    const typeColor = typeColors[item.inventory_type] || "#fff";
    const typeLabel = typeLabels[item.inventory_type] || item.inventory_type;
    const dateStr = formatDateAr(item.operation_date || item.created_at);

    return (
      <View
        style={{
          padding: 14,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View
          style={{
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: `${typeColor}22`,
              }}
            >
              <Text
                style={{ color: typeColor, fontSize: 11, fontWeight: "700" }}
              >
                {typeLabel}
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
              {item.inventory_number}
            </Text>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {dateStr}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: "600",
              textAlign: "right",
            }}
          >
            {item.branch_name || "—"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {item.employee_name || ""}
          </Text>
        </View>
        {item.inventory_type === "Receipt" && item.receipt_item_name ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              textAlign: "right",
              marginTop: 4,
            }}
          >
            {item.receipt_item_name} — {item.receipt_quantity}
          </Text>
        ) : null}
        {item.inventory_type === "Transfer" ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 12,
              textAlign: "right",
              marginTop: 4,
            }}
          >
            {item.transfer_direction === "out" ? "خارج ←" : "داخل →"}{" "}
            {item.transfer_branch_name || ""}
          </Text>
        ) : null}
      </View>
    );
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Action buttons */}
      <View
        style={{
          flexDirection: "row-reverse",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        {actionButtons.map((btn) => {
          const BtnIcon = btn.icon;
          return (
            <Pressable
              key={btn.key}
              onPress={() => onNavigate(btn.key)}
              style={{
                flex: 1,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: `${btn.color}15`,
                borderWidth: 1,
                borderColor: `${btn.color}30`,
              }}
            >
              <BtnIcon size={18} color={btn.color} />
              <Text
                style={{ color: btn.color, fontSize: 13, fontWeight: "700" }}
              >
                {btn.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={ops.slice(0, 50)}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOp}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: insets.bottom + 80,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOps(true)}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Package size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 12 }}>
                لا توجد عمليات
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ─── LOW STOCK ─── */
function LowStockScreen({ token, insets }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/items/low-stock`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 80,
        paddingTop: 8,
      }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View
          style={{
            padding: 14,
            marginHorizontal: 16,
            marginBottom: 8,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(248,113,113,0.15)",
          }}
        >
          <View
            style={{
              flexDirection: "row-reverse",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "700",
                textAlign: "right",
                flex: 1,
              }}
            >
              {item.name}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                backgroundColor: "rgba(248,113,113,0.15)",
              }}
            >
              <Text
                style={{ color: "#F87171", fontSize: 13, fontWeight: "700" }}
              >
                {Number(item.current_quantity)}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row-reverse",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                textAlign: "right",
              }}
            >
              {item.branch_name}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              الحد: {item.min_stock_threshold}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Check size={40} color="#6EE7B7" />
          <Text style={{ color: "#6EE7B7", marginTop: 12, fontWeight: "700" }}>
            كل الأصناف بخير 🎉
          </Text>
        </View>
      }
    />
  );
}

/* ─── SUMMARY ─── */
function SummaryScreen({ token, insets }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/items/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const grouped = useMemo(() => {
    const map = {};
    for (const row of items) {
      if (!map[row.id])
        map[row.id] = { name: row.name, id: row.id, branches: [] };
      map[row.id].branches.push(row);
    }
    let arr = Object.values(map);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((g) => g.name.toLowerCase().includes(q));
    }
    return arr;
  }, [items, search]);

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
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
            value={search}
            onChangeText={setSearch}
            placeholder="بحث…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{ flex: 1, color: "#fff", fontSize: 14, textAlign: "right" }}
          />
        </View>
      </View>
      <FlatList
        data={grouped}
        keyExtractor={(g) => String(g.id)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: g }) => (
          <View
            style={{
              padding: 14,
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
                textAlign: "right",
                marginBottom: 8,
              }}
            >
              {g.name}
            </Text>
            {g.branches.map((b, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row-reverse",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                  {b.branch_name}
                </Text>
                <Text
                  style={{
                    color:
                      Number(b.current_quantity) < Number(b.min_stock_threshold)
                        ? "#F87171"
                        : "#6EE7B7",
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {Number(b.current_quantity)}
                </Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ color: "rgba(255,255,255,0.5)" }}>
              لا توجد بيانات
            </Text>
          </View>
        }
      />
    </View>
  );
}

/* ─── ADD RECEIPT ─── */
function AddReceiptScreen({ token, insets, onDone }) {
  const [branches, setBranches] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [branchId, setBranchId] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, iRes] = await Promise.all([
          fetch(`${BASE}/api/branches`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE}/api/items`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (bRes.ok) setBranches(await bRes.json());
        if (iRes.ok) {
          const items = await iRes.json();
          setAllItems(
            items.filter(
              (it) => it.show_in_inventory !== false && it.is_active,
            ),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const addItem = (itemId) => {
    if (receiptItems.find((r) => r.itemId === itemId)) return;
    setReceiptItems((prev) => [...prev, { itemId, quantity: "" }]);
  };

  const updateQty = (itemId, qty) => {
    setReceiptItems((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, quantity: qty } : r)),
    );
  };

  const removeItem = (itemId) => {
    setReceiptItems((prev) => prev.filter((r) => r.itemId !== itemId));
  };

  const handleSubmit = async () => {
    if (!branchId || receiptItems.length === 0) return;
    const cleanItems = receiptItems
      .filter((r) => Number(r.quantity) > 0)
      .map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity) }));
    if (cleanItems.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/purchase-receipts`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          branchId,
          receivedAt: new Date().toISOString(),
          items: cleanItems,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "فشل");
      }
      setSuccess(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );

  if (success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Check size={48} color="#6EE7B7" />
        <Text
          style={{
            color: "#6EE7B7",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          تم إضافة الوارد ✅
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: insets.bottom + 100,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Branch picker */}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
          marginBottom: 8,
        }}
      >
        الفرع
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBranchId(b.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor:
                  branchId === b.id
                    ? "rgba(125,211,252,0.15)"
                    : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor:
                  branchId === b.id
                    ? "rgba(125,211,252,0.3)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              <Text
                style={{
                  color:
                    branchId === b.id ? "#7DD3FC" : "rgba(255,255,255,0.6)",
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

      {/* Items selector */}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
          marginBottom: 8,
        }}
      >
        الأصناف
      </Text>
      {receiptItems.map((ri) => {
        const item = allItems.find((it) => it.id === ri.itemId);
        return (
          <View
            key={ri.itemId}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "right",
                }}
              >
                {item?.name || "—"}
              </Text>
            </View>
            <TextInput
              value={ri.quantity}
              onChangeText={(v) => updateQty(ri.itemId, v)}
              keyboardType="numeric"
              placeholder="الكمية"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                width: 80,
                height: 40,
                borderRadius: 10,
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
              }}
            />
            <Pressable
              onPress={() => removeItem(ri.itemId)}
              style={{ padding: 6 }}
            >
              <X size={18} color="#F87171" />
            </Pressable>
          </View>
        );
      })}

      {/* Add item button */}
      <ItemPickerButton
        items={allItems}
        selectedIds={receiptItems.map((r) => r.itemId)}
        onSelect={addItem}
      />

      {/* Submit */}
      <Pressable
        onPress={handleSubmit}
        disabled={submitting || !branchId || receiptItems.length === 0}
        style={{
          marginTop: 20,
          height: 50,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            submitting || !branchId || receiptItems.length === 0
              ? "rgba(255,255,255,0.08)"
              : "#6EE7B7",
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B10" />
        ) : (
          <Text style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}>
            حفظ الوارد
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/* ─── TRANSFER ─── */
function TransferScreen({ token, user, insets, onDone }) {
  const [branches, setBranches] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [fromBranch, setFromBranch] = useState(null);
  const [toBranch, setToBranch] = useState(null);
  const [transferItems, setTransferItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, iRes] = await Promise.all([
          fetch(`${BASE}/api/branches`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE}/api/items`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (bRes.ok) setBranches(await bRes.json());
        if (iRes.ok) {
          const items = await iRes.json();
          setAllItems(
            items.filter(
              (it) => it.show_in_inventory !== false && it.is_active,
            ),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const addItem = (itemId) => {
    if (transferItems.find((r) => r.itemId === itemId)) return;
    setTransferItems((prev) => [...prev, { itemId, quantity: "" }]);
  };

  const updateQty = (itemId, qty) => {
    setTransferItems((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, quantity: qty } : r)),
    );
  };

  const removeItem = (itemId) => {
    setTransferItems((prev) => prev.filter((r) => r.itemId !== itemId));
  };

  const handleSubmit = async () => {
    if (
      !fromBranch ||
      !toBranch ||
      fromBranch === toBranch ||
      transferItems.length === 0
    )
      return;
    const cleanItems = transferItems
      .filter((r) => Number(r.quantity) > 0)
      .map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity) }));
    if (cleanItems.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/inventory-transfers`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          fromBranchId: fromBranch,
          toBranchId: toBranch,
          items: cleanItems,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "فشل");
      }
      setSuccess(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );

  if (success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Check size={48} color="#FCD34D" />
        <Text
          style={{
            color: "#FCD34D",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          تم التحويل ✅
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: insets.bottom + 100,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* From branch */}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
          marginBottom: 8,
        }}
      >
        من فرع
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setFromBranch(b.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor:
                  fromBranch === b.id
                    ? "rgba(248,113,113,0.15)"
                    : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor:
                  fromBranch === b.id
                    ? "rgba(248,113,113,0.3)"
                    : "rgba(255,255,255,0.08)",
              }}
            >
              <Text
                style={{
                  color:
                    fromBranch === b.id ? "#F87171" : "rgba(255,255,255,0.6)",
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

      {/* To branch */}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
          marginBottom: 8,
        }}
      >
        إلى فرع
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {branches
            .filter((b) => b.id !== fromBranch)
            .map((b) => (
              <Pressable
                key={b.id}
                onPress={() => setToBranch(b.id)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor:
                    toBranch === b.id
                      ? "rgba(110,231,183,0.15)"
                      : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor:
                    toBranch === b.id
                      ? "rgba(110,231,183,0.3)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    color:
                      toBranch === b.id ? "#6EE7B7" : "rgba(255,255,255,0.6)",
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

      {/* Items */}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: "600",
          textAlign: "right",
          marginBottom: 8,
        }}
      >
        الأصناف
      </Text>
      {transferItems.map((ri) => {
        const item = allItems.find((it) => it.id === ri.itemId);
        return (
          <View
            key={ri.itemId}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "right",
                }}
              >
                {item?.name || "—"}
              </Text>
            </View>
            <TextInput
              value={ri.quantity}
              onChangeText={(v) => updateQty(ri.itemId, v)}
              keyboardType="numeric"
              placeholder="الكمية"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{
                width: 80,
                height: 40,
                borderRadius: 10,
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
              }}
            />
            <Pressable
              onPress={() => removeItem(ri.itemId)}
              style={{ padding: 6 }}
            >
              <X size={18} color="#F87171" />
            </Pressable>
          </View>
        );
      })}

      <ItemPickerButton
        items={allItems}
        selectedIds={transferItems.map((r) => r.itemId)}
        onSelect={addItem}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={
          submitting ||
          !fromBranch ||
          !toBranch ||
          fromBranch === toBranch ||
          transferItems.length === 0
        }
        style={{
          marginTop: 20,
          height: 50,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: submitting ? "rgba(255,255,255,0.08)" : "#FCD34D",
          opacity:
            !fromBranch ||
            !toBranch ||
            fromBranch === toBranch ||
            transferItems.length === 0
              ? 0.4
              : 1,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B10" />
        ) : (
          <Text style={{ color: "#0B0B10", fontWeight: "900", fontSize: 16 }}>
            تنفيذ التحويل
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/* ─── ITEM PICKER BUTTON ─── */
function ItemPickerButton({ items, selectedIds, onSelect }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        !selectedIds.includes(it.id) &&
        (it.name.toLowerCase().includes(q) ||
          (it.name_en || "").toLowerCase().includes(q)),
    );
  }, [items, selectedIds, search]);

  return (
    <>
      <Pressable
        onPress={() => {
          setVisible(true);
          setSearch("");
        }}
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "rgba(255,255,255,0.15)",
          marginTop: 4,
        }}
      >
        <Plus size={18} color="rgba(255,255,255,0.5)" />
        <Text
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          إضافة صنف
        </Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            paddingTop: 60,
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
            {/* Header */}
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
                اختر صنف
              </Text>
              <Pressable onPress={() => setVisible(false)}>
                <X size={22} color="rgba(255,255,255,0.5)" />
              </Pressable>
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
                  borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Search size={16} color="rgba(255,255,255,0.35)" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="بحث…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 14,
                    textAlign: "right",
                  }}
                  autoFocus
                />
              </View>
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(it) => String(it.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    setVisible(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    {item.name}
                  </Text>
                  {item.unit ? (
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        textAlign: "right",
                      }}
                    >
                      {item.unit}
                    </Text>
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ─── HELPERS ─── */
function formatCompact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatDateAr(d) {
  if (!d) return "";
  try {
    const s = String(d).split("T")[0];
    const parts = s.split("-");
    return `${parts[2]}/${parts[1]}`;
  } catch {
    return "";
  }
}

const cardStyle = {
  width: 120,
  padding: 14,
  borderRadius: 18,
  backgroundColor: "rgba(255,255,255,0.04)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  alignItems: "center",
  gap: 4,
};

const sectionStyle = {
  marginBottom: 14,
  padding: 16,
  borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.03)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.06)",
};
