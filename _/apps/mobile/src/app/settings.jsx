import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import {
  X,
  Shield,
  Trash2,
  Mail,
  LogOut,
  FileText,
  AlertTriangle,
  Globe,
  HelpCircle,
} from "lucide-react-native";

const BASE = process.env.EXPO_PUBLIC_BASE_URL || "";
const SUPPORT_EMAIL = "Zalsaiari@quarters.sa";
const SUPPORT_URL = "https://www.quarters.sa/support";
const PRIVACY_URL = "https://www.quarters.sa/privacy-policy";
const WEBSITE_URL = "https://quarters.sa";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, employeeId, signOut } = useWorkspaceAuth();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      "حذف الحساب",
      "هل أنت متأكد من حذف حسابك؟ سيتم حذف جميع بياناتك بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const res = await fetch(`${BASE}/api/employees/${employeeId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId }),
              });

              if (!res.ok) {
                throw new Error("فشل حذف الحساب");
              }

              await signOut();
              router.replace("/login");
              Alert.alert("تم الحذف", "تم حذف حسابك بنجاح");
            } catch (e) {
              console.error(e);
              Alert.alert("خطأ", e.message || "فشل حذف الحساب");
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenSupport = async () => {
    try {
      await Linking.openURL(SUPPORT_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenWebsite = async () => {
    try {
      await Linking.openURL(WEBSITE_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPrivacyWeb = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleContactSupport = async () => {
    try {
      const url = `mailto:${SUPPORT_EMAIL}?subject=استفسار من التطبيق&body=مرحباً،%0A%0Aلدي استفسار بخصوص...`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "البريد الإلكتروني",
          `يرجى التواصل معنا على:\n${SUPPORT_EMAIL}`,
          [
            {
              text: "نسخ",
              onPress: () => {
                Alert.alert("تم النسخ", "تم نسخ البريد الإلكتروني");
              },
            },
            { text: "إغلاق" },
          ],
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("خطأ", "فشل فتح تطبيق البريد");
    }
  };

  const handleLogout = async () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B10" }}>
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
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Shield size={20} color="#6EE7B7" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
              الإعدادات
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
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
              marginBottom: 8,
            }}
          >
            معلومات الحساب
          </Text>
          <View style={{ gap: 8 }}>
            <InfoRow label="الاسم" value={user?.name || "—"} />
            <InfoRow label="اسم المستخدم" value={user?.username || "—"} />
            <InfoRow label="الدور" value={user?.role || "—"} />
          </View>
        </View>

        <View style={{ gap: 12, marginBottom: 20 }}>
          <Pressable
            onPress={() => router.push("/privacy-policy")}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <FileText size={20} color="#7DD3FC" />
            <Text
              style={{
                flex: 1,
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
                textAlign: "right",
              }}
            >
              سياسة الخصوصية
            </Text>
          </Pressable>

          <Pressable
            onPress={handleOpenSupport}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <HelpCircle size={20} color="#6EE7B7" />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "700",
                  textAlign: "right",
                }}
              >
                الدعم والمساعدة
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                quarters.sa/support
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleOpenWebsite}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Globe size={20} color="#FCD34D" />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "700",
                  textAlign: "right",
                }}
              >
                الموقع الإلكتروني
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                quarters.sa
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleContactSupport}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Mail size={20} color="#A78BFA" />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "700",
                  textAlign: "right",
                }}
              >
                تواصل معنا
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {SUPPORT_EMAIL}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <LogOut size={20} color="#FCD34D" />
            <Text
              style={{
                flex: 1,
                color: "#fff",
                fontSize: 15,
                fontWeight: "700",
                textAlign: "right",
              }}
            >
              تسجيل الخروج
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(239,68,68,0.08)",
            borderWidth: 1,
            borderColor: "rgba(239,68,68,0.15)",
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
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
              منطقة الخطر
            </Text>
          </View>
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              textAlign: "right",
              lineHeight: 22,
              marginBottom: 14,
            }}
          >
            حذف الحساب سيؤدي إلى حذف جميع بياناتك بشكل نهائي من الخادم. هذا
            الإجراء لا يمكن التراجع عنه.
          </Text>
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            style={{
              height: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row-reverse",
              gap: 10,
              backgroundColor: deletingAccount
                ? "rgba(239,68,68,0.15)"
                : "#EF4444",
            }}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Trash2 size={18} color="#fff" />
                <Text
                  style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}
                >
                  حذف الحساب نهائياً
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(125,211,252,0.08)",
            borderWidth: 1,
            borderColor: "rgba(125,211,252,0.15)",
          }}
        >
          <Text
            style={{
              color: "#7DD3FC",
              fontSize: 12,
              textAlign: "right",
              lineHeight: 20,
            }}
          >
            💡 إذا كنت تواجه أي مشاكل أو لديك أسئلة، يمكنك التواصل معنا عبر
            البريد الإلكتروني أعلاه.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
