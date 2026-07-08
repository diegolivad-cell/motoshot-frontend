import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "./supabaseClient";

const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || "";
const IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID || "";

function getGoogleInitConfig() {
  const config = {
    webClientId: WEB_CLIENT_ID,
    mode: "online",
  };
  if (Capacitor.getPlatform() === "ios") {
    config.iOSClientId = IOS_CLIENT_ID;
    config.iOSServerClientId = WEB_CLIENT_ID;
  }
  return config;
}

function assertGoogleConfigReady() {
  if (!WEB_CLIENT_ID) {
    throw new Error(
      "Falta VITE_GOOGLE_WEB_CLIENT_ID en la configuración de la app (Client ID Web de Google Cloud)."
    );
  }
  if (Capacitor.getPlatform() === "ios" && !IOS_CLIENT_ID) {
    throw new Error(
      "Falta VITE_GOOGLE_IOS_CLIENT_ID para iOS (OAuth client iOS en Google Cloud, bundle com.motoshotgt.app)."
    );
  }
}

let socialLoginReady = false;

function getUrlSafeNonce() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hash(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getNoncePair() {
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hash(rawNonce);
  return { rawNonce, nonceDigest };
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function ensureSocialLoginReady() {
  if (socialLoginReady) return;
  assertGoogleConfigReady();
  await SocialLogin.initialize({
    google: getGoogleInitConfig(),
  });
  socialLoginReady = true;
}

export function isNativeGoogleAuthConfigured() {
  if (!Capacitor.isNativePlatform() || !WEB_CLIENT_ID) return false;
  if (Capacitor.getPlatform() === "ios") return !!IOS_CLIENT_ID;
  return true;
}

export async function signInWithGoogleNative() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Google nativo solo está disponible en la app móvil.");
  }

  await ensureSocialLoginReady();
  const { rawNonce, nonceDigest } = await getNoncePair();

  let response;
  try {
    response = await SocialLogin.login({
      provider: "google",
      options: {
        scopes: ["email", "profile"],
        nonce: nonceDigest,
        filterByAuthorizedAccounts: false,
      },
    });
  } catch (err) {
    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("cancel") || msg.includes("12501") || msg.includes("user")) {
      const cancelErr = new Error("Inicio con Google cancelado.");
      cancelErr.code = "OAUTH_CANCEL";
      throw cancelErr;
    }
    throw err;
  }

  if (response?.result?.responseType !== "online") {
    throw new Error("No se pudo obtener la sesión de Google.");
  }

  const idToken = response.result.idToken;
  if (!idToken) {
    throw new Error("Google no devolvió un token válido.");
  }

  const payload = decodeJwtPayload(idToken);
  const signInOptions = {
    provider: "google",
    token: idToken,
  };
  if (payload?.nonce) {
    signInOptions.nonce = rawNonce;
  }

  const { data, error } = await supabase.auth.signInWithIdToken(signInOptions);
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error("No se pudo completar el inicio con Google.");
  }
  return data.session;
}
