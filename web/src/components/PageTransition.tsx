import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

export function PageTransition() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mainEl = containerRef.current?.closest(".main");
    if (mainEl) mainEl.scrollTop = 0;
  }, [location.pathname]);

  return (
    <div key={location.pathname} ref={containerRef} className="page-transition">
      <Outlet />
    </div>
  );
}
