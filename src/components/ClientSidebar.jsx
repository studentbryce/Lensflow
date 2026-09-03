import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./../context/AuthContext";

function ClientSidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navLinkClass = ({ isActive }) =>
    `sidebar-link ${isActive ? "active" : ""}`;

  const handleLogout = async () => {
    try {
      await signOut();

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className="sidebar client-sidebar">

      {/* Logo / Brand */}
      <div className="sidebar-brand">
        <h2>LensFlow</h2>
        <span>Client</span>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">

        <NavLink to="/client" className={navLinkClass}>
          Dashboard
        </NavLink>

        {/* My Photographer */}
        <div className="sidebar-section">
          <p className="sidebar-heading">MY PHOTOGRAPHER</p>

          <NavLink to="/client/bookings" className={navLinkClass}>
            My Bookings
          </NavLink>

          <NavLink to="/client/galleries" className={navLinkClass}>
            My Galleries
          </NavLink>

          <NavLink to="/client/invoices" className={navLinkClass}>
            My Invoices
          </NavLink>

          <NavLink to="/client/messages" className={navLinkClass}>
            Messages
          </NavLink>
        </div>

        {/* Account */}
        <div className="sidebar-section">
          <p className="sidebar-heading">ACCOUNT</p>

          <NavLink to="/client/profile" className={navLinkClass}>
            My Profile
          </NavLink>
        </div>

      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-link logout-link"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

    </aside>
  );
}

export default ClientSidebar;