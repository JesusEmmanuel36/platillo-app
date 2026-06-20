import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebaseConfig";
import { uploadToCloudinary } from "../../utils/cloudinary";

const ACCENT = "#e83906";
const ACCENT_LIGHT = "#fdecea";

function opcionVacia() {
  return {
    title: "",
    type: "radio",
    required: false,
    maxSelectable: 1,
    choices: [{ name: "", price: "" }],
  };
}

function productoVacio(restaurantId) {
  return {
    name: "",
    category: "",
    description: "",
    image: "",
    price: "",
    priceType: "fixed",
    stock: true,
    options: [],
    restaurantId,
  };
}

function StockBadge({ stock }) {
  const cfg = stock
    ? { label: "En Stock", bg: "#ceffd2", color: "#2e7d32" }
    : { label: "Sin Stock", bg: "#ffa6a6", color: "#c62828" };
  return (
    <View style={[styles.stockBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.stockText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function ProductoCard({ producto, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={{ uri: producto.image }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <Text style={styles.cardNombre} numberOfLines={1}>
            {producto.name}
          </Text>
          <StockBadge stock={producto.stock} />
        </View>
        <Text style={styles.cardCategoria}>{producto.category}</Text>
        <View style={styles.cardBottom}>
          <Text style={styles.cardPrecio}>
            {producto.priceType === "dynamic"
              ? `Desde $${producto.price}`
              : `$${producto.price}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FormularioProducto({
  inicial,
  categorias,
  onGuardar,
  onCancelar,
  loading,
}) {
  const [form, setForm] = useState(inicial);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function agregarOpcion() {
    setForm((f) => ({ ...f, options: [...f.options, opcionVacia()] }));
  }

  function eliminarOpcion(oi) {
    setForm((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== oi),
    }));
  }

  function setOpcionField(oi, field, value) {
    setForm((f) => {
      const opts = [...f.options];
      opts[oi] = { ...opts[oi], [field]: value };
      return { ...f, options: opts };
    });
  }

  function agregarChoice(oi) {
    setForm((f) => {
      const opts = [...f.options];
      opts[oi] = {
        ...opts[oi],
        choices: [...(opts[oi].choices || []), { name: "", price: "" }],
      };
      return { ...f, options: opts };
    });
  }

  function eliminarChoice(oi, ci) {
    setForm((f) => {
      const opts = [...f.options];
      opts[oi] = {
        ...opts[oi],
        choices: opts[oi].choices.filter((_, i) => i !== ci),
      };
      return { ...f, options: opts };
    });
  }

  function setChoiceField(oi, ci, field, value) {
    setForm((f) => {
      const opts = [...f.options];
      const choices = [...opts[oi].choices];
      choices[ci] = { ...choices[ci], [field]: value };
      opts[oi] = { ...opts[oi], choices };
      return { ...f, options: opts };
    });
  }

  const TIPOS = ["Elige uno", "Elige varios", "Agrega extras", "Texto"];
  const TIPOS_TRADUCIDO = ["radio", "checkbox", "addable", "text"];

  const [subiendoImagen, setSubiendoImagen] = useState(false);

  async function handleCambiarImagen() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      setSubiendoImagen(true);
      const url = await uploadToCloudinary(result.assets[0].uri);
      setField("image", url);
    } catch (e) {
      Alert.alert("Error", "No se pudo subir la imagen");
    } finally {
      setSubiendoImagen(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Básicos */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información básica</Text>

        {/* Imagen */}
        <Text style={styles.fieldLabel}>Imagen</Text>
        {form.image ? (
          <Image
            source={{ uri: form.image }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.previewImagePlaceholder}>
            <Text style={styles.previewImagePlaceholderText}>Sin imagen</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.cambiarImagenBtn, subiendoImagen && { opacity: 0.6 }]}
          onPress={handleCambiarImagen}
          disabled={subiendoImagen}
        >
          <Text style={styles.cambiarImagenText}>
            {subiendoImagen
              ? "Subiendo..."
              : form.image
                ? "Cambiar imagen"
                : "Añadir imagen"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(v) => setField("name", v)}
          placeholder="Ej. Tacos de arrachera"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.fieldLabel}>Categoría</Text>
        {categorias.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {categorias.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chipBtn,
                    form.category === cat && styles.chipBtnSelected,
                  ]}
                  onPress={() => setField("category", cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      form.category === cat && styles.chipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
        <TextInput
          style={styles.input}
          value={form.category}
          onChangeText={(v) => setField("category", v)}
          placeholder="O escribe una nueva categoría"
          placeholderTextColor="#bbb"
        />

        <Text style={styles.fieldLabel}>Descripción</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          value={form.description}
          onChangeText={(v) => setField("description", v)}
          placeholder="Describe el producto"
          placeholderTextColor="#bbb"
          multiline
        />
      </View>

      {/* Precio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Precio</Text>

        <Text style={styles.fieldLabel}>Tipo de precio</Text>
        <View style={styles.segmented}>
          {[
            { val: "fixed", label: "Fijo" },
            { val: "dynamic", label: "Dinámico" },
          ].map(({ val, label }) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.segmentBtn,
                form.priceType === val && styles.segmentBtnSelected,
              ]}
              onPress={() => setField("priceType", val)}
            >
              <Text
                style={[
                  styles.segmentText,
                  form.priceType === val && styles.segmentTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.fieldHint}>
          {form.priceType === "fixed"
            ? "El producto ya tiene un precio base; las opciones pueden agregar costo extra."
            : "El precio lo define la opción que elija el cliente (ej. tamaños)."}
        </Text>

        <Text style={styles.fieldLabel}>Precio base ($)</Text>
        <TextInput
          style={styles.input}
          value={String(form.price)}
          onChangeText={(v) => setField("price", v)}
          placeholder="0"
          placeholderTextColor="#bbb"
          keyboardType="numeric"
        />
      </View>

      {/* Stock */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disponibilidad</Text>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>En stock</Text>
            <Text style={styles.fieldHint}>
              {form.stock
                ? "Visible para los clientes"
                : "Oculto para los clientes"}
            </Text>
          </View>
          <Switch
            value={form.stock}
            onValueChange={(v) => setField("stock", v)}
            trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
            thumbColor={form.stock ? ACCENT : "#ccc"}
          />
        </View>
      </View>

      {/* Opciones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Opciones</Text>

        {form.options.map((opcion, oi) => (
          <View key={oi} style={styles.opcionCard}>
            <View style={styles.opcionHeader}>
              <Text style={styles.opcionNum}>Opción {oi + 1}</Text>
              <TouchableOpacity onPress={() => eliminarOpcion(oi)}>
                <Text style={styles.eliminarText}>Eliminar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput
              style={styles.input}
              value={opcion.title}
              onChangeText={(v) => setOpcionField(oi, "title", v)}
              placeholder="Ej. Tamaño, Ingredientes"
              placeholderTextColor="#bbb"
            />

            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.tiposRow}>
              {TIPOS.map((tipo, ti) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.tipoBtn,
                    opcion.type === TIPOS_TRADUCIDO[ti] &&
                      styles.tipoBtnSelected,
                  ]}
                  onPress={() =>
                    setOpcionField(oi, "type", TIPOS_TRADUCIDO[ti])
                  }
                >
                  <Text
                    style={[
                      styles.tipoText,
                      opcion.type === TIPOS_TRADUCIDO[ti] &&
                        styles.tipoTextSelected,
                    ]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {opcion.type !== "text" && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Obligatorio</Text>
                  <Switch
                    value={opcion.required}
                    onValueChange={(v) => setOpcionField(oi, "required", v)}
                    trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
                    thumbColor={opcion.required ? ACCENT : "#ccc"}
                  />
                </View>

                {opcion.type !== "radio" && (
                  <>
                    <Text style={styles.fieldLabel}>Máximo seleccionable</Text>
                    <TextInput
                      style={styles.input}
                      value={String(opcion.maxSelectable)}
                      onChangeText={(v) =>
                        setOpcionField(oi, "maxSelectable", parseInt(v) || 1)
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#bbb"
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>Opciones</Text>
                {(opcion.choices || []).map((choice, ci) => (
                  <View key={ci} style={styles.choiceRow}>
                    <TextInput
                      style={[styles.input, { flex: 2, marginBottom: 0 }]}
                      value={choice.name}
                      onChangeText={(v) => setChoiceField(oi, ci, "name", v)}
                      placeholder="Nombre"
                      placeholderTextColor="#bbb"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={String(choice.price)}
                      onChangeText={(v) => setChoiceField(oi, ci, "price", v)}
                      placeholder="$0"
                      placeholderTextColor="#bbb"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.choiceEliminarBtn}
                      onPress={() => eliminarChoice(oi, ci)}
                    >
                      <Text style={styles.choiceEliminarText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.agregarChoiceBtn}
                  onPress={() => agregarChoice(oi)}
                >
                  <Text style={styles.agregarChoiceText}>+ Agregar opción</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.agregarOpcionBtn}
          onPress={agregarOpcion}
        >
          <Text style={styles.agregarOpcionText}>
            + Añadir grupo de opciones
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botones */}
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.cancelSecBtn} onPress={onCancelar}>
          <Text style={styles.cancelSecBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.accionBtn,
            { flex: 1, marginHorizontal: 0, marginTop: 0 },
            loading && { opacity: 0.6 },
          ]}
          onPress={() => onGuardar(form)}
          disabled={loading}
        >
          <Text style={styles.accionBtnText}>
            {loading ? "Guardando..." : "Guardar"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DetalleProducto({ producto, categorias, onClose }) {
  const [vista, setVista] = useState("detalle");

  const [loading, setLoading] = useState(false);

  const [stockLocal, setStockLocal] = useState(producto.stock ?? true);

  async function handleToggleStock(value) {
    setStockLocal(value);
    try {
      await updateDoc(doc(db, "products", producto.id), { stock: value });
    } catch (e) {
      setStockLocal(!value);
      Alert.alert("Error", "No se pudo actualizar el stock");
    }
  }

  async function handleEliminar() {
    Alert.alert(
      "Eliminar producto",
      `¿Seguro que quieres eliminar "${producto.name}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "products", producto.id));
              onClose();
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el producto");
            }
          },
        },
      ],
    );
  }

  async function handleGuardar(form) {
    if (!form.name.trim()) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }
    try {
      setLoading(true);
      console.log("UPDATE:");
      console.log(JSON.stringify(form, null, 2));
      await updateDoc(doc(db, "products", producto.id), {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        price: parseFloat(form.price) || 0,
        priceType: form.priceType,
        stock: form.stock,
        options: form.options
          .map((o) => ({
            title: o.title ?? "",
            type: o.type ?? "radio",
            required: o.required ?? false,
            maxSelectable: o.maxSelectable ?? 1,
            choices:
              o.type !== "text"
                ? (o.choices ?? []).map((c) => ({
                    name: c.name ?? "",
                    price: parseFloat(c.price) || 0,
                  }))
                : undefined,
          }))
          .filter((o) => o.title !== ""),
      });
      onClose();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "No se pudo guardar el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {vista === "editar" ? "Editar producto" : producto.name}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {vista === "detalle" ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {producto.image ? (
                <Image
                  source={{ uri: producto.image }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Descripción</Text>
                <Text style={styles.modalDesc}>{producto.description}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Precio</Text>
                <Text style={styles.totalAmount}>
                  {producto.priceType === "dynamic"
                    ? `Desde $${producto.price}`
                    : `$${producto.price}`}
                </Text>
              </View>

              <View style={styles.section}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.switchLabel}>Disponibilidad</Text>
                  </View>
                  <Switch
                    value={stockLocal}
                    onValueChange={handleToggleStock}
                    trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
                    thumbColor={stockLocal ? ACCENT : "#ccc"}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.accionBtn}
                onPress={() => setVista("editar")}
              >
                <Text style={styles.accionBtnText}>Editar producto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accionBtn,
                  { backgroundColor: "#000", marginTop: 10 },
                ]}
                onPress={handleEliminar}
              >
                <Text style={styles.accionBtnText}>Eliminar producto</Text>
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          ) : (
            <FormularioProducto
              inicial={{
                name: producto.name || "",
                category: producto.category || "",
                description: producto.description || "",
                image: producto.image || "",
                price: String(producto.price || ""),
                priceType: producto.priceType || "fixed",
                stock: producto.stock ?? true,
                options: producto.options || [],
                restaurantId: producto.restaurantId,
              }}
              categorias={categorias}
              onGuardar={handleGuardar}
              onCancelar={() => setVista("detalle")}
              loading={loading}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ProductosScreen() {
  const { restaurantId } = useAuth();
  const [productos, setProductos] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [modalAnadir, setModalAnadir] = useState(false);
  const [loadingAnadir, setLoadingAnadir] = useState(false);

  const categorias = [...new Set(productos.map((p) => p.category))];
  const productosPorCategoria = categorias.map((cat) =>
    productos.filter((p) => p.category === cat),
  );
  const listaPlana = productosPorCategoria.flat();

  const indicesPorCategoria = {};
  let contador = 0;
  categorias.forEach((cat, i) => {
    indicesPorCategoria[contador] = cat;
    contador += productosPorCategoria[i].length;
  });

  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, "products"),
      where("restaurantId", "==", restaurantId),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProductos(data);
    });
    return () => unsubscribe();
  }, [restaurantId]);

  async function handleAnadir(form) {
    if (!form.name.trim()) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }
    try {
      setLoadingAnadir(true);
      await addDoc(collection(db, "products"), {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        price: parseFloat(form.price) || 0,
        priceType: form.priceType,
        stock: form.stock,
        options: form.options.map((o) => ({
          title: o.title,
          type: o.type,
          required: o.required,
          maxSelectable: o.maxSelectable,
          ...(o.type !== "text"
            ? {
                choices: o.choices.map((c) => ({
                  name: c.name,
                  price: parseFloat(c.price) || 0,
                })),
              }
            : {}),
        })),
        restaurantId,
      });
      setModalAnadir(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo crear el producto");
    } finally {
      setLoadingAnadir(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Productos</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {productos.length} productos
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={listaPlana}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalAnadir(true)}
          >
            <Text style={styles.addBtnText}>+ Añadir producto</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay productos registrados</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <>
            {indicesPorCategoria[index] !== undefined && (
              <Text
                style={[styles.sectionLabel, index !== 0 && { marginTop: 8 }]}
              >
                {indicesPorCategoria[index]}
              </Text>
            )}
            <ProductoCard
              producto={item}
              onPress={() => setProductoSeleccionado(item)}
            />
          </>
        )}
      />

      {productoSeleccionado && (
        <DetalleProducto
          producto={productoSeleccionado}
          categorias={categorias}
          onClose={() => setProductoSeleccionado(null)}
        />
      )}

      <Modal
        visible={modalAnadir}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAnadir(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo producto</Text>
              <TouchableOpacity
                onPress={() => setModalAnadir(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FormularioProducto
              inicial={productoVacio(restaurantId)}
              categorias={categorias}
              onGuardar={handleAnadir}
              onCancelar={() => setModalAnadir(false)}
              loading={loadingAnadir}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f6f6" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 28,
    color: "#1a1a1a",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBadge: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerBadgeText: {
    fontFamily: "Onest_500Medium",
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#8e8e93",
  },
  lista: { padding: 12 },
  addBtn: {
    backgroundColor: ACCENT,
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  addBtnText: { fontFamily: "Onest_700Bold", color: "#fff", fontSize: 15 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Onest_700Bold",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
    flexDirection: "row",
    overflow: "hidden",
  },
  cardImage: { width: 90, height: 90 },
  cardContent: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardNombre: {
    fontFamily: "Onest_700Bold",
    fontSize: 15,
    color: "#000",
    flex: 1,
  },
  cardCategoria: {
    fontFamily: "Onest_500Medium",
    fontSize: 12,
    color: "#b1b1b1",
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  cardPrecio: { fontFamily: "Onest_700Bold", fontSize: 15, color: ACCENT },
  stockBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  stockText: { fontFamily: "Onest_700Bold", fontSize: 10 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#e5e5e5",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontFamily: "Onest_700Bold",
    fontSize: 17,
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    backgroundColor: "#f3f3f3",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 13, color: "#636366" },
  modalImage: { width: "100%", height: 200 },
  section: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    fontFamily: "Onest_900Black",
    fontSize: 11,
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  modalDesc: {
    fontFamily: "Onest_500Medium",
    fontSize: 14,
    color: "#656565",
    lineHeight: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  totalLabel: { fontFamily: "Onest_700Bold", fontSize: 20, color: "#1a1a1a" },
  totalAmount: { fontFamily: "Onest_700Bold", fontSize: 20, color: ACCENT },
  accionBtn: {
    backgroundColor: ACCENT,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  accionBtnText: { fontFamily: "Onest_700Bold", color: "#fff", fontSize: 15 },
  fieldLabel: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#1a1a1a",
    marginBottom: 6,
    marginTop: 4,
  },
  fieldHint: {
    fontFamily: "Onest_400Regular",
    fontSize: 12,
    color: "#8e8e93",
    marginBottom: 8,
    marginTop: -4,
  },
  input: {
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Onest_500Medium",
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  segmentBtn: { flex: 1, padding: 9, borderRadius: 8, alignItems: "center" },
  segmentBtnSelected: { backgroundColor: "#fff" },
  segmentText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#8e8e93",
  },
  segmentTextSelected: { color: "#1a1a1a" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  switchLabel: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#1a1a1a",
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  chipBtnSelected: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  chipText: { fontFamily: "Onest_600SemiBold", fontSize: 13, color: "#636366" },
  chipTextSelected: { color: ACCENT },
  opcionCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  opcionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  opcionNum: { fontFamily: "Onest_700Bold", fontSize: 13, color: "#1a1a1a" },
  eliminarText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: ACCENT,
  },
  tiposRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tipoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  tipoBtnSelected: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  tipoText: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#636366" },
  tipoTextSelected: { color: "#ffffff" },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  choiceEliminarBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceEliminarText: { fontSize: 13, color: "#636366" },
  agregarChoiceBtn: {
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    marginTop: 4,
  },
  agregarChoiceText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#636366",
  },
  agregarOpcionBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    borderStyle: "dashed",
    marginTop: 4,
  },
  agregarOpcionText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#636366",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cancelSecBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
  },
  cancelSecBtnText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 15,
    color: "#3a3a3c",
  },

  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },
  previewImagePlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  previewImagePlaceholderText: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#b1b1b1",
  },
  cambiarImagenBtn: {
    backgroundColor: "#000",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  cambiarImagenText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
});
