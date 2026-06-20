// app/(tabs)/analiticas.jsx

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebaseConfig";

const ACCENT = "#e83906";
const ACCENT_LIGHT = "#fdecea";

const FILTROS = ["Hoy", "7d", "30d", "Todo"];
const METODOS = ["efectivo", "tarjeta", "transferencia"];
const METODOS_LABEL = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function fechaInicio(filtro) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (filtro === "Hoy") return hoy;
  if (filtro === "7d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (filtro === "30d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

function parsearFecha(creadoEn) {
  if (!creadoEn) return null;
  if (creadoEn?.seconds) return new Date(creadoEn.seconds * 1000);
  return new Date(creadoEn);
}

function filtrarPorRango(docs, filtro) {
  const inicio = fechaInicio(filtro);
  if (!inicio) return docs;
  return docs.filter((d) => {
    const fecha = parsearFecha(d.creadoEn);
    return fecha && fecha >= inicio;
  });
}

function agruparPorDia(pedidos, filtro) {
  const mapa = {};
  const hoy = new Date();

  let dias = filtro === "Hoy" ? 1 : filtro === "7d" ? 7 : 30;
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
    mapa[key] = 0;
  }

  pedidos.forEach((p) => {
    const fecha = parsearFecha(p.creadoEn);
    if (!fecha) return;
    const key = fecha.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
    if (mapa[key] !== undefined) mapa[key] += p.total || 0;
  });

  return Object.entries(mapa).map(([dia, total]) => ({ dia, total }));
}

function agruparPorHora(pedidos) {
  const mapa = {};
  for (let h = 0; h < 24; h++) mapa[h] = 0;
  pedidos.forEach((p) => {
    const fecha = parsearFecha(p.creadoEn);
    if (!fecha) return;
    mapa[fecha.getHours()] += p.total || 0;
  });
  return Object.entries(mapa)
    .map(([hora, total]) => ({ hora: Number(hora), total }))
    .filter((h) => h.total > 0);
}

