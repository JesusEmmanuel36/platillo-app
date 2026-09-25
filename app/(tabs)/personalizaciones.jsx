import { ModalCloseButton, modalStyles } from "../../components/ModalUI";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { panelApi } from "../../lib/panelApi";

const ACCENT = "#e83906";
const TYPES = [
  { value: "radio", label: "Elegir una" },
  { value: "checkbox", label: "Elegir varias" },
  { value: "addable", label: "Agregar extras" },
  { value: "text", label: "Texto libre" },
];

function emptyTemplate() {
  return {
    title: "",
    type: "radio",
    required: false,
    maxSelectable: 1,
    choices: [{ name: "", price: "" }],
  };
}

function TemplateEditor({ visible, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...initial,
          choices: (initial.choices || []).map((choice) => ({
            ...choice,
            price: String(choice.price || ""),
          })),
        }
      : emptyTemplate(),
  );
  const [saving, setSaving] = useState(false);

  function updateChoice(index, field, value) {
    setForm((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, [field]: value } : choice,
      ),
    }));
  }

  async function save() {
    if (!form.title.trim()) {
      Alert.alert("Falta el nombre", "Escribe el nombre de la personalización.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      type: form.type,
      required: form.type !== "text" && form.required,
      maxSelectable: form.type === "radio" || form.type === "text" ? 1 : Number(form.maxSelectable) || 1,
      choices:
        form.type === "text"
          ? []
          : form.choices
              .map((choice) => ({
                name: choice.name.trim(),
                price: Number(choice.price) || 0,
              }))
              .filter((choice) => choice.name),
    };
    if (form.type !== "text" && payload.choices.length === 0) {
      Alert.alert("Faltan opciones", "Agrega por lo menos una opción.");
      return;
    }
    try {
      setSaving(true);
      await panelApi(
        initial?.id
          ? `/api/panel/option-templates/${initial.id}`
          : "/api/panel/option-templates",
        { method: initial?.id ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      onSaved();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? "Editar" : "Nueva"} personalización</Text>
            <ModalCloseButton onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Ej. Tamaño" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeGrid}>
              {TYPES.map((type) => (
                <TouchableOpacity key={type.value} style={[styles.typeButton, form.type === type.value && styles.typeButtonActive]} onPress={() => setForm((current) => ({ ...current, type: type.value }))}>
                  <Text style={[styles.typeText, form.type === type.value && styles.typeTextActive]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.type !== "text" && (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Selección obligatoria</Text>
                    <Text style={styles.help}>El cliente deberá elegir antes de agregar.</Text>
                  </View>
                  <Switch value={form.required} onValueChange={(required) => setForm((current) => ({ ...current, required }))} trackColor={{ false: "#ddd", true: "#ffd2c2" }} thumbColor={form.required ? ACCENT : "#fff"} />
                </View>
                {form.type !== "radio" && (
                  <>
                    <Text style={styles.label}>Máximo seleccionable</Text>
                    <TextInput style={styles.input} keyboardType="number-pad" value={String(form.maxSelectable)} onChangeText={(value) => setForm((current) => ({ ...current, maxSelectable: value }))} />
                  </>
                )}
                <Text style={styles.label}>Opciones</Text>
                {form.choices.map((choice, index) => (
                  <View key={index} style={styles.choiceRow}>
                    <TextInput style={[styles.input, styles.choiceName]} value={choice.name} onChangeText={(value) => updateChoice(index, "name", value)} placeholder="Nombre" placeholderTextColor="#aaa" />
                    <TextInput style={[styles.input, styles.choicePrice]} value={String(choice.price)} onChangeText={(value) => updateChoice(index, "price", value)} placeholder="Precio" placeholderTextColor="#aaa" keyboardType="decimal-pad" />
                    <TouchableOpacity style={styles.removeChoice} onPress={() => setForm((current) => ({ ...current, choices: current.choices.filter((_, choiceIndex) => choiceIndex !== index) }))}>
                      <Ionicons name="trash-outline" size={19} color="#c42b1c" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addChoice} onPress={() => setForm((current) => ({ ...current, choices: [...current.choices, { name: "", price: "" }] }))}>
                  <Ionicons name="add" size={20} color={ACCENT} />
                  <Text style={styles.addChoiceText}>Agregar opción</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PersonalizacionesScreen() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState({ open: false, template: null });

  const loadTemplates = useCallback(async () => {
    try {
      const data = await panelApi("/api/panel/option-templates");
      setTemplates(data.templates || []);
    } catch (error) {
      Alert.alert("No se pudieron cargar", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    panelApi("/api/panel/option-templates")
      .then((data) => {
        if (active) setTemplates(data.templates || []);
      })
      .catch((error) => {
        if (active) Alert.alert("No se pudieron cargar", error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function removeTemplate(template) {
    Alert.alert("Eliminar personalización", `¿Eliminar “${template.title}”? Los productos que ya la usan no cambiarán.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await panelApi(`/api/panel/option-templates/${template.id}`, { method: "DELETE" });
            loadTemplates();
          } catch (error) {
            Alert.alert("No se pudo eliminar", error.message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Personalizaciones</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setEditor({ open: true, template: null })}
      >
        <Text style={styles.addButtonText}>+ Añadir personalización</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color={ACCENT} />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No hay personalizaciones registradas
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => setEditor({ open: true, template: item })}>
              <View style={styles.cardIcon}><Ionicons name="options-outline" size={22} color={ACCENT} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{TYPES.find((type) => type.value === item.type)?.label || item.type} · {item.type === "text" ? "Texto" : `${item.choices?.length || 0} opciones`}</Text>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => removeTemplate(item)}>
                <Ionicons name="trash-outline" size={19} color="#ba2b1f" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
      {editor.open && (
        <TemplateEditor
          visible
          initial={editor.template}
          onClose={() => setEditor({ open: false, template: null })}
          onSaved={() => {
            setEditor({ open: false, template: null });
            loadTemplates();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
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
  addButton: {
    backgroundColor: ACCENT,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  addButtonText: {
    fontFamily: "Onest_700Bold",
    color: "#fff",
    fontSize: 15,
  },
  list: { paddingHorizontal: 12, paddingBottom: 100, gap: 10 },
  card: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 18, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff0ea" },
  cardTitle: { fontFamily: "Onest_700Bold", fontSize: 16, color: "#171717" },
  cardMeta: { marginTop: 4, fontFamily: "Onest_400Regular", fontSize: 12, color: "#888" },
  deleteButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fff0ee" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: {
    textAlign: "center",
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#8e8e93",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    ...modalStyles.overlay,
  },
  modal: {
    maxHeight: "93%",
    ...modalStyles.surface,
  },
  handle: {
    ...modalStyles.handle,
  },
  modalHeader: {
    ...modalStyles.header,
  },
  modalTitle: {
    ...modalStyles.title,
  },
  
  form: { padding: 18, paddingBottom: 25 },
  label: {
    marginTop: 12,
    marginBottom: 7,
    ...modalStyles.label,
  },
  input: {
    height: 48,
    ...modalStyles.input,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeButton: { width: "48%", minHeight: 43, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#f2f2f2" },
  typeButtonActive: { backgroundColor: "#171717" },
  typeText: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#555" },
  typeTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: 17, padding: 14, borderRadius: 15, backgroundColor: "#f5f5f5" },
  switchTitle: {
    ...modalStyles.label,
  },
  help: {
    marginTop: 3,
    ...modalStyles.body,
  },
  choiceRow: { flexDirection: "row", gap: 7, marginBottom: 8 },
  choiceName: { flex: 1 },
  choicePrice: { width: 90 },
  removeChoice: { width: 46, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff0ee" },
  addChoice: { height: 45, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#fff0ea" },
  addChoiceText: {
    ...modalStyles.label,
  },
  actions: {
    flexDirection: "row",
    ...modalStyles.footer,
  },
  cancelButton: {
    height: 49,
    flex: 1,
    ...modalStyles.button,
    ...modalStyles.secondary,
  },
  cancelText: {
    ...modalStyles.secondaryText,
  },
  saveButton: {
    height: 49,
    flex: 1.4,
    ...modalStyles.button,
    ...modalStyles.primary,
  },
  saveText: {
    ...modalStyles.buttonText,
  },
});
