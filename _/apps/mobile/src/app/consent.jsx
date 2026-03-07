import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Shield, Check, FileText } from "lucide-react-native";

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const mode = params.mode || "admin";

  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    try {
      await SecureStore.setItemAsync("user_consent_accepted", "true");
      await SecureStore.setItemAsync(
        "user_consent_date",
        new Date().toISOString(),
      );
      router.replace({ pathname: "/login", params: { mode } });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = () => {
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B10" }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: "rgba(110,231,183,0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Shield size={40} color="#6EE7B7" />
          </View>
          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            الخصوصية والموافقة
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 14,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            نحتاج موافقتك لاستخدام التطبيق
          </Text>
        </View>

        <View
          style={{
            padding: 18,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "800",
              textAlign: "right",
              marginBottom: 14,
            }}
          >
            البيانات التي نجمعها
          </Text>

          <DataItem
            icon="👤"
            text="معلومات الموظف (الاسم، اسم المستخدم، الدور)"
          />
          <DataItem icon="🏢" text="معلومات الفرع المرتبط بك" />
          <DataItem icon="🔐" text="رمز تسجيل الدخول للمصادقة" />
          <DataItem icon="📋" text="بيانات المهام والجرد التي تدخلها" />
        </View>

        <View
          style={{
            padding: 18,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: "800",
              textAlign: "right",
              marginBottom: 14,
            }}
          >
            كيف نستخدم بياناتك
          </Text>

          <UseItem text="تسجيل الدخول والمصادقة الآمنة" />
          <UseItem text="عرض وإدارة المهام والمخزون" />
          <UseItem text="مشاركة معرف الموظف ورمز تسجيل الدخول بشكل آمن مع واجهة الويب الداخلية لتمكين ميزات محددة" />
          <UseItem text="تحسين تجربة استخدام التطبيق" />
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(125,211,252,0.08)",
            borderWidth: 1,
            borderColor: "rgba(125,211,252,0.15)",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "#7DD3FC",
              fontSize: 13,
              textAlign: "right",
              lineHeight: 22,
            }}
          >
            💡 يتم تخزين بياناتك بشكل آمن على جهازك. يتم مشاركة البيانات فقط مع
            الأجزاء الداخلية من خدمة التطبيق (الخادم وواجهة الويب الداخلية) ولن
            يتم مشاركتها مع أي جهات خارجية. واجهة الويب الداخلية لا تستخدم أي
            تتبع أو إعلانات من جهات خارجية.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/privacy-policy")}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 24,
          }}
        >
          <FileText size={16} color="rgba(255,255,255,0.5)" />
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            اقرأ سياسة الخصوصية الكاملة
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setAccepted(!accepted)}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: 16,
            backgroundColor: accepted
              ? "rgba(110,231,183,0.08)"
              : "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: accepted
              ? "rgba(110,231,183,0.2)"
              : "rgba(255,255,255,0.08)",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: accepted ? "#6EE7B7" : "rgba(255,255,255,0.3)",
              backgroundColor: accepted
                ? "rgba(110,231,183,0.15)"
                : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {accepted ? <Check size={18} color="#6EE7B7" /> : null}
          </View>
          <Text
            style={{
              flex: 1,
              color: accepted ? "#6EE7B7" : "rgba(255,255,255,0.7)",
              fontSize: 14,
              fontWeight: "700",
              textAlign: "right",
              lineHeight: 22,
            }}
          >
            أوافق على جمع واستخدام بياناتي كما هو موضح في سياسة الخصوصية
          </Text>
        </Pressable>

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={handleAccept}
            disabled={!accepted || saving}
            style={{
              height: 52,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                !accepted || saving ? "rgba(255,255,255,0.08)" : "#6EE7B7",
            }}
          >
            {saving ? (
              <ActivityIndicator color="#0B0B10" />
            ) : (
              <Text
                style={{
                  color: !accepted ? "rgba(255,255,255,0.3)" : "#0B0B10",
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                متابعة
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDecline}
            style={{
              height: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              رفض
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function DataItem({ icon, text }) {
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text
        style={{
          flex: 1,
          color: "rgba(255,255,255,0.7)",
          fontSize: 14,
          textAlign: "right",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function UseItem({ text }) {
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: "#6EE7B7", fontSize: 16, marginTop: 2 }}>•</Text>
      <Text
        style={{
          flex: 1,
          color: "rgba(255,255,255,0.7)",
          fontSize: 14,
          textAlign: "right",
          lineHeight: 22,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
