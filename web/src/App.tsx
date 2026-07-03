import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppointmentModalProvider } from "./context/AppointmentModalContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Agenda } from "./pages/Agenda";
import { Configuracoes } from "./pages/Configuracoes";
import { Conversas } from "./pages/Conversas";
import { Dashboard } from "./pages/Dashboard";
import { Estoque } from "./pages/Estoque";
import { Financeiro } from "./pages/Financeiro";
import { Login } from "./pages/Login";
import { Pacientes } from "./pages/Pacientes";
import { Procedimentos } from "./pages/Procedimentos";
import { Usuarios } from "./pages/Usuarios";
import { WhatsApp } from "./pages/WhatsApp";

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
                <Route path="/conversas" element={<Conversas />} />
                <Route path="/procedimentos" element={<Procedimentos />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/whatsapp" element={<WhatsApp />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
