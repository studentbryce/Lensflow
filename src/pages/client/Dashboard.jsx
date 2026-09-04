import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import StatCard from "../../components/dashboard/StatCard";
import "./Dashboard.css";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);

  const [stats, setStats] = useState({
    bookings: 0,
    upcomingBookings: 0,
    outstanding: 0,
    galleries: 0,
  });

  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [recentGalleries, setRecentGalleries] = useState([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      // -------------------------------------------------------
      // 1. Get currently authenticated user
      // -------------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error("No authenticated user found.");
      }

      // -------------------------------------------------------
      // 2. Get client profile
      // -------------------------------------------------------

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select(`
          client_id,
          photographer_id,
          user_id,
          profiles (
            first_name,
            last_name
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (clientError) {
        throw clientError;
      }

      if (!client) {
        throw new Error("Client profile could not be found.");
      }

      const clientId = client.client_id;

      const clientProfile = client.profiles;

      setProfile({
        first_name: clientProfile?.first_name || "",
        last_name: clientProfile?.last_name || "",
      });

      // -------------------------------------------------------
      // 3. Get all bookings for this client
      // -------------------------------------------------------

      const {
        data: allBookings,
        error: allBookingsError,
      } = await supabase
        .from("bookings")
        .select(`
          booking_id,
          booking_date,
          start_time,
          end_time,
          status,
          total_amount,

          services (
            service_id,
            name
          )
        `)
        .eq("client_id", clientId)
        .order("booking_date", { ascending: false });

      if (allBookingsError) {
        throw allBookingsError;
      }

      const bookings = allBookings || [];

      // -------------------------------------------------------
      // 4. Get upcoming bookings
      // -------------------------------------------------------

      const today = new Date().toISOString().split("T")[0];

      const upcoming = bookings
        .filter(
          (booking) =>
            booking.booking_date >= today &&
            ["pending", "confirmed"].includes(booking.status)
        )
        .sort((a, b) => {
          const dateA = `${a.booking_date}T${a.start_time || "00:00:00"}`;
          const dateB = `${b.booking_date}T${b.start_time || "00:00:00"}`;

          return new Date(dateA) - new Date(dateB);
        })
        .slice(0, 5);

      setUpcomingBookings(upcoming);

      // -------------------------------------------------------
      // 5. Get client's invoices
      // -------------------------------------------------------

      const {
        data: invoices,
        error: invoicesError,
      } = await supabase
        .from("invoices")
        .select(`
          invoice_id,
          invoice_number,
          issue_date,
          due_date,
          total_amount,
          status
        `)
        .eq("client_id", clientId)
        .order("due_date", { ascending: true });

      if (invoicesError) {
        throw invoicesError;
      }

      const clientInvoices = invoices || [];

      const unpaidInvoices = clientInvoices.filter((invoice) =>
        ["sent", "overdue"].includes(invoice.status)
      );

      const outstandingTotal = unpaidInvoices.reduce(
        (total, invoice) =>
          total + Number(invoice.total_amount || 0),
        0
      );

      setOutstandingInvoices(unpaidInvoices.slice(0, 5));

      // -------------------------------------------------------
      // 6. Get published galleries available to client
      // -------------------------------------------------------

      const {
        data: galleries,
        error: galleriesError,
      } = await supabase
        .from("galleries")
        .select(`
          gallery_id,
          name,
          description,
          is_published,
          allow_downloads,
          created_at
        `)
        .eq("client_id", clientId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (galleriesError) {
        throw galleriesError;
      }

      const clientGalleries = galleries || [];

      setRecentGalleries(clientGalleries.slice(0, 4));

      // -------------------------------------------------------
      // 7. Update dashboard statistics
      // -------------------------------------------------------

      setStats({
        bookings: bookings.length,
        upcomingBookings: upcoming.length,
        outstanding: outstandingTotal,
        galleries: clientGalleries.length,
      });
    } catch (err) {
      console.error("Client dashboard error:", err);

      setError(
        err.message || "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          Loading your dashboard...
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Error state
  // -----------------------------------------------------------

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------

  const firstName = profile?.first_name || "there";

  return (
    <div className="dashboard-page">

      {/* -----------------------------------------------------
          Welcome Header
      ----------------------------------------------------- */}

      <section className="client-welcome">

        <div>
          <span className="eyebrow">
            Welcome back
          </span>

          <h1>
            Hello, {firstName}
          </h1>

          <p>
            Here is an overview of your photography sessions,
            galleries and invoices.
          </p>
        </div>

      </section>

      {/* -----------------------------------------------------
          Statistics
      ----------------------------------------------------- */}

      <section className="dashboard-stats">

        <StatCard
          title="Upcoming Bookings"
          value={stats.upcomingBookings}
          description="Scheduled sessions"
        />

        <StatCard
          title="Total Bookings"
          value={stats.bookings}
          description="Your photography sessions"
        />

        <StatCard
          title="Outstanding"
          value={`$${stats.outstanding.toFixed(2)}`}
          description="Unpaid invoices"
        />

        <StatCard
          title="Galleries"
          value={stats.galleries}
          description="Published galleries"
        />

      </section>

      {/* -----------------------------------------------------
          Upcoming Bookings
      ----------------------------------------------------- */}

      <section className="dashboard-section">

        <div className="section-heading">

          <div>
            <span className="eyebrow">
              Your schedule
            </span>

            <h2>
              Upcoming Bookings
            </h2>
          </div>

        </div>

        {upcomingBookings.length === 0 ? (

          <div className="empty-state">
            <h3>No upcoming bookings</h3>

            <p>
              You don't currently have any upcoming
              photography sessions.
            </p>
          </div>

        ) : (

          <div className="booking-list">

            {upcomingBookings.map((booking) => (

              <div
                className="booking-row"
                key={booking.booking_id}
              >

                <div className="booking-date">

                  <strong>
                    {new Date(
                      `${booking.booking_date}T00:00:00`
                    ).toLocaleDateString(
                      "en-NZ",
                      {
                        day: "2-digit",
                        month: "short",
                      }
                    )}
                  </strong>

                  <span>
                    {booking.start_time?.slice(0, 5)}
                  </span>

                </div>

                <div className="booking-client">

                  <strong>
                    {booking.services?.name ||
                      "Photography Session"}
                  </strong>

                  <span>
                    {booking.end_time
                      ? `${booking.start_time?.slice(
                          0,
                          5
                        )} – ${booking.end_time.slice(
                          0,
                          5
                        )}`
                      : "Scheduled session"}
                  </span>

                </div>

                <div className="booking-status">

                  <span
                    className={`status status-${booking.status}`}
                  >
                    {booking.status}
                  </span>

                </div>

                <div className="booking-amount">

                  $
                  {Number(
                    booking.total_amount || 0
                  ).toFixed(2)}

                </div>

              </div>

            ))}

          </div>

        )}

      </section>

      {/* -----------------------------------------------------
          Lower Dashboard Content
      ----------------------------------------------------- */}

      <div className="client-dashboard-grid">

        {/* ---------------------------------------------------
            Recent Galleries
        --------------------------------------------------- */}

        <section className="dashboard-section client-dashboard-card">

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                Your photos
              </span>

              <h2>
                Recent Galleries
              </h2>
            </div>

          </div>

          {recentGalleries.length === 0 ? (

            <div className="empty-state">
              <h3>No galleries yet</h3>

              <p>
                Your photographer has not published any
                galleries for you yet.
              </p>
            </div>

          ) : (

            <div className="client-gallery-list">

              {recentGalleries.map((gallery) => (

                <div
                  className="client-gallery-row"
                  key={gallery.gallery_id}
                >

                  <div className="client-gallery-icon">
                    <span>✦</span>
                  </div>

                  <div className="client-gallery-info">

                    <strong>
                      {gallery.name}
                    </strong>

                    <span>
                      {gallery.description ||
                        "Photography gallery"}
                    </span>

                  </div>

                  <div className="gallery-access">
                    <span className="status status-confirmed">
                      Available
                    </span>
                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

        {/* ---------------------------------------------------
            Outstanding Invoices
        --------------------------------------------------- */}

        <section className="dashboard-section client-dashboard-card">

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                Payments
              </span>

              <h2>
                Outstanding Invoices
              </h2>
            </div>

          </div>

          {outstandingInvoices.length === 0 ? (

            <div className="empty-state">
              <h3>You're all caught up</h3>

              <p>
                You don't have any outstanding invoices.
              </p>
            </div>

          ) : (

            <div className="invoice-list">

              {outstandingInvoices.map((invoice) => (

                <div
                  className="invoice-row"
                  key={invoice.invoice_id}
                >

                  <div className="invoice-info">

                    <strong>
                      {invoice.invoice_number ||
                        "Invoice"}
                    </strong>

                    <span>
                      Due{" "}
                      {invoice.due_date
                        ? new Date(
                            `${invoice.due_date}T00:00:00`
                          ).toLocaleDateString(
                            "en-NZ",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "Date unavailable"}
                    </span>

                  </div>

                  <div className="invoice-amount">

                    <strong>
                      $
                      {Number(
                        invoice.total_amount || 0
                      ).toFixed(2)}
                    </strong>

                    <span
                      className={`status status-${invoice.status}`}
                    >
                      {invoice.status}
                    </span>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

      </div>

    </div>
  );
}