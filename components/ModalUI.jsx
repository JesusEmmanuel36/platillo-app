import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";

// Shared visual hierarchy for the app's sheets and dialogs.
export const modalStyles = StyleSheet.create({
  overlay: { backgroundColor: "rgba(0,0,0,0.45)" },
  surface: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e5e5", alignSelf: "center", marginTop: 10, marginBottom: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0", gap: 12 },
  title: { flex: 1, flexShrink: 1, fontFamily: "Onest_700Bold", fontWeight: "normal", fontSize: 17, color: "#1a1a1a" },
  sectionTitle: { fontFamily: "Onest_700Bold", fontWeight: "normal", fontSize: 13, color: "#1a1a1a", textTransform: "none", letterSpacing: 0 },
  label: { fontFamily: "Onest_600SemiBold", fontWeight: "normal", fontSize: 13, color: "#1a1a1a" },
  body: { fontFamily: "Onest_500Medium", fontWeight: "normal", fontSize: 14, color: "#636366" },
  input: { minHeight: 48, backgroundColor: "#f6f6f6", borderRadius: 12, borderWidth: 1, borderColor: "#ececec", paddingHorizontal: 12, fontFamily: "Onest_500Medium", fontSize: 14, color: "#1a1a1a" },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#e83906" },
  secondary: { backgroundColor: "#f1f1f1" },
  buttonText: { fontFamily: "Onest_700Bold", fontWeight: "normal", fontSize: 15, color: "#fff" },
  secondaryText: { fontFamily: "Onest_600SemiBold", fontWeight: "normal", fontSize: 15, color: "#3a3a3c" },
  footer: { padding: 16, paddingHorizontal: 16, paddingVertical: 16, gap: 10, borderTopWidth: 0.5, borderTopColor: "#f0f0f0" },
  close: { width: 40, height: 40, flexShrink: 0, borderRadius: 20, backgroundColor: "#f3f3f3", alignItems: "center", justifyContent: "center" },
});

export function ModalCloseButton({ onPress, disabled = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Cerrar modal"
      disabled={disabled}
      onPress={onPress}
      style={modalStyles.close}
      hitSlop={4}
      activeOpacity={0.7}
    >
      <Ionicons name="close" size={20} color="#636366" />
    </TouchableOpacity>
  );
}
