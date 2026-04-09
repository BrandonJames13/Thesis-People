import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { ConflictProvider } from "./context/ConflictContext";
import { NotificationProvider } from "./context/NotificationContext";

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./components/auth/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SchedulePage from "./pages/SchedulePage";
import ConflictsPage from "./pages/ConflictsPage";
import RoomsPage from "./pages/RoomsPage";
import CoursesPage from "./pages/CoursesPage";
import FacultyPage from "./pages/FacultyPage";
import AlgorithmPage from "./pages/AlgorithmPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UserManagementPage from "./pages/UserManagementPage";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <ConflictProvider>
              <NotificationProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/schedule" element={<SchedulePage />} />
                      <Route element={<ProtectedRoute adminOnly />}>
                        <Route path="/conflicts" element={<ConflictsPage />} />
                        <Route path="/rooms" element={<RoomsPage />} />
                        <Route path="/subjects" element={<CoursesPage />} />
                        <Route path="/faculty" element={<FacultyPage />} />
                        <Route path="/algorithm" element={<AlgorithmPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/users" element={<UserManagementPage />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </NotificationProvider>
            </ConflictProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
