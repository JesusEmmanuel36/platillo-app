import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "../firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuario logueado — buscar su restaurante
        const q = query(
          collection(db, "restaurants"),
          where("uid", "==", user.uid),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRestaurantId(snap.docs[0].id);
        }
        setUsuario(user);
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
