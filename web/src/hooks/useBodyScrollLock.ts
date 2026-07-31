import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;

/**
 * Trava o scroll do body enquanto `active` for true. Usa position:fixed
 * (em vez de so overflow:hidden) porque no Safari/iOS o body ainda faz
 * "rubber-band scroll" por baixo de overlays fixed se so overflow for
 * travado - position:fixed no body e a unica forma confiavel de travar.
 * Suporta modais aninhados via contador de locks.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [active]);
}
