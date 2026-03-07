import { Redirect } from "expo-router";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isReady, isAuthenticated, user } = useWorkspaceAuth();
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const consent = await SecureStore.getItemAsync("user_consent_accepted");
        setHasConsent(consent === "true");
      } catch (e) {
        console.error(e);
        setHasConsent(false);
      } finally {
        setConsentChecked(true);
      }
    })();
  }, []);

  if (!isReady || !consentChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0B0B10",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!hasConsent) {
    return <Redirect href="/consent" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const loginMode = user?.loginMode;

  if (loginMode === "inventory") {
    return <Redirect href="/employee-inventory" />;
  }

  if (loginMode === "shift") {
    return <Redirect href="/shift-close" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
