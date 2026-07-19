import { StaffRole } from "../context/AuthContext";

/**
 * Quais perfis podem ver cada pagina na navegacao do CRM. A garantia real de
 * seguranca esta no backend (middleware requireAdmin/requireRole em cada
 * rota) - isso aqui e so para nao mostrar, na navegacao, links que um perfil
 * sem permissao so encontraria um erro 403 ao clicar.
 */
const PAGE_ROLES: Record<string, StaffRole[]> = {
  "/": ["admin"],
  "/agenda": ["admin", "recepcionista", "profissional"],
  "/pacientes": ["admin", "recepcionista", "profissional"],
  "/conversas": ["admin", "recepcionista"],
  "/procedimentos": ["admin"],
  "/financeiro": ["admin"],
  "/estoque": ["admin"],
  "/usuarios": ["admin"],
  "/horarios-clinica": ["admin"],
  "/oportunidades": ["admin"],
  "/secretaria-virtual": ["admin"],
};

export function canAccessPage(role: StaffRole | undefined, path: string): boolean {
  if (!role) return false;
  const allowed = PAGE_ROLES[path];
  return !allowed || allowed.includes(role);
}
