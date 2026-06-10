import { router } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const ACCENT = "#e83906";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Ingresa tu email y contraseña");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // 1. Login con Firebase Auth
      const resultado = await signInWithEmailAndPassword(auth, email, password);
      const uid = resultado.user.uid;

      // 2. Buscar el restaurante que tenga ese uid
      const q = query(collection(db, "restaurants"), where("uid", "==", uid));
      const snap = await getDocs(q);

      // 3. Si no existe restaurante asociado, rechazar
      if (snap.empty) {
        setError("No se encontró un restaurante asociado a esta cuenta");
        await signOut(auth); // cerrar sesión si no tiene restaurante
        return;
      }

      // 4. Login exitoso — el AuthContext ya se encarga del restaurantId
      router.replace("/(tabs)");
    } catch (e) {
      setError("Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.logo}>Platillo</Text>
          <Text style={styles.subtitle}>
            El POS #1 para restaurantes en méxico
          </Text>

          {/* Inputs */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError("");
            }}
            secureTextEntry
          />

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Botón */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: "center" },

  logo: { fontSize: 42, fontWeight: "800", color: ACCENT, marginBottom: 4 },
  subtitle: { fontSize: 15, color: "#8e8e93", marginBottom: 48 },

  input: {
    borderWidth: 0.5,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1a1a1a",
    backgroundColor: "#fafafa",
    marginBottom: 12,
  },

  error: { color: ACCENT, fontSize: 13, marginBottom: 12 },
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
