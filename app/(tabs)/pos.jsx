import { ModalCloseButton, modalStyles } from "../../components/ModalUI";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebaseConfig";
import { panelApi } from "../../lib/panelApi";

const ACCENT = "#e83906";
const METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Terminal" },
];

const money = (value) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value) || 0);

function createId() {
  const hex = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return hex.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 3) | 8).toString(16);
  });
}

function optionPrice(product, selected) {
  let total = product.priceType === "dynamic" ? 0 : Number(product.price) || 0;
  for (const group of product.options || []) {
    const value = selected[group.title];
    if (group.type === "radio" && value) {
      if (product.priceType === "dynamic") total = Number(value.price) || 0;
      else total += Number(value.price) || 0;
    } else if (group.type === "checkbox" && Array.isArray(value)) {
      value.forEach((choice) => { total += Number(choice.price) || 0; });
    } else if (group.type === "addable" && value) {
      Object.values(value).forEach((choice) => {
        total += (Number(choice.price) || 0) * (Number(choice.quantity) || 0);
      });
    }
  }
  return Number(total.toFixed(2));
}

function ProductModal({ product, onClose, onAdd }) {
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const price = useMemo(() => optionPrice(product, selected), [product, selected]);

  function toggle(group, choice) {
    setSelected((current) => {
      const values = Array.isArray(current[group.title]) ? current[group.title] : [];
      const exists = values.some((item) => item.name === choice.name);
      if (exists) return { ...current, [group.title]: values.filter((item) => item.name !== choice.name) };
      if (values.length >= Math.max(1, Number(group.maxSelectable) || 1)) return current;
      return { ...current, [group.title]: [...values, choice] };
    });
  }

  function changeAddon(group, choice, delta) {
    setSelected((current) => {
      const values = { ...(current[group.title] || {}) };
      const used = Object.values(values).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      if (delta > 0 && used >= Math.max(1, Number(group.maxSelectable) || 1)) return current;
      const next = Math.max(0, (Number(values[choice.name]?.quantity) || 0) + delta);
      if (next) values[choice.name] = { ...choice, quantity: next };
      else delete values[choice.name];
      return { ...current, [group.title]: values };
    });
  }

  function add() {
    const missing = (product.options || []).find((group) => {
      if (!group.required) return false;
      const value = selected[group.title];
      if (group.type === "text") return !String(value || "").trim();
      if (group.type === "radio") return !value?.name;
      if (group.type === "checkbox") return !Array.isArray(value) || !value.length;
      return !value || !Object.keys(value).length;
    });
    if (missing) {
      Alert.alert("Falta una opción", `Selecciona ${missing.title.toLowerCase()}.`);
      return;
    }
    onAdd({
      lineId: createId(),
      productId: product.id,
      name: product.name,
      quantity,
      options: selected,
      note: note.trim(),
      unitPrice: price,
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{product.name}</Text>
            <ModalCloseButton onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {!!product.image && <Image source={{ uri: product.image }} style={styles.modalImage} resizeMode="contain" />}
            {(product.options || []).map((group, groupIndex) => (
              <View key={`${group.title}-${groupIndex}`} style={styles.optionGroup}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>{group.title}</Text>
                  {group.required && <Text style={styles.required}>Obligatorio</Text>}
                </View>
                {group.type === "text" ? (
                  <TextInput style={styles.input} value={selected[group.title] || ""} onChangeText={(value) => setSelected((current) => ({ ...current, [group.title]: value }))} placeholder="Escribe la indicación" placeholderTextColor="#aaa" />
                ) : (
                  (group.choices || []).map((choice) => {
                    const active =
                      group.type === "radio"
                        ? selected[group.title]?.name === choice.name
                        : group.type === "checkbox"
                          ? (selected[group.title] || []).some((item) => item.name === choice.name)
                          : (selected[group.title]?.[choice.name]?.quantity || 0) > 0;
                    if (group.type === "addable") {
                      const addonQuantity = selected[group.title]?.[choice.name]?.quantity || 0;
                      return (
                        <View key={choice.name} style={styles.optionRow}>
                          <View style={{ flex: 1 }}><Text style={styles.optionName}>{choice.name}</Text><Text style={styles.optionPrice}>{Number(choice.price) ? `+${money(choice.price)}` : "Sin costo"}</Text></View>
                          <TouchableOpacity style={styles.qtySmall} onPress={() => changeAddon(group, choice, -1)}><Text>−</Text></TouchableOpacity>
                          <Text style={styles.qtyText}>{addonQuantity}</Text>
                          <TouchableOpacity style={styles.qtySmallDark} onPress={() => changeAddon(group, choice, 1)}><Text style={{ color: "#fff" }}>+</Text></TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity key={choice.name} style={[styles.optionRow, active && styles.optionRowActive]} onPress={() => group.type === "radio" ? setSelected((current) => ({ ...current, [group.title]: choice })) : toggle(group, choice)}>
                        <Text style={[styles.optionName, { flex: 1 }, active && { color: "#fff" }]}>{choice.name}</Text>
                        <Text style={[styles.optionPrice, active && { color: "#fff" }]}>{Number(choice.price) ? `+${money(choice.price)}` : ""}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ))}
            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput style={[styles.input, { height: 74, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholder="Ej. sin cebolla" placeholderTextColor="#aaa" />
          </ScrollView>
          <View style={styles.productFooter}>
            <View style={styles.quantity}>
              <TouchableOpacity onPress={() => setQuantity((value) => Math.max(1, value - 1))}><Text style={styles.quantityButton}>−</Text></TouchableOpacity>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <TouchableOpacity onPress={() => setQuantity((value) => Math.min(99, value + 1))}><Text style={styles.quantityButton}>+</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addProductButton} onPress={add}><Text style={styles.addProductText}>Agregar · {money(price * quantity)}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CartModal({ visible, cart, onClose, onQuantity, onClear }) {
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const receivedValue = received === "" ? total : Number(received);
  const change = method === "efectivo" ? Math.max(0, receivedValue - total) : 0;

  async function submit() {
    if (!cart.length || saving) return;
    if (method === "efectivo" && (!Number.isFinite(receivedValue) || receivedValue < total)) {
      Alert.alert("Efectivo insuficiente", "La cantidad recibida debe cubrir el total.");
      return;
    }
    try {
      setSaving(true);
      const data = await panelApi("/api/panel/pos/orders", {
        method: "POST",
        body: JSON.stringify({
          requestId: createId(),
          customerName,
          note,
          items: cart.map(({ productId, quantity, options, note: itemNote }) => ({ productId, quantity, options, note: itemNote })),
          payment: { method, ...(method === "efectivo" ? { received: receivedValue } : {}) },
        }),
      });
      onClear();
      onClose();
      setCustomerName("");
      setNote("");
      setReceived("");
      Alert.alert("Venta registrada", `Pedido creado por ${money(data.total)}.`);
    } catch (error) {
      Alert.alert("No se pudo registrar", error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cartSheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Cuenta actual</Text><ModalCloseButton onPress={onClose} /></View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {cart.map((item) => (
              <View key={item.lineId} style={styles.cartItem}>
                <View style={{ flex: 1 }}><Text style={styles.cartName}>{item.name}</Text><Text style={styles.cartPrice}>{money(item.unitPrice * item.quantity)}</Text></View>
                <TouchableOpacity style={styles.qtySmall} onPress={() => onQuantity(item.lineId, -1)}><Text>−</Text></TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtySmallDark} onPress={() => onQuantity(item.lineId, 1)}><Text style={{ color: "#fff" }}>+</Text></TouchableOpacity>
              </View>
            ))}
            <Text style={styles.fieldLabel}>Nombre del cliente (opcional)</Text>
            <TextInput style={styles.input} value={customerName} onChangeText={setCustomerName} placeholder="Venta de mostrador" placeholderTextColor="#aaa" />
            <Text style={styles.fieldLabel}>Método de pago</Text>
            <View style={styles.methods}>
              {METHODS.map((item) => <TouchableOpacity key={item.value} style={[styles.method, method === item.value && styles.methodActive]} onPress={() => setMethod(item.value)}><Text style={[styles.methodText, method === item.value && { color: "#fff" }]}>{item.label}</Text></TouchableOpacity>)}
            </View>
            {method === "efectivo" && (
              <><Text style={styles.fieldLabel}>Efectivo recibido</Text><TextInput style={styles.input} value={received} onChangeText={setReceived} keyboardType="decimal-pad" placeholder={String(total)} placeholderTextColor="#aaa" /><View style={styles.changeRow}><Text style={styles.changeLabel}>Cambio</Text><Text style={styles.changeValue}>{money(change)}</Text></View></>
            )}
            <Text style={styles.fieldLabel}>Nota del pedido (opcional)</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]} multiline value={note} onChangeText={setNote} placeholder="Indicaciones para cocina" placeholderTextColor="#aaa" />
          </ScrollView>
          <View style={styles.checkoutFooter}>
            <View><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{money(total)}</Text></View>
            <TouchableOpacity style={styles.chargeButton} onPress={submit} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.chargeText}>Registrar venta</Text>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PosScreen() {
  const { restaurantId } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const productsQuery = query(collection(db, "products"), where("restaurantId", "==", restaurantId));
    return onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).filter((product) => product.stock === true));
      setLoading(false);
    }, () => setLoading(false));
  }, [restaurantId]);

  const categories = useMemo(() => ["Todos", ...new Set(products.map((product) => product.category?.trim() || "Sin categoría"))], [products]);
  const filtered = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "Todos" || (product.category?.trim() || "Sin categoría") === category;
    const text = `${product.name || ""} ${product.description || ""}`.toLowerCase();
    return matchesCategory && text.includes(search.trim().toLowerCase());
  }), [products, category, search]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Punto de venta</Text>
      </View>
      <View style={styles.searchBox}><Ionicons name="search" size={20} color="#8c8c8c" /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar producto" placeholderTextColor="#aaa" /></View>
      <FlatList horizontal data={categories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} renderItem={({ item }) => <TouchableOpacity style={[styles.category, category === item && styles.categoryActive]} onPress={() => setCategory(item)}><Text style={[styles.categoryText, category === item && { color: "#fff" }]}>{item}</Text></TouchableOpacity>} />
      {loading ? <ActivityIndicator style={{ flex: 1 }} size="large" color={ACCENT} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={[styles.productList, { paddingBottom: cart.length ? 105 : 95 }]}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay productos disponibles.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productCard} activeOpacity={0.75} onPress={() => setSelectedProduct(item)}>
              {!!item.image && <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />}
              <View style={styles.productInfo}><Text numberOfLines={2} style={styles.productName}>{item.name}</Text><Text style={styles.productPrice}>{item.priceType === "dynamic" ? "Desde " : ""}{money(item.price)}</Text></View>
              <View style={styles.plus}><Ionicons name="add" size={21} color="#fff" /></View>
            </TouchableOpacity>
          )}
        />
      )}
      {!!cart.length && <TouchableOpacity style={styles.cartBar} activeOpacity={0.9} onPress={() => setCartOpen(true)}><View style={styles.cartCount}><Text style={styles.cartCountText}>{itemCount}</Text></View><Text style={styles.cartBarText}>Ver cuenta</Text><Text style={styles.cartBarTotal}>{money(total)}</Text></TouchableOpacity>}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(item) => { setCart((current) => [...current, item]); setSelectedProduct(null); }} />}
      <CartModal visible={cartOpen} cart={cart} onClose={() => setCartOpen(false)} onClear={() => setCart([])} onQuantity={(lineId, delta) => setCart((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  pageHeader: {
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
  searchBox: { height: 48, marginHorizontal: 18, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 15, backgroundColor: "#fff" },
  searchInput: { flex: 1, fontFamily: "Onest_500Medium", color: "#222" },
  categories: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 8,
  },
  category: { height: 38, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#ececec" },
  categoryActive: { backgroundColor: "#171717" },
  categoryText: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#555" },
  productList: { paddingHorizontal: 13, paddingTop: 6 },
  productRow: { gap: 10 },
  productCard: { flex: 1, minHeight: 190, marginHorizontal: 5, marginBottom: 10, overflow: "hidden", borderRadius: 18, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  productImage: { width: "100%", height: 105, backgroundColor: "#eee" },
  productInfo: { padding: 12 },
  productName: { minHeight: 38, fontFamily: "Onest_600SemiBold", fontSize: 15, color: "#151515" },
  productPrice: { marginTop: 5, fontFamily: "Onest_700Bold", fontSize: 14, color: ACCENT },
  plus: { position: "absolute", right: 9, top: 88, width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: ACCENT, borderWidth: 3, borderColor: "#fff" },
  emptyText: { marginTop: 50, textAlign: "center", fontFamily: "Onest_500Medium", color: "#888" },
  cartBar: { position: "absolute", left: 15, right: 15, bottom: 12, height: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, borderRadius: 18, backgroundColor: ACCENT, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 12, elevation: 8 },
  cartCount: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(255,255,255,.22)" },
  cartCountText: { fontFamily: "Onest_700Bold", color: "#fff" },
  cartBarText: { flex: 1, marginLeft: 10, fontFamily: "Onest_700Bold", fontSize: 15, color: "#fff" },
  cartBarTotal: { fontFamily: "Onest_700Bold", fontSize: 15, color: "#fff" },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    ...modalStyles.overlay,
  },
  sheet: {
    maxHeight: "94%",
    ...modalStyles.surface,
  },
  cartSheet: {
    height: "92%",
    ...modalStyles.surface,
  },
  handle: {
    ...modalStyles.handle,
  },
  sheetHeader: {
    ...modalStyles.header,
  },
  sheetTitle: {
    ...modalStyles.title,
  },
  
  sheetBody: { padding: 17, paddingBottom: 25 },
  modalImage: { width: "100%", height: 160, marginBottom: 14, borderRadius: 17, backgroundColor: "#fafafa" },
  optionGroup: { marginBottom: 13, padding: 13, borderRadius: 16, backgroundColor: "#f5f5f5" },
  optionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  optionTitle: {
    flex: 1,
    ...modalStyles.sectionTitle,
  },
  required: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, overflow: "hidden", backgroundColor: "#ffe0dd", fontFamily: "Onest_700Bold", fontSize: 10, color: "#ba261b" },
  optionRow: { minHeight: 47, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 7, borderRadius: 13, backgroundColor: "#fff" },
  optionRowActive: { backgroundColor: "#171717" },
  optionName: {
    ...modalStyles.label,
  },
  optionPrice: { fontFamily: "Onest_500Medium", fontSize: 12, color: "#777" },
  input: {
    height: 48,
    ...modalStyles.input,
  },
  fieldLabel: {
    marginTop: 13,
    marginBottom: 7,
    ...modalStyles.label,
  },
  qtySmall: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eee" },
  qtySmallDark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#171717" },
  qtyText: { width: 29, textAlign: "center", fontFamily: "Onest_700Bold" },
  productFooter: {
    flexDirection: "row",
    ...modalStyles.footer,
  },
  quantity: { height: 49, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderRadius: 14, backgroundColor: "#eee" },
  quantityButton: { width: 28, textAlign: "center", fontSize: 20 },
  quantityValue: { width: 26, textAlign: "center", fontFamily: "Onest_700Bold" },
  addProductButton: {
    height: 49,
    flex: 1,
    ...modalStyles.button,
    ...modalStyles.primary,
  },
  addProductText: {
    ...modalStyles.buttonText,
  },
  cartItem: { minHeight: 66, flexDirection: "row", alignItems: "center", marginBottom: 8, padding: 11, borderRadius: 15, backgroundColor: "#f5f5f5" },
  cartName: {
    ...modalStyles.label,
  },
  cartPrice: { marginTop: 3, fontFamily: "Onest_500Medium", fontSize: 12, color: "#777" },
  methods: { flexDirection: "row", gap: 7 },
  method: { flex: 1, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eee" },
  methodActive: { backgroundColor: "#171717" },
  methodText: { fontFamily: "Onest_600SemiBold", fontSize: 11, color: "#555" },
  changeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 9, padding: 13, borderRadius: 13, backgroundColor: "#fff2ed" },
  changeLabel: { fontFamily: "Onest_600SemiBold", color: "#555" },
  changeValue: { fontFamily: "Onest_700Bold", color: ACCENT },
  checkoutFooter: {
    flexDirection: "row",
    alignItems: "center",
    ...modalStyles.footer,
  },
  totalLabel: { fontFamily: "Onest_500Medium", fontSize: 11, color: "#888" },
  totalValue: { fontFamily: "Onest_700Bold", fontSize: 20, color: "#111" },
  chargeButton: {
    height: 50,
    flex: 1,
    ...modalStyles.button,
    ...modalStyles.primary,
  },
  chargeText: {
    ...modalStyles.buttonText,
  },
});
