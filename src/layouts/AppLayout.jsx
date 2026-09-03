
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import PhotographerSidebar from "../components/PhotographerSidebar";
import ClientSidebar from "../components/ClientSidebar";

function AppLayout() {
  const { profile } = useAuth();

  return (
    <div className="app-layout">

      {/* Sidebar */}
      {profile?.role === "photographer" && (
        <PhotographerSidebar />
      )}

      {profile?.role === "client" && (
        <ClientSidebar />
      )}

      {/* Current route/page */}
      <main className="main-content">
        <Outlet />
      </main>

    </div>
  );
}

export default AppLayout;