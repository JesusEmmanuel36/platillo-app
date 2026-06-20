// app/(tabs)/configuracion.jsx

import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  PanResponder,
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
import { auth, db } from "../../firebaseConfig";
import { uploadToCloudinary } from "../../utils/cloudinary";

const ACCENT = "#e83906";
const ACCENT_LIGHT = "#fdecea";

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function horarioVacio() {
  return DIAS.map((dia) => ({
    dia,
    abierto: true,
    apertura: "09:00",
    cierre: "23:00",
  }));
}

function esHexValido(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function hsvToHex(h, s, v) {
  let r, g, b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  const toHex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function ColorPickerRect({
  hue,
  saturation,
  brightness,
  onHueChange,
  onSvChange,
  onBrightnessChange,
}) {
  const PICKER_WIDTH = Dimensions.get("window").width - 64;
  const PICKER_HEIGHT = 200;
  const SLIDER_HEIGHT = 24;

  // SV picker
  const svResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const s = Math.min(Math.max(locationX / PICKER_WIDTH, 0), 1);
      const v = Math.min(Math.max(1 - locationY / PICKER_HEIGHT, 0), 1);
      onSvChange(s, v);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const s = Math.min(Math.max(locationX / PICKER_WIDTH, 0), 1);
      const v = Math.min(Math.max(1 - locationY / PICKER_HEIGHT, 0), 1);
      onSvChange(s, v);
    },
  });

  // Hue slider
  const hueResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX } = e.nativeEvent;
      onHueChange(Math.min(Math.max((locationX / PICKER_WIDTH) * 360, 0), 360));
    },
    onPanResponderMove: (e) => {
      const { locationX } = e.nativeEvent;
      onHueChange(Math.min(Math.max((locationX / PICKER_WIDTH) * 360, 0), 360));
    },
  });

  // Brightness slider
  const brightnessResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX } = e.nativeEvent;
      onBrightnessChange(Math.min(Math.max(locationX / PICKER_WIDTH, 0), 1));
    },
    onPanResponderMove: (e) => {
      const { locationX } = e.nativeEvent;
      onBrightnessChange(Math.min(Math.max(locationX / PICKER_WIDTH, 0), 1));
    },
  });

  const hueColor = hsvToHex(hue, 1, 1);
  const thumbX = saturation * PICKER_WIDTH;
  const thumbY = (1 - brightness) * PICKER_HEIGHT;

  return (
    <View style={{ gap: 12 }}>
      {/* SV picker */}
      <View
        style={{
          width: PICKER_WIDTH,
          height: PICKER_HEIGHT,
          borderRadius: 10,
          overflow: "hidden",
        }}
        {...svResponder.panHandlers}
      >
        <LinearGradient
          colors={["#fff", hueColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: PICKER_WIDTH, height: PICKER_HEIGHT }}
        >
          <LinearGradient
            colors={["transparent", "#000"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ width: PICKER_WIDTH, height: PICKER_HEIGHT }}
          />
        </LinearGradient>

        {/* Thumb */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: thumbX - 10,
            top: thumbY - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: "#fff",
            shadowColor: "#000",
            shadowOpacity: 0.4,
            shadowRadius: 3,
            elevation: 4,
          }}
        />
      </View>

      {/* Hue slider */}
      <View>
        <Text
          style={{
            fontFamily: "Onest_600SemiBold",
            fontSize: 12,
            color: "#8e8e93",
            marginBottom: 6,
          }}
        >
          TONO
        </Text>
        <View
          style={{
            width: PICKER_WIDTH,
            height: SLIDER_HEIGHT,
            borderRadius: 12,
            overflow: "hidden",
          }}
          {...hueResponder.panHandlers}
        >
          <LinearGradient
            colors={[
              "#ff0000",
              "#ffff00",
              "#00ff00",
              "#00ffff",
              "#0000ff",
              "#ff00ff",
              "#ff0000",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: PICKER_WIDTH, height: SLIDER_HEIGHT }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: (hue / 360) * PICKER_WIDTH - 10,
              top: 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: "#fff",
              backgroundColor: hueColor,
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 3,
              elevation: 4,
            }}
          />
        </View>
      </View>

      {/* Brightness slider */}
      <View>
        <Text
          style={{
            fontFamily: "Onest_600SemiBold",
            fontSize: 12,
            color: "#8e8e93",
            marginBottom: 6,
          }}
        >
          BRILLO
        </Text>
        <View
          style={{
            width: PICKER_WIDTH,
            height: SLIDER_HEIGHT,
            borderRadius: 12,
            overflow: "hidden",
          }}
          {...brightnessResponder.panHandlers}
        >
          <LinearGradient
            colors={["#000", hsvToHex(hue, saturation, 1)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: PICKER_WIDTH, height: SLIDER_HEIGHT }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: brightness * PICKER_WIDTH - 10,
              top: 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: "#fff",
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 3,
              elevation: 4,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default function ConfiguracionScreen() {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [brightness, setBrightness] = useState(1);

  const { restaurantId } = useAuth();
  const [restaurante, setRestaurante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subiendoBanner, setSubiendoBanner] = useState(false);
  const [subiendoPfp, setSubiendoPfp] = useState(false);

  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [phone, setPhone] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [horarios, setHorarios] = useState(horarioVacio());
  const [cash, setCash] = useState(true);
  const [card, setCard] = useState(true);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [transferBank, setTransferBank] = useState("");
  const [transferClabe, setTransferClabe] = useState("");
  const [transferHolder, setTransferHolder] = useState("");
  const [banner, setBanner] = useState("");
  const [pfp, setPfp] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [accentColor, setAccentColor] = useState("#e83906");
  const [hexInput, setHexInput] = useState("#e83906");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryPrice, setDeliveryPrice] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = onSnapshot(
      doc(db, "restaurants", restaurantId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setRestaurante(data);
        setInstagram(data.instagram || "");
        setFacebook(data.facebook || "");
        setPhone(data.phone || "");
        setIsOpen(data.isOpen ?? true);
        setAlwaysOpen(data.alwaysOpen ?? false);
        setHorarios(data.horarios || horarioVacio());
        setCash(data.paymentMethods?.cash ?? true);
        setCard(data.paymentMethods?.card ?? true);
        setTransferEnabled(data.paymentMethods?.transfer?.enabled ?? false);
        setTransferBank(data.paymentMethods?.transfer?.bank || "");
        setTransferClabe(data.paymentMethods?.transfer?.clabe || "");
        setTransferHolder(data.paymentMethods?.transfer?.holder || "");
        setBanner(data.banner || "");
        setPfp(data.pfp || "");
        setAddress(data.address || "");
        setLocation(data.location || null);
        const color = data.accent_color || "#e83906";
        setAccentColor(color);
        setHexInput(color);
        setAccentColor(color);
        setHexInput(color);
        if (esHexValido(color)) {
          const { h, s, v } = hexToHsv(color);
          setHue(h);
          setSaturation(s);
          setBrightness(v);
        }
        setDeliveryEnabled(data.delivery_enabled ?? false);
        setDeliveryPrice(String(data.delivery_price ?? ""));
      },
    );
    return () => unsubscribe();
  }, [restaurantId]);

  async function cerrarSesion() {
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

  async function handleSubirImagen(tipo) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: tipo === "banner" ? [16, 9] : [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      tipo === "banner" ? setSubiendoBanner(true) : setSubiendoPfp(true);
      const url = await uploadToCloudinary(result.assets[0].uri);
      await updateDoc(doc(db, "restaurants", restaurantId), { [tipo]: url });
      tipo === "banner" ? setBanner(url) : setPfp(url);
    } catch (e) {
      Alert.alert("Error", "No se pudo subir la imagen");
    } finally {
      tipo === "banner" ? setSubiendoBanner(false) : setSubiendoPfp(false);
    }
  }

  function setHorarioField(index, field, value) {
    setHorarios((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleHexInput(text) {
    setHexInput(text);
    const formatted = text.startsWith("#") ? text : `#${text}`;
    if (esHexValido(formatted)) {
      setAccentColor(formatted);
      setHexInput(formatted);
    }
  }

  function handleSelectPreset(color) {
    setAccentColor(color);
    setHexInput(color);
  }

  async function guardar() {
    function generarLightAccent(hex) {
      const { h, s, v } = hexToHsv(hex);
      return hsvToHex(h, s * 0.3, 1); // menos saturado, brillo máximo
    }

    if (!esHexValido(accentColor)) {
      Alert.alert("Error", "El color no es válido, usa formato #RRGGBB");
      return;
    }
    try {
      setLoading(true);
      await updateDoc(doc(db, "restaurants", restaurantId), {
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        phone: phone.trim(),
        address: address.trim(),
        location,
        isOpen,
        alwaysOpen,
        horarios,
        paymentMethods: {
          cash,
          card,
          transfer: {
            enabled: transferEnabled,
            bank: transferBank.trim(),
            clabe: transferClabe.trim(),
            holder: transferHolder.trim(),
          },
        },
        accent_color: accentColor,
        light_accent: generarLightAccent(accentColor),
        delivery_enabled: deliveryEnabled,
        delivery_price: deliveryEnabled ? parseFloat(deliveryPrice) || 0 : 0,
      });
      Alert.alert("Guardado", "Los cambios se guardaron correctamente");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  if (!restaurante) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={scrollEnabled}
      >
        {/* ── Banner ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Banner del negocio</Text>
          {banner ? (
            <Image
              source={{ uri: banner }}
              style={styles.bannerPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.bannerPreview, styles.placeholder]}>
              <Text style={styles.placeholderText}>Sin banner</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.cambiarImagenBtn,
              subiendoBanner && { opacity: 0.6 },
            ]}
            onPress={() => handleSubirImagen("banner")}
            disabled={subiendoBanner}
          >
            <Text style={styles.cambiarImagenText}>
              {subiendoBanner
                ? "Subiendo..."
                : banner
                  ? "Cambiar banner"
                  : "Añadir banner"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Foto de perfil ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Foto de perfil</Text>
          {pfp ? (
            <Image
              source={{ uri: pfp }}
              style={styles.pfpPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.pfpPreview, styles.placeholder]}>
              <Text style={styles.placeholderText}>Sin foto</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.cambiarImagenBtn, subiendoPfp && { opacity: 0.6 }]}
            onPress={() => handleSubirImagen("pfp")}
            disabled={subiendoPfp}
          >
            <Text style={styles.cambiarImagenText}>
              {subiendoPfp
                ? "Subiendo..."
                : pfp
                  ? "Cambiar foto"
                  : "Añadir foto"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Color del negocio ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color del negocio</Text>

          {/* Preview + hex */}
          <View style={styles.colorPreviewRow}>
            <View
              style={[styles.colorPreviewBox, { backgroundColor: accentColor }]}
            />
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={(text) => {
                setHexInput(text);
                const formatted = text.startsWith("#") ? text : `#${text}`;
                if (esHexValido(formatted)) {
                  setAccentColor(formatted);
                  setHexInput(formatted);
                  const { h, s, v } = hexToHsv(formatted);
                  setHue(h);
                  setSaturation(s);
                  setBrightness(v);
                }
              }}
              placeholder="#e83906"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
            />
          </View>

          <View
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
          >
            <ColorPickerRect
              hue={hue}
              saturation={saturation}
              brightness={brightness}
              onHueChange={(h) => {
                setHue(h);
                const hex = hsvToHex(h, saturation, brightness);
                setAccentColor(hex);
                setHexInput(hex);
              }}
              onSvChange={(s, v) => {
                setSaturation(s);
                setBrightness(v);
                const hex = hsvToHex(hue, s, v);
                setAccentColor(hex);
                setHexInput(hex);
              }}
              onBrightnessChange={(v) => {
                setBrightness(v);
                const hex = hsvToHex(hue, saturation, v);
                setAccentColor(hex);
                setHexInput(hex);
              }}
            />
          </View>

          <Text style={[styles.fieldHint, { marginTop: 12 }]}>
            Este color se usará como color principal en la página de tu negocio.
          </Text>
        </View>

        {/* ── Redes y contacto ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redes y contacto</Text>

          <Text style={styles.fieldLabel}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="10 dígitos"
            placeholderTextColor="#bbb"
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Instagram</Text>
          <TextInput
            style={styles.input}
            value={instagram}
            onChangeText={setInstagram}
            placeholder="https://instagram.com/..."
            placeholderTextColor="#bbb"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Facebook</Text>
          <TextInput
            style={styles.input}
            value={facebook}
            onChangeText={setFacebook}
            placeholder="https://facebook.com/..."
            placeholderTextColor="#bbb"
            autoCapitalize="none"
          />
        </View>

        {/* ── Ubicación ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ubicación</Text>
          <Text style={styles.fieldLabel}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Dirección del negocio"
            placeholderTextColor="#bbb"
          />
          <TouchableOpacity
            style={styles.cambiarImagenBtn}
            onPress={() =>
              router.push({
                pathname: "/seleccionar-ubicacion",
                params: {
                  address,
                  currentLat: location?.latitude,
                  currentLng: location?.longitude,
                },
              })
            }
          >
            <Text style={styles.cambiarImagenText}>Seleccionar en mapa</Text>
          </TouchableOpacity>
          <Text style={styles.locationHint}>
            Es obligatorio seleccionar la ubicación en el mapa para que los
            clientes puedan encontrar tu negocio correctamente y recibir
            pedidos.
          </Text>
        </View>

        {/* ── Estado del negocio ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del negocio</Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Negocio abierto</Text>
              <Text style={styles.fieldHint}>
                {isOpen
                  ? "Visible y recibiendo pedidos"
                  : "Cerrado temporalmente"}
              </Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={isOpen ? ACCENT : "#ccc"}
            />
          </View>

          <View style={[styles.switchRow, { marginTop: 16 }]}>
            <View>
              <Text style={styles.switchLabel}>Abierto 24 horas</Text>
              <Text style={styles.fieldHint}>
                Ignora el horario configurado
              </Text>
            </View>
            <Switch
              value={alwaysOpen}
              onValueChange={setAlwaysOpen}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={alwaysOpen ? ACCENT : "#ccc"}
            />
          </View>
        </View>

        {/* ── Horarios ── */}
        {!alwaysOpen && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horarios</Text>
            {horarios.map((h, i) => (
              <View key={h.dia} style={styles.horarioRow}>
                <View style={styles.horarioDiaRow}>
                  <Text style={styles.horarioDia}>{h.dia}</Text>
                  <Switch
                    value={h.abierto}
                    onValueChange={(v) => setHorarioField(i, "abierto", v)}
                    trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
                    thumbColor={h.abierto ? ACCENT : "#ccc"}
                  />
                </View>
                {h.abierto && (
                  <View style={styles.horarioTimes}>
                    <View style={styles.horarioTimeField}>
                      <Text style={styles.fieldLabel}>Apertura</Text>
                      <TextInput
                        style={styles.input}
                        value={h.apertura}
                        onChangeText={(v) => setHorarioField(i, "apertura", v)}
                        placeholder="09:00"
                        placeholderTextColor="#bbb"
                      />
                    </View>
                    <View style={styles.horarioTimeField}>
                      <Text style={styles.fieldLabel}>Cierre</Text>
                      <TextInput
                        style={styles.input}
                        value={h.cierre}
                        onChangeText={(v) => setHorarioField(i, "cierre", v)}
                        placeholder="23:00"
                        placeholderTextColor="#bbb"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Métodos de pago ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Métodos de pago</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Efectivo</Text>
            <Switch
              value={cash}
              onValueChange={setCash}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={cash ? ACCENT : "#ccc"}
            />
          </View>

          <View style={[styles.switchRow, { marginTop: 16 }]}>
            <Text style={styles.switchLabel}>Tarjeta</Text>
            <Switch
              value={card}
              onValueChange={setCard}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={card ? ACCENT : "#ccc"}
            />
          </View>

          <View style={[styles.switchRow, { marginTop: 16 }]}>
            <Text style={styles.switchLabel}>Transferencia</Text>
            <Switch
              value={transferEnabled}
              onValueChange={setTransferEnabled}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={transferEnabled ? ACCENT : "#ccc"}
            />
          </View>

          {transferEnabled && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Banco</Text>
              <TextInput
                style={styles.input}
                value={transferBank}
                onChangeText={setTransferBank}
                placeholder="Ej. BBVA"
                placeholderTextColor="#bbb"
              />
              <Text style={styles.fieldLabel}>CLABE</Text>
              <TextInput
                style={styles.input}
                value={transferClabe}
                onChangeText={setTransferClabe}
                placeholder="18 dígitos"
                placeholderTextColor="#bbb"
                keyboardType="numeric"
              />
              <Text style={styles.fieldLabel}>Titular</Text>
              <TextInput
                style={styles.input}
                value={transferHolder}
                onChangeText={setTransferHolder}
                placeholder="Nombre del titular"
                placeholderTextColor="#bbb"
              />
            </View>
          )}
        </View>

        {/* ── Tipos de entrega ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de entrega</Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Envío a domicilio</Text>
              <Text style={styles.fieldHint}>
                {deliveryEnabled
                  ? "Los clientes pueden pedir envío"
                  : "Solo recolección en local"}
              </Text>
            </View>
            <Switch
              value={deliveryEnabled}
              onValueChange={setDeliveryEnabled}
              trackColor={{ false: "#e5e5e5", true: ACCENT_LIGHT }}
              thumbColor={deliveryEnabled ? ACCENT : "#ccc"}
            />
          </View>

          {deliveryEnabled && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Precio de envío ($)</Text>
              <TextInput
                style={styles.input}
                value={deliveryPrice}
                onChangeText={setDeliveryPrice}
                placeholder="0"
                placeholderTextColor="#bbb"
                keyboardType="numeric"
              />
              <Text style={styles.fieldHint}>
                Escribe 0 si el envío es gratis.
              </Text>
            </View>
          )}
        </View>

        {/* ── Guardar ── */}
        <TouchableOpacity
          style={[styles.accionBtn, loading && { opacity: 0.6 }]}
          onPress={guardar}
          disabled={loading}
        >
          <Text style={styles.accionBtnText}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Text>
        </TouchableOpacity>

        {/* ── Cerrar sesión ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={cerrarSesion}>
          <Text style={styles.accionBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: "Onest_500Medium", fontSize: 14, color: "#8e8e93" },
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
    marginBottom: 14,
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
    marginTop: 2,
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#1a1a1a",
  },
  bannerPreview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
  },
  pfpPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    alignSelf: "center",
  },
  placeholder: {
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  placeholderText: {
    fontFamily: "Onest_500Medium",
    fontSize: 13,
    color: "#b1b1b1",
  },
  cambiarImagenBtn: {
    backgroundColor: "#000",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 4,
  },
  cambiarImagenText: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  horarioRow: {
    marginBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 14,
  },
  horarioDiaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  horarioDia: {
    fontFamily: "Onest_600SemiBold",
    fontSize: 14,
    color: "#1a1a1a",
  },
  horarioTimes: {
    flexDirection: "row",
    gap: 12,
  },
  horarioTimeField: { flex: 1 },
  accionBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  accionBtnText: {
    fontFamily: "Onest_700Bold",
    color: "#fff",
    fontSize: 15,
  },
  logoutBtn: {
    backgroundColor: "#000",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  locationHint: {
    marginTop: 10,
    fontFamily: "Onest_500Medium",
    fontSize: 12,
    color: "#8e8e93",
    lineHeight: 18,
  },
  colorPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  colorPreviewBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  hexInput: {
    flex: 1,
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Onest_500Medium",
    fontSize: 14,
    color: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#ececec",
  },
});
