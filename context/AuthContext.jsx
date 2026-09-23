import { onAuthStateChanged, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../firebaseConfig";
import { panelApi } from "../lib/panelApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const data = await panelApi("/api/panel/session");
          setRestaurantId(data.session.restaurantId);
          setUsuario(user);
        } catch {
          await signOut(auth).catch(() => {});
          setUsuario(null);
          setRestaurantId(null);
        }
      } else {
        // No hay sesión — limpiar todo
        setUsuario(null);
        setRestaurantId(null);
      }
      setVerificando(false);
    });
    return unsub;
  }, []);

  if (verificando) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#e83906" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ usuario, restaurantId }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar el context en cualquier pantalla
export function useAuth() {
  return useContext(AuthContext);
}
