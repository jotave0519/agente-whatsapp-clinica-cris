import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={style} />;
}

export function SkeletonText({ width = "100%" }: { width?: string | number }) {
  return <Skeleton className="skeleton-text" style={{ width }} />;
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card">
      <Skeleton className="skeleton-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonText key={i} width={i === lines - 1 ? "55%" : "90%"} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="mobile-list-item skeleton-row">
      <Skeleton className="skeleton-circle" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <SkeletonText width="65%" />
        <SkeletonText width="40%" />
      </div>
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton className="skeleton-title" style={{ width: "50%" }} />
          <SkeletonText width="70%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
