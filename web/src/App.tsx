import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { Agenda } from "./pages/Agenda";
import { Conversas } from "./pages/Conversas";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Pacientes } from "./pages/Pacientes";
import { Procedimentos } from "./pages/Procedimentos";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/pacientes" element={<Pacientes />} />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/procedimentos" element={<Procedimentos />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
