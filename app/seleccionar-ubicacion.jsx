import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, GeoPoint, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView from "react-native-maps";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";

export default function SeleccionarUbicacion() {
  const router = useRouter();
  const { address } = useLocalSearchParams();
  const { restaurantId } = useAuth();

  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState({
    latitude: 25.6866,
    longitude: -100.3161,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const cargarUbicacionInicial = useCallback(async () => {
    try {
      if (address?.trim()) {
        const resultados = await Location.geocodeAsync(address);

        if (resultados.length > 0) {
          setRegion({
            latitude: resultados[0].latitude,
            longitude: resultados[0].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });

          setLoading(false);
          return;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});

        setRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    Promise.resolve().then(cargarUbicacionInicial);
  }, [cargarUbicacionInicial]);

  async function confirmar() {
    try {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: region.latitude,
        longitude: region.longitude,
      });

      let direccion = "";

      if (reverse.length > 0) {
        const place = reverse[0];

        direccion = [
          place.street,
          place.streetNumber,
          place.district,
          place.city,
          place.region,
        ]
          .filter(Boolean)
          .join(", ");
      }

      await updateDoc(doc(db, "restaurants", restaurantId), {
        location: new GeoPoint(region.latitude, region.longitude),
        ...(direccion && { address: direccion }),
      });

      router.back();
    } catch (error) {
      console.log("Error guardando ubicación:", error);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
      />

      <View pointerEvents="none" style={styles.markerContainer}>
        <Text style={styles.marker}>📍</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={confirmar}>
        <Text style={styles.buttonText}>Confirmar ubicación</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  markerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
  },
  marker: {
    fontSize: 40,
  },
  button: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 40,
    backgroundColor: "#e83906",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
