import { api } from "./api";
import { isIos } from "./pwaInstall";

export const PUSH_PROMPT_DISMISSED_KEY = "push-prompt-dismissed";

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

function isStandaloneNow(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function isPushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/** No iPhone, Web Push so funciona com o PWA instalado na Tela de Inicio (iOS/iPadOS 16.4+) - Safari comum nunca oferece isso. */
export function iosNeedsHomeScreenInstall(): boolean {
  return isIos() && !isStandaloneNow();
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission as PushPermissionState;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const array = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) array[i] = rawData.charCodeAt(i);
  return array;
}

/** Pede permissao (so deve ser chamado a partir de uma acao explicita do usuario) e, se concedida, inscreve o dispositivo no backend. */
export async function subscribeToPush(): Promise<"subscribed" | "denied" | "unsupported"> {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const { publicKey } = await api.get<{ publicKey: string | null }>("/notifications/vapid-public-key");
  if (!publicKey) return "unsupported";

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  await api.post("/notifications/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  });

  return "subscribed";
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.post("/notifications/unsubscribe", { endpoint });
}
