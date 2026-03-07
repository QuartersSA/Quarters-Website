import "react-native-reanimated";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useWorkspaceAuth } from "@/utils/workspaceAuth";
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const { initiate, isReady } = useWorkspaceAuth();

  useEffect(() => {
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
          <Stack.Screen name="consent" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="employee-inventory" />
          <Stack.Screen name="shift-close" />
          <Stack.Screen
            name="task-detail"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="create-task"
            options={{ presentation: "modal" }}
          />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
