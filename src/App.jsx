import { useState, useEffect } from "react";
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
import SubjectsPage from "./pages/SubjectsPage";
import FacultyPage from "./pages/FacultyPage";
import AlgorithmPage from "./pages/AlgorithmPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import UserGuidePage from "./pages/Userguidepage";
import OnboardingTour from "./components/onboarding/OnboardingTour";
import { useAuth } from "./context/AuthContext";

// Inner wrapper so we can access AuthContext for the tour
function AppRoutes() {
  const { currentUser } = useAuth();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const key = `tour_done_${currentUser.id ?? "guest"}`;
    const done = localStorage.getItem(key);
    if (!done) setShowTour(true);
  }, [currentUser]);

  const handleTourDone = () => {
    if (currentUser) {
      const key = `tour_done_${currentUser.id ?? "guest"}`;
      localStorage.setItem(key, "true");
    }
    setShowTour(false);
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/conflicts" element={<ConflictsPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/faculty" element={<FacultyPage />} />
              <Route path="/algorithm" element={<AlgorithmPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/users" element={<UserManagementPage />} />
            </Route>
            <Route path="/user-guide" element={<UserGuidePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showTour && currentUser && <OnboardingTour onDone={handleTourDone} />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <ConflictProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </ConflictProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
