import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./Clients.css";

export default function Clients() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You must be logged in to view your clients.");
      }

      /*
       * RLS determines which client records this photographer
       * is allowed to access.
       *
       * The client relationship gives us the user's ID,
       * while the profile contains the customer's contact details.
       */
      const { data: clientData, error: clientsError } = await supabase
        .from("clients")
        .select(`
          client_id,
          photographer_id,
          user_id,
          notes,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      const userIds = [
        ...new Set(
          (clientData || [])
            .map((client) => client.user_id)
            .filter(Boolean)
        ),
      ];

      let profileMap = {};

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          `)
          .in("user_id", userIds);

        if (profilesError) throw profilesError;

        profileMap = Object.fromEntries(
          (profiles || []).map((profile) => [
            profile.user_id,
            profile,
          ])
        );
      }

      /*
       * Retrieve bookings belonging to these clients.
       *
       * RLS ensures that only bookings belonging to the
       * authenticated photographer are returned.
       */
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          booking_id,
          client_id,
          booking_date,
          status,
          total_amount,
          services (
            name
          )
        `)
        .order("booking_date", { ascending: false });

      if (bookingsError) throw bookingsError;

      const bookingMap = {};

      (bookings || []).forEach((booking) => {
        if (!bookingMap[booking.client_id]) {
          bookingMap[booking.client_id] = [];
        }

        bookingMap[booking.client_id].push(booking);
      });

      const formattedClients = (clientData || []).map((client) => {
        const profile = profileMap[client.user_id];
        const clientBookings = bookingMap[client.client_id] || [];

        return {
          ...client,
          profile,
          bookings: clientBookings,
          bookingCount: clientBookings.length,
          latestBooking: clientBookings[0] || null,
        };
      });

      setClients(formattedClients);
    } catch (err) {
      console.error("Error loading clients:", err);
      setError(err.message || "Unable to load clients.");
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return clients;
    }

    return clients.filter((client) => {
      const profile = client.profile;

      const name =
        `${profile?.first_name || ""} ${profile?.last_name || ""}`
          .trim()
          .toLowerCase();

      const email = (profile?.email || "").toLowerCase();
      const phone = (profile?.phone || "").toLowerCase();

      return (
        name.includes(search) ||
        email.includes(search) ||
        phone.includes(search)
      );
    });
  }, [clients, searchTerm]);

  function getClientName(client) {
    const profile = client.profile;

    if (!profile) {
      return "Unknown Client";
    }

    return (
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      "Unknown Client"
    );
  }

  function getInitials(client) {
    const profile = client.profile;

    if (!profile) {
      return "?";
    }

    const first = profile.first_name?.charAt(0) || "";
    const last = profile.last_name?.charAt(0) || "";

    return `${first}${last}`.toUpperCase() || "?";
  }

  function formatDate(dateString) {
    if (!dateString) return "—";

    return new Date(
      `${dateString}T00:00:00`
    ).toLocaleDateString("en-NZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount || 0);
  }

  return (
    <div className="clients-page">

      {/* =========================
          Header
      ========================= */}

      <header className="clients-header">
        <div>
          <p className="page-eyebrow">LensFlow</p>

          <h1>Clients</h1>

          <p className="page-description">
            Manage your photography clients and view their booking history.
          </p>
        </div>

        <div className="clients-summary">
          <span>{clients.length}</span>
          <small>
            {clients.length === 1 ? "Client" : "Clients"}
          </small>
        </div>
      </header>

      {/* =========================
          Search
      ========================= */}

      {!loading && !error && clients.length > 0 && (
        <div className="clients-toolbar">

          <div className="client-search">
            <span className="search-icon">⌕</span>

            <input
              type="search"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </div>

          <span className="results-count">
            {filteredClients.length}{" "}
            {filteredClients.length === 1
              ? "client"
              : "clients"}
          </span>

        </div>
      )}

      {/* =========================
          Loading
      ========================= */}

      {loading && (
        <div className="clients-state">
          <p>Loading clients...</p>
        </div>
      )}

      {/* =========================
          Error
      ========================= */}

      {!loading && error && (
        <div className="clients-state error-state">
          <h2>Unable to load clients</h2>

          <p>{error}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={fetchClients}
          >
            Try Again
          </button>
        </div>
      )}

      {/* =========================
          No Clients
      ========================= */}

      {!loading &&
        !error &&
        clients.length === 0 && (
          <div className="clients-state empty-state">
            <div className="empty-icon">◇</div>

            <h2>No clients yet</h2>

            <p>
              Your clients will appear here once you have
              created your first booking.
            </p>
          </div>
        )}

      {/* =========================
          No Search Results
      ========================= */}

      {!loading &&
        !error &&
        clients.length > 0 &&
        filteredClients.length === 0 && (
          <div className="clients-state empty-state">
            <div className="empty-icon">⌕</div>

            <h2>No clients found</h2>

            <p>
              No clients match "{searchTerm}".
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearchTerm("")}
            >
              Clear Search
            </button>
          </div>
        )}

      {/* =========================
          Client List
      ========================= */}

      {!loading &&
        !error &&
        filteredClients.length > 0 && (
          <section className="clients-section">

            <div className="clients-list">

              {filteredClients.map((client) => {
                const profile = client.profile;
                const latestBooking = client.latestBooking;

                return (
                  <article
                    className="client-card"
                    key={client.client_id}
                  >

                    {/* Client identity */}

                    <div className="client-identity">

                      <div className="client-avatar">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={getClientName(client)}
                          />
                        ) : (
                          getInitials(client)
                        )}
                      </div>

                      <div className="client-name-block">
                        <h2>
                          {getClientName(client)}
                        </h2>

                        {profile?.email && (
                          <a
                            href={`mailto:${profile.email}`}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            {profile.email}
                          </a>
                        )}

                        {profile?.phone && (
                          <a
                            href={`tel:${profile.phone}`}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                          >
                            {profile.phone}
                          </a>
                        )}
                      </div>

                    </div>

                    {/* Booking information */}

                    <div className="client-booking-summary">

                      <div className="client-stat">
                        <span>Bookings</span>

                        <strong>
                          {client.bookingCount}
                        </strong>
                      </div>

                      <div className="client-stat">
                        <span>Last Booking</span>

                        <strong>
                          {latestBooking
                            ? formatDate(
                                latestBooking.booking_date
                              )
                            : "—"}
                        </strong>
                      </div>

                      <div className="client-stat">
                        <span>Latest Service</span>

                        <strong>
                          {latestBooking?.services?.name ||
                            "—"}
                        </strong>
                      </div>

                      <div className="client-stat">
                        <span>Latest Value</span>

                        <strong>
                          {latestBooking
                            ? formatCurrency(
                                latestBooking.total_amount
                              )
                            : "—"}
                        </strong>
                      </div>

                    </div>

                    {/* Action */}

                    <button
                      type="button"
                      className="client-view-button"
                      onClick={() =>
                        navigate(
                          `/photographer/clients/${client.client_id}`
                        )
                      }
                    >
                      View Client
                      <span>→</span>
                    </button>

                  </article>
                );
              })}

            </div>

          </section>
        )}

    </div>
  );
}