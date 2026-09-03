import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./../context/AuthContext";

function PhotographerSidebar() {
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
    <aside className="sidebar photographer-sidebar">

      {/* Logo / Brand */}
      <div className="sidebar-brand">
        <h2>LensFlow</h2>
        <span>Photographer</span>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">

        <NavLink to="/photographer" className={navLinkClass}>
          Dashboard
        </NavLink>

        {/* Business */}
        <div className="sidebar-section">
          <p className="sidebar-heading">BUSINESS</p>

          <NavLink
            to="/photographer/calendar"
            className={navLinkClass}
          >
            Calendar
          </NavLink>

          <NavLink
            to="/photographer/bookings"
            className={navLinkClass}
          >
            Bookings
          </NavLink>

          <NavLink
            to="/photographer/clients"
            className={navLinkClass}
          >
            Clients
          </NavLink>

          <NavLink
            to="/photographer/services"
            className={navLinkClass}
          >
            Services
          </NavLink>

          <NavLink
            to="/photographer/invoices"
            className={navLinkClass}
          >
            Invoices
          </NavLink>
        </div>

        {/* Media */}
        <div className="sidebar-section">
          <p className="sidebar-heading">MEDIA</p>

          <NavLink
            to="/photographer/galleries"
            className={navLinkClass}
          >
            Galleries
          </NavLink>

          <NavLink
            to="/photographer/portfolio"
            className={navLinkClass}
          >
            Portfolio
          </NavLink>
        </div>

        {/* Website */}
        <div className="sidebar-section">
          <p className="sidebar-heading">WEBSITE</p>

          <NavLink
            to="/photographer/website"
            className={navLinkClass}
          >
            Website Builder
          </NavLink>
        </div>

        {/* Communication */}
        <div className="sidebar-section">
          <p className="sidebar-heading">COMMUNICATION</p>

          <NavLink
            to="/photographer/messages"
            className={navLinkClass}
          >
            Messages
          </NavLink>

          <NavLink
            to="/photographer/reviews"
            className={navLinkClass}
          >
            Reviews
          </NavLink>
        </div>

        {/* Settings */}
        <div className="sidebar-section">
          <p className="sidebar-heading">SETTINGS</p>

          <NavLink
            to="/photographer/settings"
            className={navLinkClass}
          >
            Settings
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

export default PhotographerSidebar;