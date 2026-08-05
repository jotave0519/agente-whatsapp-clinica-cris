/**
 * Estado compartilhado do prompt de instalacao do PWA (evento
 * beforeinstallprompt so pode ser capturado uma vez e usado depois sob
 * demanda) - centralizado aqui pra InstallPrompt.tsx (popup automatico) e
 * Configuracoes.tsx (botao manual) usarem a mesma instancia do evento.
 */
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const INSTALL_PROMPT_SEEN_KEY = "pwa-install-prompt-seen";

interface InstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

function isStandaloneNow(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

let state: InstallState = { deferredPrompt: null, installed: isStandaloneNow() };
const listeners = new Set<() => void>();

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setState({ deferredPrompt: e as BeforeInstallPromptEvent });
});

window.addEventListener("appinstalled", () => {
  try {
    localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, "1");
  } catch {
    // localStorage indisponivel (modo privado etc) - segue sem persistir
  }
  setState({ deferredPrompt: null, installed: true });
});

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !("MSStream" in window);
}

/** Sempre a mesma referencia entre mudancas reais - useSyncExternalStore exige isso. */
export function getInstallSnapshot(): InstallState {
  return state;
}

export function subscribeInstallState(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstallState, getInstallSnapshot);
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!state.deferredPrompt) return "unavailable";
  await state.deferredPrompt.prompt();
  const choice = await state.deferredPrompt.userChoice;
  setState({ deferredPrompt: null });
  return choice.outcome;
}
