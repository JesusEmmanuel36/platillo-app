import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebaseConfig";

const ACCENT = "#e83906";

export default function CodigoQRScreen() {
  const { restaurantId } = useAuth();
  const qrRef = useRef(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    getDoc(doc(db, "restaurants", restaurantId))
      .then((snapshot) => setRestaurant(snapshot.exists() ? snapshot.data() : null))
      .catch(() => Alert.alert("Error", "No se pudo cargar el restaurante."))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const slug = restaurant?.slug?.trim();
  const menuUrl = slug ? `https://pide.platillo.mx/${slug}` : "";

  async function copyLink() {
    if (!menuUrl) return;
    await Clipboard.setStringAsync(menuUrl);
    Alert.alert("Enlace copiado", "Ya puedes compartir el menú.");
  }

  async function sharePng() {
    if (!qrRef.current || !slug || saving) return;
    setSaving(true);
    qrRef.current.toDataURL(async (base64) => {
      try {
        const uri = `${FileSystem.cacheDirectory}menu-${slug}.png`;
        await FileSystem.writeAsStringAsync(uri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("No se puede abrir el menú para guardar.");
        }
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Guardar código QR",
          UTI: "public.png",
        });
      } catch (error) {
        Alert.alert("No se pudo guardar", error.message);
      } finally {
        setSaving(false);
      }
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Código QR</Text>
      </View>

      {!menuUrl ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={34} color={ACCENT} />
          <Text style={styles.emptyText}>
            El restaurante todavía no tiene un enlace de menú.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.description}>
            Compártelo en mesas, empaques o redes sociales.
          </Text>
          <View style={styles.card}>
            <View style={styles.qrBox}>
              <QRCode
                value={menuUrl}
                size={250}
                quietZone={12}
                backgroundColor="#fff"
                color="#111"
                logo={restaurant?.pfp ? { uri: restaurant.pfp } : undefined}
                logoSize={54}
                logoBackgroundColor="#fff"
                logoBorderRadius={14}
                logoMargin={5}
                getRef={(reference) => {
                  qrRef.current = reference;
                }}
              />
            </View>
            <Text style={styles.restaurantName}>{restaurant?.name || "Tu negocio"}</Text>
            <View style={styles.linkBox}>
              <Text style={styles.linkLabel}>Dirección del menú</Text>
              <Text style={styles.link} numberOfLines={1}>{menuUrl}</Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={sharePng} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.primaryText}>Compartir o guardar PNG</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={copyLink}>
              <Ionicons name="link-outline" size={20} color="#171717" />
              <Text style={styles.secondaryText}>Copiar enlace</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  title: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 28,
    color: "#1a1a1a",
  },
  description: {
    marginHorizontal: 18,
    marginTop: 16,
    fontFamily: "Onest_500Medium",
    fontSize: 14,
    color: "#8e8e93",
  },
  card: { marginHorizontal: 18, marginTop: 14, backgroundColor: "#fff", borderRadius: 24, padding: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 },
  qrBox: { minHeight: 286, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#fafafa" },
  restaurantName: { marginTop: 15, textAlign: "center", fontFamily: "Onest_700Bold", fontSize: 19, color: "#151515" },
  linkBox: { marginTop: 14, borderRadius: 15, backgroundColor: "#f4f4f4", padding: 13 },
  linkLabel: { fontFamily: "Onest_500Medium", fontSize: 12, color: "#8a8a8a" },
  link: { marginTop: 3, fontFamily: "Onest_600SemiBold", fontSize: 14, color: "#171717" },
  primaryButton: { height: 50, marginTop: 14, borderRadius: 15, backgroundColor: ACCENT, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: "Onest_700Bold", fontSize: 14, color: "#fff" },
  secondaryButton: { height: 48, marginTop: 9, borderRadius: 15, backgroundColor: "#f1f1f1", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: "Onest_600SemiBold", fontSize: 14, color: "#171717" },
  empty: { marginHorizontal: 18, marginTop: 30, alignItems: "center", padding: 30, borderRadius: 20, backgroundColor: "#fff" },
  emptyText: { marginTop: 10, textAlign: "center", fontFamily: "Onest_500Medium", color: "#666" },
});
