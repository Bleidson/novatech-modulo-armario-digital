import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, RequireRole } from "./lib/auth";

import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
import { Placeholder } from "./routes/Placeholder";

import { AdminLayout } from "./routes/admin/AdminLayout";
import { PendingApprovals } from "./routes/admin/PendingApprovals";
import { Dashboard } from "./routes/admin/Dashboard";
import { Materials } from "./routes/admin/Materials";
import { ClassPeriods } from "./routes/admin/ClassPeriods";

import { ProfessorLayout } from "./routes/professor/ProfessorLayout";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Signup />} />

            <Route
              path="/admin"
              element={
                <RequireRole roles={["ADMIN"]}>
                  <AdminLayout />
                </RequireRole>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="materiais" element={<Materials />} />
              <Route path="horarios" element={<ClassPeriods />} />
              <Route path="aprovacoes" element={<PendingApprovals />} />
            </Route>

            <Route
              path="/professor"
              element={
                <RequireRole roles={["PROFESSOR"]}>
                  <ProfessorLayout />
                </RequireRole>
              }
            >
              {/* Teammate C substitui os tres abaixo pelas paginas reais. */}
              <Route index element={<Placeholder title="Catalogo" />} />
              <Route path="reservas" element={<Placeholder title="Minhas reservas" />} />
              <Route path="conta" element={<Placeholder title="Conta" />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
