// app/(tabs)/analiticas.jsx

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
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

function escaparHtml(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatoDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function formatoFechaCorte(fecha = new Date()) {
  return fecha.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatoHora(fecha = new Date()) {
  return fecha.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function ModalCorte({
  visible,
  onClose,
  pedidosHoy,
  manualesHoy,
  nombreRestaurante = "Platillo",
}) {
  const [descargando, setDescargando] = useState(false);

  const totalesPago = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
  };

  pedidosHoy.forEach((pedido) => {
    const metodo = pedido.pago?.metodo;

    if (totalesPago[metodo] !== undefined) {
      totalesPago[metodo] += Number(pedido.total) || 0;
    }
  });

  manualesHoy.forEach((venta) => {
    const metodo = venta.metodo;

    if (totalesPago[metodo] !== undefined) {
      totalesPago[metodo] += Number(venta.total) || 0;
    }
  });

  const totalGeneral = Object.values(totalesPago).reduce(
    (acumulado, total) => acumulado + total,
    0,
  );

  const cantidadApp = pedidosHoy.length;
  const cantidadManuales = manualesHoy.length;
  const totalMovimientos = cantidadApp + cantidadManuales;

  const hoy = formatoFechaCorte();
  const horaGeneracion = formatoHora();

  async function descargarCorte() {
    try {
      setDescargando(true);

      const html = `
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="UTF-8" />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />

            <style>
              @page {
                size: A4;
                margin: 0;
              }

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                padding: 0;
                background: #f4f4f5;
                color: #18181b;
                font-family:
                  -apple-system,
                  BlinkMacSystemFont,
                  "Segoe UI",
                  Arial,
                  sans-serif;
              }

              .page {
                width: 100%;
                min-height: 100vh;
                padding: 42px;
                background: #ffffff;
              }

              .top-line {
                height: 7px;
                width: 100%;
                background: #e83906;
                border-radius: 999px;
                margin-bottom: 32px;
              }

              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 24px;
                margin-bottom: 34px;
              }

              .brand {
                font-size: 32px;
                line-height: 1;
                font-weight: 900;
                color: #e83906;
                letter-spacing: -1px;
                margin-bottom: 10px;
              }

              .title {
                margin: 0;
                color: #18181b;
                font-size: 23px;
                font-weight: 800;
              }

              .date {
                margin-top: 8px;
                color: #71717a;
                font-size: 13px;
                text-transform: capitalize;
              }

              .generated {
                padding: 11px 15px;
                border: 1px solid #e4e4e7;
                border-radius: 12px;
                color: #71717a;
                font-size: 11px;
                text-align: right;
                white-space: nowrap;
              }

              .hero {
                padding: 24px;
                border-radius: 18px;
                background: #fff4ef;
                border: 1px solid #ffd9c7;
                margin-bottom: 24px;
              }

              .hero-label {
                color: #9a3412;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin-bottom: 8px;
              }

              .hero-total {
                color: #e83906;
                font-size: 38px;
                line-height: 1.1;
                font-weight: 900;
                letter-spacing: -1px;
              }

              .section {
                margin-top: 25px;
              }

              .section-title {
                margin: 0 0 12px;
                color: #3f3f46;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1px;
                text-transform: uppercase;
              }

              .card {
                overflow: hidden;
                border: 1px solid #e4e4e7;
                border-radius: 16px;
                background: #ffffff;
              }

              .row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-height: 50px;
                padding: 13px 17px;
                border-bottom: 1px solid #f1f1f2;
              }

              .row:last-child {
                border-bottom: none;
              }

              .row-label {
                color: #52525b;
                font-size: 14px;
              }

              .row-value {
                color: #18181b;
                font-size: 14px;
                font-weight: 700;
              }

              .row.total {
                background: #fafafa;
              }

              .row.total .row-label {
                color: #18181b;
                font-size: 15px;
                font-weight: 800;
              }

              .row.total .row-value {
                color: #e83906;
                font-size: 18px;
                font-weight: 900;
              }

              .stats {
                display: flex;
                gap: 12px;
              }

              .stat {
                flex: 1;
                padding: 18px;
                border: 1px solid #e4e4e7;
                border-radius: 16px;
                background: #ffffff;
              }

              .stat-value {
                color: #18181b;
                font-size: 25px;
                font-weight: 900;
                margin-bottom: 5px;
              }

              .stat-label {
                color: #71717a;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }

              .footer {
                margin-top: 42px;
                padding-top: 18px;
                border-top: 1px solid #e4e4e7;
                text-align: center;
                color: #a1a1aa;
                font-size: 10px;
              }

              .footer-brand {
                color: #e83906;
                font-weight: 800;
              }
            </style>
          </head>

          <body>
            <main class="page">
              <div class="top-line"></div>

              <header class="header">
                <div>
                  <div class="brand">Platillo</div>
                  <h1 class="title">
                    Corte diario
                  </h1>

                  <div class="date">
                    ${escaparHtml(hoy)}
                  </div>
                </div>

                <div class="generated">
                  Generado<br />
                  ${escaparHtml(horaGeneracion)}
                </div>
              </header>

              <section class="hero">
                <div class="hero-label">Venta total del día</div>

                <div class="hero-total">
                  ${formatoDinero(totalGeneral)}
                </div>
              </section>

              <section class="section">
                <h2 class="section-title">Desglose por método de pago</h2>

                <div class="card">
                  <div class="row">
                    <span class="row-label">Efectivo</span>

                    <span class="row-value">
                      ${formatoDinero(totalesPago.efectivo)}
                    </span>
                  </div>

                  <div class="row">
                    <span class="row-label">Tarjeta</span>

                    <span class="row-value">
                      ${formatoDinero(totalesPago.tarjeta)}
                    </span>
                  </div>

                  <div class="row">
                    <span class="row-label">Transferencia</span>

                    <span class="row-value">
                      ${formatoDinero(totalesPago.transferencia)}
                    </span>
                  </div>

                  <div class="row total">
                    <span class="row-label">Total</span>

                    <span class="row-value">
                      ${formatoDinero(totalGeneral)}
                    </span>
                  </div>
                </div>
              </section>

              <section class="section">
                <h2 class="section-title">Movimientos registrados</h2>

                <div class="stats">
                  <div class="stat">
                    <div class="stat-value">${cantidadApp}</div>
                    <div class="stat-label">Pedidos app</div>
                  </div>

                  <div class="stat">
                    <div class="stat-value">${cantidadManuales}</div>
                    <div class="stat-label">Ventas manuales</div>
                  </div>

                  <div class="stat">
                    <div class="stat-value">${totalMovimientos}</div>
                    <div class="stat-label">Total pedidos</div>
                  </div>
                </div>
              </section>

              <footer class="footer">
                Reporte generado automáticamente por
                <span class="footer-brand">Platillo</span>.
              </footer>
            </main>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const ahora = new Date();

      const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

      const nombreArchivo = `Corte_${fecha}.pdf`;
      const nuevoUri = FileSystem.cacheDirectory + nombreArchivo;

      await FileSystem.copyAsync({
        from: uri,
        to: nuevoUri,
      });

      const compartirDisponible = await Sharing.isAvailableAsync();

      if (!compartirDisponible) {
        Alert.alert(
          "PDF generado",
          "El corte se generó, pero este dispositivo no permite compartir archivos.",
        );
        return;
      }

      await Sharing.shareAsync(nuevoUri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Guardar o compartir corte de hoy",
      });
    } catch (error) {
      console.error("Error generando corte:", error);

      Alert.alert(
        "No se pudo generar el corte",
        "Ocurrió un problema al crear el archivo PDF.",
      );
    } finally {
      setDescargando(false);
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
            <Text style={styles.modalTitle}>Corte de hoy</Text>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.corteModalContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.corteFecha}>{hoy}</Text>

            <View style={styles.corteResumen}>
              <Text style={styles.corteResumenLabel}>Venta total del día</Text>

              <Text style={styles.corteResumenTotal}>
                {formatoDinero(totalGeneral)}
              </Text>
            </View>

            <Text style={styles.corteSeccionTitulo}>Métodos de pago</Text>

            <View style={styles.corteDetalleCard}>
              {METODOS.map((metodo) => (
                <View key={metodo} style={styles.corteRow}>
                  <Text style={styles.corteLabel}>{METODOS_LABEL[metodo]}</Text>

                  <Text style={styles.corteValor}>
                    {formatoDinero(totalesPago[metodo])}
                  </Text>
                </View>
              ))}

              <View style={styles.corteDivider} />

              <View style={[styles.corteRow, { marginBottom: 0 }]}>
                <Text style={styles.corteTotalLabel}>Total</Text>

                <Text style={styles.corteTotalValor}>
                  {formatoDinero(totalGeneral)}
                </Text>
              </View>
            </View>

            <Text style={styles.corteSeccionTitulo}>Movimientos</Text>

            <View style={styles.corteStatsRow}>
              <View style={styles.corteStat}>
                <Text style={styles.corteStatValue}>{cantidadApp}</Text>
                <Text style={styles.corteStatLabel}>App</Text>
              </View>

              <View style={styles.corteStat}>
                <Text style={styles.corteStatValue}>{cantidadManuales}</Text>
                <Text style={styles.corteStatLabel}>Manuales</Text>
              </View>

              <View style={styles.corteStat}>
                <Text style={styles.corteStatValue}>{totalMovimientos}</Text>
                <Text style={styles.corteStatLabel}>Total</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.descargarCorteBtn,
                descargando && styles.descargarCorteBtnDisabled,
              ]}
              onPress={descargarCorte}
              disabled={descargando}
              activeOpacity={0.8}
            >
              <Text style={styles.descargarCorteBtnText}>
                {descargando ? "Generando PDF..." : "Descargar corte en PDF"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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

  corteModalContent: {
    padding: 20,
    paddingBottom: 34,
  },

  corteFecha: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#8e8e93",
    textTransform: "capitalize",
    marginBottom: 16,
  },

  corteResumen: {
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#ffd4c5",
  },

  corteResumenLabel: {
    fontFamily: "Onest_700Bold",
    fontSize: 11,
    color: "#a63b18",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  corteResumenTotal: {
    fontFamily: "Onest_900Black",
    fontSize: 32,
    color: ACCENT,
    letterSpacing: -0.8,
  },

  corteSeccionTitulo: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 11,
    color: "#636366",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  corteDetalleCard: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ededed",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },

  corteTotalLabel: {
    fontFamily: "Onest_800ExtraBold",
    fontSize: 16,
    color: "#1a1a1a",
  },

  corteTotalValor: {
    fontFamily: "Onest_900Black",
    fontSize: 19,
    color: ACCENT,
  },

  corteStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },

  corteStat: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ededed",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  corteStatValue: {
    fontFamily: "Onest_900Black",
    fontSize: 22,
    color: "#1a1a1a",
    marginBottom: 3,
  },

  corteStatLabel: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 10,
    color: "#8e8e93",
    textTransform: "uppercase",
  },

  descargarCorteBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
  },

  descargarCorteBtnDisabled: {
    opacity: 0.6,
  },

  descargarCorteBtnText: {
    fontFamily: "Onest_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});
