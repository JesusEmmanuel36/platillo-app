import { ModalCloseButton, modalStyles } from "../../components/ModalUI";
import { Ionicons } from "@expo/vector-icons";
import { Href, Tabs, usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#e83906";
const INACTIVE = "#8d8d92";

type MoreItem = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MORE_ITEMS: MoreItem[] = [
  { label: "Analíticas", route: "/analiticas", icon: "stats-chart" },
  { label: "Personalizaciones", route: "/personalizaciones", icon: "options" },
  { label: "Código QR", route: "/codigo-qr", icon: "qr-code" },
  { label: "Configuración", route: "/configuracion", icon: "settings" },
];

function MoreMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function openRoute(route: string) {
    onClose();
    requestAnimationFrame(() => router.push(route as Href));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.moreCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.moreHandle} />
          <View style={modalStyles.header}>
            <Text style={styles.moreTitle}>Más secciones</Text>
            <ModalCloseButton onPress={onClose} />
          </View>
          {MORE_ITEMS.map((item) => {
            const active = pathname === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.moreRow, active && styles.moreRowActive]}
                activeOpacity={0.75}
                onPress={() => openRoute(item.route)}
              >
                <View style={[styles.moreIcon, active && styles.moreIconActive]}>
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={active ? ACCENT : "#202124"}
                  />
                </View>
                <Text style={[styles.moreLabel, active && styles.moreLabelActive]}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={19} color="#aaa" />
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [moreVisible, setMoreVisible] = useState(false);
  const moreActive = MORE_ITEMS.some((item) => item.route === pathname);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACCENT,
          tabBarInactiveTintColor: INACTIVE,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            paddingHorizontal: 10,
            paddingTop: 7,
            paddingBottom: Platform.OS === "android" ? 8 + insets.bottom : 5,
            height: 64 + insets.bottom,
            borderTopColor: "#ededed",
            backgroundColor: "#fff",
          },
          tabBarIconStyle: { marginBottom: -2 },
          tabBarLabelStyle: {
            fontSize: 12,
            fontFamily: "Onest_600SemiBold",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Pedidos",
            tabBarIcon: ({ color }) => (
              <Ionicons name="receipt-outline" size={27} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="productos"
          options={{
            title: "Productos",
            tabBarIcon: ({ color }) => (
              <Ionicons name="fast-food-outline" size={26} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pos"
          options={{
            title: "Punto de venta",
            tabBarIcon: ({ color }) => (
              <Ionicons name="storefront-outline" size={26} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mas"
          options={{
            title: "Más",
            tabBarActiveTintColor: moreActive ? ACCENT : INACTIVE,
            tabBarIcon: () => (
              <Ionicons
                name="menu"
                size={28}
                color={moreActive ? ACCENT : INACTIVE}
              />
            ),
            tabBarButton: (props) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Más secciones"
                style={props.style}
                onPress={() => setMoreVisible(true)}
              >
                {props.children}
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen name="analiticas" options={{ href: null }} />
        <Tabs.Screen name="personalizaciones" options={{ href: null }} />
        <Tabs.Screen name="codigo-qr" options={{ href: null }} />
        <Tabs.Screen name="configuracion" options={{ href: null }} />
      </Tabs>
      <MoreMenu visible={moreVisible} onClose={() => setMoreVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    ...modalStyles.overlay,
  },
  moreCard: {
    marginHorizontal: 12,
    marginBottom: 76,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 14,
    borderRadius: 24,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  moreHandle: {
    ...modalStyles.handle,
  },
  moreTitle: {
    paddingHorizontal: 6,
    marginBottom: 8,
    ...modalStyles.title,
  },
  moreRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  moreRowActive: { backgroundColor: "#fff3ee" },
  moreIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#f4f4f4",
  },
  moreIconActive: { backgroundColor: "#ffe5db" },
  moreLabel: {
    flex: 1,
    fontFamily: "Onest_600SemiBold",
    fontSize: 15,
    color: "#252525",
  },
  moreLabelActive: { color: ACCENT },
});
