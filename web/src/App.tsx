import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppointmentModalProvider } from "./context/AppointmentModalContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Agenda } from "./pages/Agenda";
import { CampanhasReativacao } from "./pages/CampanhasReativacao";
import { Configuracoes } from "./pages/Configuracoes";
import { Conversas } from "./pages/Conversas";
import { Dashboard } from "./pages/Dashboard";
import { DadosClinica } from "./pages/DadosClinica";
import { Estoque } from "./pages/Estoque";
import { Financeiro } from "./pages/Financeiro";
import { HorariosClinica } from "./pages/HorariosClinica";
import { Login } from "./pages/Login";
import { Oportunidades } from "./pages/Oportunidades";
import { Pacientes } from "./pages/Pacientes";
import { PatientDetail } from "./pages/PatientDetail";
import { PosAtendimento } from "./pages/PosAtendimento";
import { Procedimentos } from "./pages/Procedimentos";
import { SecretariaVirtual } from "./pages/SecretariaVirtual";
import { Confirmacao } from "./pages/secretariaVirtual/Confirmacao";
import { Faq } from "./pages/secretariaVirtual/Faq";
import { OportunidadesConfig } from "./pages/secretariaVirtual/OportunidadesConfig";
import { Usuarios } from "./pages/Usuarios";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <AppointmentModalProvider>
                    <Layout />
                  </AppointmentModalProvider>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/pacientes" element={<Pacientes />} />
                <Route path="/pacientes/:id" element={<PatientDetail />} />
                <Route path="/conversas" element={<Conversas />} />
                <Route path="/procedimentos" element={<Procedimentos />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/horarios-clinica" element={<HorariosClinica />} />
                <Route path="/oportunidades" element={<Oportunidades />} />
                <Route path="/secretaria-virtual" element={<SecretariaVirtual />} />
                <Route path="/secretaria-virtual/confirmacao" element={<Confirmacao />} />
                <Route path="/secretaria-virtual/reativacao" element={<CampanhasReativacao />} />
                <Route path="/secretaria-virtual/pos-consulta" element={<PosAtendimento />} />
                <Route path="/secretaria-virtual/oportunidades" element={<OportunidadesConfig />} />
                <Route path="/secretaria-virtual/faq" element={<Faq />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/configuracoes/dados-clinica" element={<DadosClinica />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
