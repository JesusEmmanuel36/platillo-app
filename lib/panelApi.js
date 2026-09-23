import { auth } from "../firebaseConfig";

export const PANEL_API_URL = (
  process.env.EXPO_PUBLIC_PANEL_API_URL || "https://panel.platillo.mx"
).replace(/\/$/, "");

export async function panelApi(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");

  const token = await user.getIdToken();
  const response = await fetch(`${PANEL_API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "No se pudo completar la operación.");
  }
  return data;
}
