// INDEX.JSX

import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { auth, db } from "../../firebaseConfig";

const ACCENT = "#e83906";
const ACCENT_LIGHT = "#fdecea";

// ─── Configuración de notificaciones ────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // el sonido lo manejamos con expo-av
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("pedidos", {
    name: "Pedidos",
    importance: Notifications.AndroidImportance.MAX,
    sound: true,
  });
}

// ────────────────────────────────────────────────────────────────────────────

const statusConfig = {
  preparando: { label: "Preparando", bg: "#ffecce", color: "#ff9d00" },
  listo: { label: "Listo", bg: "#ceffd2", color: "#2e7d32" },
  entregado: { label: "Entregado", bg: "#e8eaf6", color: "#3949ab" },
  cancelado: { label: "Cancelado", bg: "#ffa6a6", color: "#c62828" },
};

const RAZONES_CANCELACION = [
  "Producto agotado",
  "Ingrediente no disponible",
  "Error en stock",
  "Producto descontinuado",
];

function StatusBadge({ status }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    bg: "#f0f0f0",
    color: "#555",
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function PedidoCard({ pedido, onPress }) {
  const resumen = pedido.items
    .map((it) => {
      const opt = Object.values(it.options)[0];
      return `${it.name} ×${it.quantity}${opt ? ` · ${opt.name}` : ""}`;
    })
    .join(", ");

  const recoge = pedido.entrega.tipo === "local";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.cardNombre}>{pedido.cliente.nombre}</Text>
        <StatusBadge status={pedido.status} />
      </View>
      <Text style={styles.cardResumen} numberOfLines={1}>
        {resumen}
      </Text>
      <View style={styles.cardBottom}>
        {recoge ? (
          <Text style={styles.cardTipo}>Recoge en local</Text>
        ) : (
          <Text style={styles.cardTipo}>Envio a domicilio</Text>
        )}
        <Text style={styles.cardTotal}>${pedido.total}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DetallePedido({ pedido, onClose }) {
  const [modalCancelar, setModalCancelar] = useState(false);
  const [razonSeleccionada, setRazonSeleccionada] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatPedidoFecha = (timestamp) => {
    if (!timestamp) return "Sin fecha";
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const isYesterday =
      date.getDate() === ayer.getDate() &&
      date.getMonth() === ayer.getMonth() &&
      date.getFullYear() === ayer.getFullYear();
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isToday) return `Hoy · ${time}`;
    if (isYesterday) return `Ayer · ${time}`;
    return `${date.getDate()} ${date.toLocaleString("es-MX", { month: "short" })} · ${time}`;
  };

  async function handleMarcarListo() {
    try {
      setLoading(true);
      await updateDoc(doc(db, "orders", pedido.id), { status: "listo" });
      onClose();
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar el pedido");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelar() {
    if (!razonSeleccionada) {
      Alert.alert("Selecciona una razón", "Elige el motivo de cancelación");
      return;
    }
    try {
      setLoading(true);
      await updateDoc(doc(db, "orders", pedido.id), {
        status: "cancelado",
        razonCancelacion: razonSeleccionada,
      });
      setModalCancelar(false);
      onClose();
    } catch (e) {
      Alert.alert("Error", "No se pudo cancelar el pedido");
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
            <Text style={styles.modalTitle}>
              Pedido · {pedido.cliente.nombre}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {modalCancelar ? (
            <View style={{ padding: 24 }}>
              <Text style={styles.cancelTitle}>¿Por qué cancelar?</Text>
              <Text style={styles.cancelSubtitle}>
                Selecciona el motivo de cancelación
              </Text>

              {RAZONES_CANCELACION.map((razon) => (
                <TouchableOpacity
                  key={razon}
                  style={[
                    styles.razonBtn,
                    razonSeleccionada === razon && styles.razonBtnSelected,
                  ]}
                  onPress={() => setRazonSeleccionada(razon)}
                >
                  <View
                    style={[
                      styles.razonRadio,
                      razonSeleccionada === razon && styles.razonRadioSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.razonText,
                      razonSeleccionada === razon && styles.razonTextSelected,
                    ]}
                  >
                    {razon}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.cancelActions}>
                <TouchableOpacity
                  style={styles.cancelSecBtn}
                  onPress={() => {
                    setModalCancelar(false);
                    setRazonSeleccionada(null);
                  }}
                >
                  <Text style={styles.cancelSecBtnText}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelConfirmBtn, loading && { opacity: 0.6 }]}
                  onPress={handleCancelar}
                  disabled={loading}
                >
                  <Text style={styles.cancelConfirmBtnText}>
                    {loading ? "..." : "Confirmar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cliente</Text>
                <InfoRow label="Nombre" value={pedido.cliente.nombre} />
                <InfoRow label="Teléfono" value={pedido.cliente.telefono} />
                <InfoRow
                  label="Hora"
                  value={formatPedidoFecha(pedido.creadoEn)}
                />
                {pedido.entrega.tipo === "local" && (
                  <InfoRow label="Entrega" value={"Recoge en local"} />
                )}
                {pedido.entrega.tipo === "domicilio" && (
                  <InfoRow label="Entrega" value={"Envío a domicilio"} />
                )}
              </View>

              {pedido.entrega.tipo === "domicilio" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dirección</Text>
                  <InfoRow label="Calle" value={pedido.entrega.calle} />
                  <InfoRow label="Número" value={pedido.entrega.numero} />
                  <InfoRow label="Colonia" value={pedido.entrega.colonia} />
                  <InfoRow
                    label="Código Postal"
                    value={pedido.entrega.postal}
                  />
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Productos</Text>
                {pedido.items.map((item, i) => {
                  const opts = Object.entries(item.options)
                    .map(([k, v]) => `${k}: ${v.name} +$${v.price}`)
                    .join(" · ");
                  return (
                    <View key={i} style={styles.itemRow}>
                      <View style={styles.itemQty}>
                        <Text style={styles.itemQtyText}>{item.quantity}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {opts ? (
                          <Text style={styles.itemOpt}>{opts}</Text>
                        ) : null}
                        {item.note ? (
                          <Text style={[styles.itemOpt, { color: ACCENT }]}>
                            Nota: {item.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pago</Text>
                <InfoRow label="Método" value={pedido.pago.metodo} />
                {pedido.pago.metodo === "efectivo" && (
                  <>
                    <InfoRow
                      label="Paga con"
                      value={`$${pedido.pago.pagaCon}`}
                    />
                    <InfoRow label="Cambio" value={`$${pedido.pago.cambio}`} />
                  </>
                )}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>${pedido.total}</Text>
              </View>

              {pedido.status === "preparando" && (
                <>
                  <TouchableOpacity
                    style={[styles.accionBtn, loading && { opacity: 0.6 }]}
                    onPress={handleMarcarListo}
                    disabled={loading}
                  >
                    <Text style={styles.accionBtnText}>
                      {loading ? "Guardando..." : "Marcar como listo"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.accionBtn,
                      { marginTop: -22, backgroundColor: "#000" },
                      loading && { opacity: 0.6 },
                    ]}
                    onPress={() => setModalCancelar(true)}
                    disabled={loading}
                  >
                    <Text style={styles.accionBtnText}>Cancelar pedido</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function PedidosScreen() {
  const { restaurantId } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const pedidosIdsRef = useRef(null); // null = primera carga
  const sonidoRef = useRef(null);

  const enCurso = pedidos.filter((p) => p.status === "preparando");
  const listos = pedidos.filter((p) => p.status === "listo");
  const cancelados = pedidos.filter((p) => p.status === "cancelado");

  // Pedir permisos de notificaciones al montar
  useEffect(() => {
    async function registrarToken() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos",
          "Activa las notificaciones para recibir alertas de pedidos.",
        );
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "944a2d8f-70d7-41cf-aac6-2f087ce5ec55",
      });

      const token = tokenData.data;

      if (token && restaurantId) {
        await updateDoc(doc(db, "restaurants", restaurantId), {
          expoPushToken: token,
        });
      }
    }
    registrarToken();
  }, [restaurantId]);

  async function reproducirSonido() {
    try {
      if (sonidoRef.current) {
        await sonidoRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/nuevo-pedido.mp3"),
      );
      sonidoRef.current = sound;
      await sound.playAsync();
    } catch (e) {
      console.log("Error reproduciendo sonido:", e);
    }
  }

  useEffect(() => {
    if (!restaurantId) return;

    const q = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      orderBy("creadoEn", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Primera carga: solo guarda IDs, no notifica
      if (pedidosIdsRef.current === null) {
        pedidosIdsRef.current = new Set(data.map((p) => p.id));
        setPedidos(data);
        return;
      }

      // Detectar pedidos nuevos
      const nuevos = data.filter((p) => !pedidosIdsRef.current.has(p.id));

      if (nuevos.length > 0) {
        reproducirSonido();

        Notifications.scheduleNotificationAsync({
          content: {
            title: "🍽️ Nuevo pedido",
            body: `${nuevos[0].cliente.nombre} · $${nuevos[0].total}`,
          },
          trigger: null, // inmediato
        });
      }

      // Actualizar set de IDs conocidos
      pedidosIdsRef.current = new Set(data.map((p) => p.id));
      setPedidos(data);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  function handleCerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pedidos</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{enCurso.length} activos</Text>
          </View>
          <TouchableOpacity
            onPress={handleCerrarSesion}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutIcon}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista vacía */}
      {pedidos.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay pedidos por el momento</Text>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={[...enCurso, ...listos, ...cancelados]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          enCurso.length > 0 ? (
            <Text style={styles.sectionLabel}>En curso</Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <>
            {index === enCurso.length && listos.length > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
                Listos
              </Text>
            )}
            {index === enCurso.length + listos.length &&
              cancelados.length > 0 && (
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
                  Cancelados
                </Text>
              )}
            <PedidoCard
              pedido={item}
              onPress={() => setPedidoSeleccionado(item)}
            />
          </>
        )}
      />

      {pedidoSeleccionado && (
        <DetallePedido
          pedido={pedidoSeleccionado}
          onClose={() => setPedidoSeleccionado(null)}
        />
      )}
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
    fontWeight: "700",
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
    fontFamily: "Onest_100Thin",
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  logoutBtn: {
    width: 34,
    height: 34,
    backgroundColor: "#f2f2f7",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutIcon: { fontSize: 18, color: "#636366" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: "#8e8e93" },
  lista: { padding: 12 },
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
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardNombre: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 15,
    fontWeight: "600",
    color: "rgb(0, 0, 0)",
  },
  cardResumen: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#747474",
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTipo: { fontFamily: "Onest_600SemiBold", fontSize: 12, color: "#b1b1b1" },
  cardTotal: { fontSize: 16, fontWeight: "700", color: ACCENT },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontFamily: "Onest_700Bold", fontSize: 11, fontWeight: "600" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
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
    fontWeight: "700",
    color: "#1a1a1a",
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
  section: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    fontFamily: "Onest_900Black",
    fontSize: 11,
    fontWeight: "600",
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: { fontSize: 13, color: "#656565" },
  infoValue: {
    fontFamily: "Onest_700Bold",
    fontSize: 13,
    fontWeight: "500",
    color: "#000000",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  itemQty: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemQtyText: {
    fontFamily: "Onest_900Black",
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
  },
  itemName: {
    fontFamily: "Onest_700Bold",
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  itemOpt: {
    fontFamily: "Onest_500Medium",
    fontSize: 12,
    color: "#636366",
    marginTop: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  totalLabel: {
    fontFamily: "Onest_700Bold",
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  totalAmount: {
    fontFamily: "Onest_700Bold",
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
  },
  accionBtn: {
    backgroundColor: ACCENT,
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  accionBtnText: {
    fontFamily: "Onest_700Bold",
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelModal: {
    backgroundColor: "#fff",
    margin: 24,
    borderRadius: 20,
    padding: 24,
    alignSelf: "stretch",
  },
  cancelTitle: {
    fontFamily: "Onest_700Bold",
    fontSize: 18,
    fontWeight: "800",
    color: "#000000",
    marginBottom: 4,
  },
  cancelSubtitle: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#656565",
    marginBottom: 20,
  },
  razonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    marginBottom: 10,
  },
  razonBtnSelected: { borderColor: ACCENT, backgroundColor: ACCENT_LIGHT },
  razonRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#c7c7cc",
  },
  razonRadioSelected: { borderColor: ACCENT, backgroundColor: ACCENT },
  razonText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#656565",
  },
  razonTextSelected: { color: ACCENT, fontWeight: "600" },
  cancelActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelSecBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
  },
  cancelSecBtnText: { fontSize: 15, fontWeight: "600", color: "#3a3a3c" },
  cancelConfirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
  },
  cancelConfirmBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});
