import { Tabs } from "expo-router";
import { Home, ClipboardList, Package } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0B0B10",
          borderTopWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarLabelStyle: {
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "المهام",
          tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "المخزون",
          tabBarIcon: ({ color }) => <Package size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
