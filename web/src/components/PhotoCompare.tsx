import { useEffect, useState } from "react";
import { getSignedMediaUrl } from "../lib/patientMediaUpload";
import { XIcon } from "./icons";

export interface PatientMediaItem {
  id: string;
  schedule_id: string | null;
  kind: "antes" | "depois";
  storage_path: string;
  created_at: string;
}

interface Group {
  key: string;
  date: string;
  antes: PatientMediaItem[];
  depois: PatientMediaItem[];
}

function groupByDay(items: PatientMediaItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const day = item.created_at.slice(0, 10);
    const key = item.schedule_id || day;
    if (!groups.has(key)) groups.set(key, { key, date: day, antes: [], depois: [] });
    groups.get(key)![item.kind].push(item);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function Thumb({ path, onClick }: { path: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getSignedMediaUrl(path).then(setUrl).catch(() => {});
  }, [path]);

  if (!url) return <div className="empty-state" style={{ width: 100, height: 100 }} />;
  return <img src={url} onClick={onClick} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, cursor: "pointer" }} />;
}

export function PhotoCompare({ items, onDelete }: { items: PatientMediaItem[]; onDelete?: (id: string) => void }) {
  const [compareGroup, setCompareGroup] = useState<Group | null>(null);
  const groups = groupByDay(items);

  if (groups.length === 0) return <div className="empty-state">Nenhuma foto adicionada ainda.</div>;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {groups.map((g) => (
          <div key={g.key} className="card">
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>{new Date(`${g.date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>Antes</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.antes.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>—</div>}
                  {g.antes.map((m) => (
                    <Thumb key={m.id} path={m.storage_path} onClick={() => setCompareGroup(g)} />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>Depois</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.depois.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>—</div>}
                  {g.depois.map((m) => (
                    <Thumb key={m.id} path={m.storage_path} onClick={() => setCompareGroup(g)} />
                  ))}
                </div>
              </div>
            </div>
            {(g.antes.length > 0 || g.depois.length > 0) && (
              <button className="btn btn-secondary" style={{ marginTop: 12, height: 32, fontSize: 12 }} onClick={() => setCompareGroup(g)}>
                Comparar lado a lado
              </button>
            )}
          </div>
        ))}
      </div>

      {compareGroup && (
        <div className="modal-overlay" onClick={() => setCompareGroup(null)}>
          <div className="modal-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{new Date(`${compareGroup.date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
              <button className="mobile-icon-btn" onClick={() => setCompareGroup(null)}>
                <XIcon />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Antes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {compareGroup.antes.map((m) => (
                    <FullImage key={m.id} path={m.storage_path} onDelete={onDelete ? () => onDelete(m.id) : undefined} />
                  ))}
                  {compareGroup.antes.length === 0 && <div className="empty-state">Sem foto</div>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Depois</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {compareGroup.depois.map((m) => (
                    <FullImage key={m.id} path={m.storage_path} onDelete={onDelete ? () => onDelete(m.id) : undefined} />
                  ))}
                  {compareGroup.depois.length === 0 && <div className="empty-state">Sem foto</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullImage({ path, onDelete }: { path: string; onDelete?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getSignedMediaUrl(path).then(setUrl).catch(() => {});
  }, [path]);

  return (
    <div style={{ position: "relative" }}>
      {url ? <img src={url} style={{ width: "100%", borderRadius: 10 }} /> : <div className="empty-state" style={{ height: 140 }} />}
      {onDelete && (
        <button className="btn-danger" style={{ position: "absolute", top: 6, right: 6, height: 28, padding: "0 10px", fontSize: 11 }} onClick={onDelete}>
          Excluir
        </button>
      )}
    </div>
  );
}
