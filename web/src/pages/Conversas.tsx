import { FormEvent, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { ArrowLeftIcon } from "../components/icons";

interface ConversationSummary {
  id: string;
  status: "ai" | "human" | "closed";
  userName: string;
  userPhone: string;
  lastMessage: string | null;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function Conversas() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadList() {
    try {
      const r = await api.get<{ items: ConversationSummary[] }>("/conversations?limit=50");
      setItems(r.items);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadConversation(id: string) {
    try {
      const r = await api.get<{ conversation: ConversationSummary; messages: MessageItem[] }>(`/conversations/${id}`);
      setConversation(r.conversation);
      setMessages(r.messages);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadList();
    const interval = setInterval(loadList, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadConversation(selectedId);
    const interval = setInterval(() => loadConversation(selectedId), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !input.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/conversations/${selectedId}/messages`, { content: input.trim() });
      setInput("");
      await loadConversation(selectedId);
      await loadList();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleToggleStatus() {
    if (!conversation) return;
    const newStatus = conversation.status === "human" ? "ai" : "human";
    await api.patch(`/conversations/${conversation.id}/status`, { status: newStatus });
    await loadConversation(conversation.id);
    await loadList();
  }

  async function handleClose() {
    if (!conversation) return;
    if (!window.confirm("Encerrar esta conversa? A IA não voltará a responder automaticamente até uma nova mensagem do paciente.")) return;
    await api.patch(`/conversations/${conversation.id}/status`, { status: "closed" });
    await loadConversation(conversation.id);
    await loadList();
  }

  function statusBadge(status: ConversationSummary["status"]) {
    const cls = status === "human" ? "badge-blue" : status === "closed" ? "badge-neutral" : "badge-green";
    const label = status === "human" ? "Humano" : status === "closed" ? "Encerrado" : "IA";
    return <span className={`badge ${cls}`}>{label}</span>;
  }

  const showList = !isMobile || !selectedId;
  const showThread = !isMobile || !!selectedId;
  const chatHeight = isMobile ? "calc(100dvh - 200px)" : "calc(100vh - 160px)";

  return (
    <div>
      {!isMobile && (
        <>
          <h1 className="page-title">Conversas</h1>
          <p className="page-subtitle">Atendimento em tempo real via WhatsApp</p>
        </>
      )}

      <div style={{ display: "flex", height: chatHeight, gap: 16 }}>
        {showList && (
          <div className="card" style={{ width: isMobile ? "100%" : 300, flex: isMobile ? 1 : "0 0 300px", padding: 0, overflowY: "auto" }}>
            {items === null && <div className="empty-state">Carregando...</div>}
            {items !== null && items.length === 0 && <div className="empty-state">Nenhuma conversa ainda.</div>}
            {items?.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: "14px",
                  borderBottom: "1px solid var(--border-soft)",
                  cursor: "pointer",
                  background: c.id === selectedId ? "var(--accent-bg)" : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.userName || c.userPhone}</span>
                  {statusBadge(c.status)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.lastMessage || "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {showThread && (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
            {!conversation && (
              <div className="empty-state" style={{ margin: "auto" }}>
                Selecione uma conversa
              </div>
            )}
            {conversation && (
              <>
                <div
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {isMobile && (
                      <button className="mobile-icon-btn" style={{ marginLeft: -8 }} onClick={() => setSelectedId(null)}>
                        <ArrowLeftIcon />
                      </button>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conversation.userName || conversation.userPhone}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{conversation.userPhone}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-secondary" onClick={handleToggleStatus}>
                      {conversation.status === "human" ? (isMobile ? "IA" : "Devolver para IA") : isMobile ? "Assumir" : "Assumir conversa"}
                    </button>
                    {conversation.status !== "closed" && !isMobile && (
                      <button className="btn-danger" style={{ borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600 }} onClick={handleClose}>
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        maxWidth: "78%",
                        alignSelf: m.role === "user" ? "flex-start" : "flex-end",
                        background: m.role === "user" ? "var(--surface)" : "var(--accent)",
                        color: m.role === "user" ? "var(--text)" : "#fff",
                        border: m.role === "user" ? "1px solid var(--border)" : "none",
                        borderRadius: 14,
                        padding: "8px 12px",
                        fontSize: 13.5,
                      }}
                    >
                      {m.content}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={handleSend} style={{ display: "flex", gap: 10, padding: 14, borderTop: "1px solid var(--border)" }}>
                  <input
                    className="input"
                    placeholder="Digite uma mensagem..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button className="btn" type="submit" disabled={sending || !input.trim()}>
                    Enviar
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-text" style={{ position: "fixed", bottom: 16, right: 16 }}>
          {error}
        </div>
      )}
    </div>
  );
}
