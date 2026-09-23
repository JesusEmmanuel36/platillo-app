import { addDoc, collection } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

const ACCENT = "#e83906";
const ACCENT_LIGHT = "#fdecea";
const METHODS = ["efectivo", "tarjeta", "transferencia"];
const LABELS = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export default function ManualSaleModal({ visible, onClose, restaurantId }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    const total = Number(amount);
    if (!Number.isFinite(total) || total <= 0) {
      Alert.alert("Monto inválido", "Ingresa un monto mayor a cero.");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "manual_sales"), {
        restaurantId,
        total,
        metodo: method,
        nota: note.trim(),
        creadoEn: new Date(),
      });
      setAmount("");
      setNote("");
      setMethod("efectivo");
      onClose();
      Alert.alert("Venta registrada", "La venta manual se agregó a Analíticas.");
    } catch {
      Alert.alert("No se pudo registrar", "Revisa la conexión e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Registrar venta manual</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Método de pago</Text>
            <View style={styles.methods}>
              {METHODS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.method, method === item && styles.methodActive]}
                  onPress={() => setMethod(item)}
                >
                  <Text style={[styles.methodText, method === item && styles.methodTextActive]}>
                    {LABELS[item]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nota (opcional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Ej. Venta en mostrador"
              placeholderTextColor="#aaa"
            />

            <TouchableOpacity
              style={[styles.save, loading && { opacity: 0.6 }]}
              onPress={save}
              disabled={loading}
            >
              <Text style={styles.saveText}>{loading ? "Guardando..." : "Registrar venta"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e5e5", alignSelf: "center", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  title: { fontFamily: "Onest_700Bold", fontSize: 17, color: "#111" },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f3f3f3", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#636366", fontSize: 13 },
  content: { padding: 20, paddingBottom: 34 },
  label: { fontFamily: "Onest_600SemiBold", fontSize: 13, color: "#222", marginBottom: 7 },
  input: { backgroundColor: "#f6f6f6", borderRadius: 12, padding: 14, fontFamily: "Onest_500Medium", fontSize: 15, color: "#111", marginBottom: 16 },
  methods: { flexDirection: "row", gap: 8, marginBottom: 18 },
  method: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 11, backgroundColor: "#f3f3f3", borderWidth: 1, borderColor: "#ececec" },
  methodActive: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  methodText: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#666" },
  methodTextActive: { color: ACCENT },
  save: { backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  saveText: { fontFamily: "Onest_700Bold", fontSize: 15, color: "#fff" },
});
