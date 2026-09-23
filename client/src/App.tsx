import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./layout/AppShell";
import { Spinner } from "./ui";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { People } from "./pages/People";
import { PersonProfile } from "./pages/PersonProfile";
import { Actions } from "./pages/Actions";
import { Policies } from "./pages/Policies";
import { Credentials } from "./pages/Credentials";
import { Leave } from "./pages/Leave";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";

export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!me) return <Login />;

  // No active client (DreamStoneHR portfolio, or a client user who must pick a
  // workspace): only the Home dispatcher is valid — client-scoped routes would
  // otherwise fail server authorisation with "No active client selected".
  if (!me.activeClient) {
    return (
      <AppShell>
        <Routes>
          <Route path="*" element={<Home />} />
        </Routes>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/people" element={<People />} />
        <Route path="/people/:id" element={<PersonProfile />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