function GraficaBarras({ datos, labelKey, valueKey, color = ACCENT }) {
  const max = Math.max(...datos.map((d) => d[valueKey]), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          paddingVertical: 8,
          minHeight: 100,
        }}
      >
        {datos.map((d, i) => (
          <View key={i} style={{ alignItems: "center", width: 40 }}>
            <Text style={styles.graficaValor}>
              {d[valueKey] > 0 ? `$${d[valueKey]}` : ""}
            </Text>
            <View
              style={{
                width: 28,
                height: Math.max(
                  (d[valueKey] / max) * 70,
                  d[valueKey] > 0 ? 4 : 0,
                ),
                backgroundColor: color,
                borderRadius: 4,
              }}
            />
            <Text style={styles.graficaLabel} numberOfLines={1}>
              {d[labelKey]}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BarraHorizontal({ nombre, cantidad, max }) {
  const pct = max > 0 ? cantidad / max : 0;
  return (
    <View style={styles.barraRow}>
      <Text style={styles.barraNombre} numberOfLines={1}>
        {nombre}
      </Text>
      <View style={styles.barraTrack}>
        <View
          style={[styles.barraFill, { width: `${Math.round(pct * 100)}%` }]}
        />
      </View>
      <Text style={styles.barraCantidad}>{cantidad}</Text>
    </View>
  );
}

function ModalVentaManual({ visible, onClose, restaurantId }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);

  async function guardar() {
    const total = parseFloat(monto);
    if (!total || total <= 0) {
      Alert.alert("Error", "Ingresa un monto válido");
      return;
    }
    try {
      setLoading(true);
      await addDoc(collection(db, "manual_sales"), {
        restaurantId,
        total,
        metodo,
        nota: nota.trim(),
        creadoEn: new Date(),
      });
      setMonto("");
      setNota("");
      setMetodo("efectivo");
      onClose();
    } catch (e) {
      Alert.alert("Error", "No se pudo registrar la venta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Registrar venta manual</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Monto ($)</Text>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              placeholder="0.00"
              placeholderTextColor="#bbb"
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Método de pago</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {METODOS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.chipBtn,
                    metodo === m && styles.chipBtnSelected,
                  ]}
                  onPress={() => setMetodo(m)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      metodo === m && styles.chipTextSelected,
                    ]}
                  >
                    {METODOS_LABEL[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              style={styles.input}
              value={nota}
              onChangeText={setNota}
              placeholder="Ej. 2 tacos + refresco"
              placeholderTextColor="#bbb"
            />

            <TouchableOpacity
              style={[styles.accionBtn, loading && { opacity: 0.6 }]}
              onPress={guardar}
              disabled={loading}
            >
              <Text style={styles.accionBtnText}>
                {loading ? "Guardando..." : "Registrar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalCorte({ visible, onClose, pedidosHoy, manualesHoy }) {
  const totalesPago = { efectivo: 0, tarjeta: 0, transferencia: 0 };

  pedidosHoy.forEach((p) => {
    const m = p.pago?.metodo;
    if (totalesPago[m] !== undefined) totalesPago[m] += p.total || 0;
  });

  manualesHoy.forEach((p) => {
    const m = p.metodo;
    if (totalesPago[m] !== undefined) totalesPago[m] += p.total || 0;
  });

  const totalGeneral = Object.values(totalesPago).reduce((a, b) => a + b, 0);
  const hoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Corte de hoy</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text
              style={[
                styles.fieldHint,
                { marginBottom: 16, textTransform: "capitalize" },
              ]}
            >
              {hoy}
            </Text>

            {METODOS.map((m) => (
              <View key={m} style={styles.corteRow}>
                <Text style={styles.corteLabel}>{METODOS_LABEL[m]}</Text>
                <Text style={styles.corteValor}>
                  ${totalesPago[m].toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.corteDivider} />

            <View style={styles.corteRow}>
              <Text
                style={[
                  styles.corteLabel,
                  { fontFamily: "Onest_700Bold", fontSize: 16 },
                ]}
              >
                Total
              </Text>
              <Text
                style={[styles.corteValor, { color: ACCENT, fontSize: 20 }]}
              >
                ${totalGeneral.toFixed(2)}
              </Text>
            </View>

            <View style={styles.corteDivider} />

            <View style={styles.corteRow}>
              <Text style={styles.corteLabel}>Pedidos app</Text>
              <Text style={styles.corteValor}>{pedidosHoy.length}</Text>
            </View>
            <View style={styles.corteRow}>
              <Text style={styles.corteLabel}>Ventas manuales</Text>
              <Text style={styles.corteValor}>{manualesHoy.length}</Text>
            </View>
            <View style={styles.corteRow}>
              <Text
                style={[styles.corteLabel, { fontFamily: "Onest_700Bold" }]}
              >
                Total pedidos
              </Text>
              <Text
                style={[styles.corteValor, { fontFamily: "Onest_700Bold" }]}
              >
                {pedidosHoy.length + manualesHoy.length}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AnaliticasScreen() {
  const { restaurantId } = useAuth();
  const [filtro, setFiltro] = useState("Hoy");
  const [pedidos, setPedidos] = useState([]);
  const [manuales, setManuales] = useState([]);
  const [modalManual, setModalManual] = useState(false);
  const [modalCorte, setModalCorte] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;

    const q = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      orderBy("creadoEn", "desc"),
    );
    const unsub1 = onSnapshot(q, (snap) => {
      setPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const q2 = query(
      collection(db, "manual_sales"),
      where("restaurantId", "==", restaurantId),
      orderBy("creadoEn", "desc"),
    );
    const unsub2 = onSnapshot(q2, (snap) => {
      setManuales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [restaurantId]);

  const pedidosFiltrados = filtrarPorRango(pedidos, filtro);
  const manualesFiltrados = filtrarPorRango(manuales, filtro);
  const todosFiltrados = [...pedidosFiltrados, ...manualesFiltrados];

  const totalVentas = todosFiltrados.reduce((a, p) => a + (p.total || 0), 0);
  const totalPedidos = todosFiltrados.length;
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

  // Hoy para el corte
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const pedidosHoy = pedidos.filter((p) => {
    const f = parsearFecha(p.creadoEn);
    return f && f >= hoyInicio;
  });
  const manualesHoy = manuales.filter((p) => {
    const f = parsearFecha(p.creadoEn);
    return f && f >= hoyInicio;
  });
  const totalHoy = [...pedidosHoy, ...manualesHoy].reduce(
    (a, p) => a + (p.total || 0),
    0,
  );

  // Gráfica de barras por día
  const datosDias =
    filtro !== "Hoy" && filtro !== "Todo"
      ? agruparPorDia(todosFiltrados, filtro)
      : filtro === "Hoy"
        ? agruparPorDia(todosFiltrados, "Hoy")
        : [];

  // Horas pico
  const datosHoras = agruparPorHora(pedidosFiltrados);
  const datosHorasLabel = datosHoras.map((h) => ({
    hora: `${h.hora}h`,
    total: h.total,
  }));

  // Top productos
  const conteoProductos = {};
  pedidosFiltrados.forEach((p) => {
    (p.items || []).forEach((item) => {
      conteoProductos[item.name] =
        (conteoProductos[item.name] || 0) + (item.quantity || 1);
    });
  });
  const topProductos = Object.entries(conteoProductos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));
  const maxTop = topProductos[0]?.cantidad || 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analíticas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Filtros ── */}
        <View style={styles.filtrosRow}>
          {FILTROS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filtroBtn,
                filtro === f && styles.filtroBtnSelected,
              ]}
              onPress={() => setFiltro(f)}
            >
              <Text
                style={[
                  styles.filtroText,
                  filtro === f && styles.filtroTextSelected,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tarjetas resumen ── */}
        <View style={styles.tarjetasGrid}>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaValor}>${totalVentas.toFixed(0)}</Text>
            <Text style={styles.tarjetaLabel}>Ventas</Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaValor}>{totalPedidos}</Text>
            <Text style={styles.tarjetaLabel}>Pedidos</Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaValor}>
              ${ticketPromedio.toFixed(0)}
            </Text>
            <Text style={styles.tarjetaLabel}>Ticket prom.</Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaValor}>{pedidosFiltrados.length}</Text>
            <Text style={styles.tarjetaLabel}>App</Text>
            <Text style={styles.tarjetaSub}>
              {manualesFiltrados.length} manual
            </Text>
          </View>
        </View>

        {/* ── Gráfica ventas en el tiempo ── */}
        {datosDias.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ventas en el tiempo</Text>
            <GraficaBarras datos={datosDias} labelKey="dia" valueKey="total" />
          </View>
        )}

        {/* ── Top productos ── */}
        {topProductos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top productos</Text>
            {topProductos.map((p, i) => (
              <BarraHorizontal
                key={i}
                nombre={p.nombre}
                cantidad={p.cantidad}
                max={maxTop}
              />
            ))}
          </View>
        )}

        {/* ── Horas pico ── */}
        {datosHorasLabel.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horas pico</Text>
            <GraficaBarras
              datos={datosHorasLabel}
              labelKey="hora"
              valueKey="total"
              color="#000"
            />
          </View>
        )}

        {/* ── Corte de hoy ── */}
        <TouchableOpacity
          style={styles.corteCard}
          onPress={() => setModalCorte(true)}
        >
          <View>
            <Text style={styles.sectionTitle}>🧾 Corte de hoy</Text>
            <Text style={styles.corteCardTotal}>${totalHoy.toFixed(2)}</Text>
            <Text style={styles.fieldHint}>
              {pedidosHoy.length + manualesHoy.length} pedidos ·{" "}
              {pedidosHoy.length} app · {manualesHoy.length} manuales
            </Text>
          </View>
          <Text style={styles.corteChevron}>→</Text>
        </TouchableOpacity>

        {/* ── Venta manual ── */}
        <TouchableOpacity
          style={styles.accionBtn}
          onPress={() => setModalManual(true)}
        >
          <Text style={styles.accionBtnText}>+ Registrar venta manual</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ModalVentaManual
        visible={modalManual}
        onClose={() => setModalManual(false)}
        restaurantId={restaurantId}
      />

      <ModalCorte
        visible={modalCorte}
        onClose={() => setModalCorte(false)}
        pedidosHoy={pedidosHoy}
        manualesHoy={manualesHoy}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f6f6" },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 28,
    color: "#1a1a1a",
  },
  scroll: { padding: 16 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
  },
  sectionTitle: {
    fontFamily: "Onest_900Black",
    fontSize: 11,
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
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
  filtrosRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filtroBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
  },
  filtroBtnSelected: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  filtroText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#8e8e93",
  },
  filtroTextSelected: { color: "#fff" },
  tarjetasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    width: "47.5%",
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
  },
  tarjetaValor: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 22,
    color: "#1a1a1a",
    marginBottom: 2,
  },
  tarjetaLabel: {
    fontFamily: "Onest_500Medium",
    fontSize: 12,
    color: "#8e8e93",
  },
  tarjetaSub: {
    fontFamily: "Onest_400Regular",
    fontSize: 11,
    color: "#b1b1b1",
    marginTop: 2,
  },
  graficaValor: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 9,
    color: "#8e8e93",
    marginBottom: 2,
  },
  graficaLabel: {
    fontFamily: "Onest_500Medium",
    fontSize: 9,
    color: "#8e8e93",
    marginTop: 4,
    textAlign: "center",
  },
  barraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  barraNombre: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#1a1a1a",
    width: 120,
  },
  barraTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  barraFill: {
    height: 8,
    backgroundColor: ACCENT,
    borderRadius: 4,
  },
  barraCantidad: {
    fontFamily: "Onest_700Bold",
    fontSize: 13,
    color: "#1a1a1a",
    width: 24,
    textAlign: "right",
  },
  corteCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  corteCardTotal: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 24,
    color: ACCENT,
    marginBottom: 2,
  },
  corteChevron: {
    fontSize: 20,
    color: "#8e8e93",
  },
  corteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  corteLabel: {
    fontFamily: "Onest_500Medium",
    fontSize: 14,
    color: "#656565",
  },
  corteValor: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#1a1a1a",
  },
  corteDivider: {
    height: 0.5,
    backgroundColor: "#e5e5e5",
    marginVertical: 12,
  },
  accionBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  accionBtnText: {
    fontFamily: "Onest_700Bold",
    color: "#fff",
    fontSize: 15,
  },
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
});
