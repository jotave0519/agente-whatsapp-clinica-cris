import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}

const prefersReducedMotion =
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Numero que conta suavemente do valor anterior ate o novo (count-up), em
 * vez de trocar instantaneamente - usado nos indicadores importantes da
 * plataforma (faturamento, contagens de atendimentos/pacientes, etc).
 * Na primeira montagem conta a partir de 0; nas trocas seguintes, do valor
 * anterior ate o novo. Respeita prefers-reduced-motion (pula direto pro
 * valor final, sem animar).
 */
export function AnimatedNumber({ value, format, duration = 600 }: Props) {
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const fromRef = useRef(prefersReducedMotion ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rounded = Math.round(display);
  return <>{format ? format(rounded) : rounded}</>;
}
