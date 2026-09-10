import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, RequireRole } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";

import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";

import { AdminLayout } from "./routes/admin/AdminLayout";
import { PendingApprovals } from "./routes/admin/PendingApprovals";
import { Dashboard } from "./routes/admin/Dashboard";
import { Materials } from "./routes/admin/Materials";
import { ClassPeriods } from "./routes/admin/ClassPeriods";

import { ProfessorLayout } from "./routes/professor/ProfessorLayout";
import { Materials as ProfessorMaterials } from "./routes/professor/Materials";
import { Calendar } from "./routes/professor/Calendar";
import { MyReservations } from "./routes/professor/MyReservations";
import { Account } from "./routes/professor/Account";

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
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
              <Route index element={<ProfessorMaterials />} />
              <Route path="calendario/:materialId" element={<Calendar />} />
              <Route path="reservas" element={<MyReservations />} />
              <Route path="conta" element={<Account />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
