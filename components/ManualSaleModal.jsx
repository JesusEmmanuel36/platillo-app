import { ModalCloseButton, modalStyles } from "./ModalUI";
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
            <ModalCloseButton onPress={onClose} />
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
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    ...modalStyles.overlay,
  },
  modal: {
    ...modalStyles.surface,
  },
  handle: {
    ...modalStyles.handle,
  },
  header: {
    ...modalStyles.header,
  },
  title: {
    ...modalStyles.title,
  },

  content: { padding: 20, paddingBottom: 34 },
  label: {
    marginBottom: 7,
    ...modalStyles.label,
  },
  input: {
    padding: 14,
    marginBottom: 16,
    ...modalStyles.input,
  },
  methods: { flexDirection: "row", gap: 8, marginBottom: 18 },
  method: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 11, backgroundColor: "#f3f3f3", borderWidth: 1, borderColor: "#ececec" },
  methodActive: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  methodText: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#666" },
  methodTextActive: { color: ACCENT },
  save: {
    padding: 16,
    marginTop: 4,
    ...modalStyles.button,
    ...modalStyles.primary,
  },
  saveText: {
    ...modalStyles.buttonText,
  },
});
