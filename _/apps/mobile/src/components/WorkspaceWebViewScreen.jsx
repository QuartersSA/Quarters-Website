import { useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import { LogOut, RefreshCw, X, Info } from "lucide-react-native";
import { router } from "expo-router";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import { StatusBar } from "expo-status-bar";

export default function WorkspaceWebViewScreen({ title, path }) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useWorkspaceAuth();
  const webViewRef = useRef(null);

  const baseURL = process.env.EXPO_PUBLIC_BASE_URL;

  const [isLoading, setIsLoading] = useState(true);
  const [showDataNotice, setShowDataNotice] = useState(true);

  const fullUrl = useMemo(() => {
    if (!baseURL) return null;
    return `${baseURL}${path}`;
  }, [baseURL, path]);

  const injectedJS = useMemo(() => {
    const userStr = user ? JSON.stringify(user) : null;
    const userStrLiteral = JSON.stringify(userStr);

    return `
      try {
        if (${user ? "true" : "false"}) {
          window.sessionStorage.setItem('workspaceUser', ${userStrLiteral});
        } else {
          window.sessionStorage.removeItem('workspaceUser');
        }
      } catch (e) {}
      true;
    `;
  }, [user]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace("/login");
  }, [signOut]);

  const handleReload = useCallback(() => {
    try {
      webViewRef.current?.reload();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleExternalLink = useCallback(async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const topBarHeight = 52;

  if (!fullUrl) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
      >
        <StatusBar style="light" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            خطأ في الإعدادات
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 8 }}>
            EXPO_PUBLIC_BASE_URL غير موجود.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: "#0B0B10", paddingTop: insets.top }}
    >
      <StatusBar style="light" />

      {showDataNotice ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "rgba(125,211,252,0.08)",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(125,211,252,0.15)",
          }}
        >
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Info size={16} color="#7DD3FC" />
            <Text
              style={{
                flex: 1,
                color: "#7DD3FC",
                fontSize: 11,
                textAlign: "right",
                lineHeight: 18,
              }}
            >
              يتم مشاركة معرف الموظف ورمز تسجيل الدخول بشكل آمن مع واجهة الويب
              الداخلية لتمكين ميزات محددة. واجهة الويب الداخلية لا تستخدم أي
              تتبع أو إعلانات من جهات خارجية.
            </Text>
            <Pressable
              onPress={() => setShowDataNotice(false)}
              style={{ padding: 4 }}
            >
              <X size={14} color="#7DD3FC" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        style={{
          height: topBarHeight,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.08)",
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>

        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleReload}
            style={{
              height: 36,
              width: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <RefreshCw size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={{
              height: 36,
              width: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(239,68,68,0.18)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.28)",
            }}
          >
            <LogOut size={18} color="#FCA5A5" />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {Platform.OS !== "web" ? (
          <WebView
            ref={webViewRef}
            source={{ uri: fullUrl }}
            sharedCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={injectedJS}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onShouldStartLoadWithRequest={(req) => {
              const url = req.url || "";
              const isInternal = baseURL ? url.startsWith(baseURL) : true;
              if (!isInternal) {
                handleExternalLink(url);
                return false;
              }
              return true;
            }}
            style={{ flex: 1, backgroundColor: "#0B0B10" }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#0B0B10", padding: 16 }}>
            <Text style={{ color: "#fff" }}>هذا العرض مخصص لتطبيق الجوال.</Text>
          </View>
        )}

        {isLoading ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(11,11,16,0.35)",
            }}
          >
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>
    </View>
  );
}
