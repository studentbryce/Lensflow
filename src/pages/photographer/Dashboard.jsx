import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import StatCard from "../../components/dashboard/StatCard";
import "./Dashboard.css";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    bookings: 0,
    clients: 0,
    outstanding: 0,
    galleries: 0,
  });

  const [upcomingBookings, setUpcomingBookings] = useState([]);

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
      // 2. Get photographer profile
      // -------------------------------------------------------

      const { data: photographer, error: profileError } =
        await supabase
          .from("photographer_profiles")
          .select(`
            photographer_id,
            business_name,
            slug,
            profile_image_url
          `)
          .eq("user_id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(photographer);

      const photographerId = photographer.photographer_id;

      // -------------------------------------------------------
      // 3. Get upcoming bookings
      // -------------------------------------------------------

      const today = new Date().toISOString().split("T")[0];

      const {
        data: bookings,
        error: bookingsError,
      } = await supabase
        .from("bookings")
        .select(`
          booking_id,
          booking_date,
          start_time,
          end_time,
          status,
          total_amount,

          clients (
            client_id,
            user_id,
            profiles (
              first_name,
              last_name
            )
          ),

          services (
            service_id,
            name
          )
        `)
        .eq("photographer_id", photographerId)
        .gte("booking_date", today)
        .in("status", ["pending", "confirmed"])
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5);

      if (bookingsError) {
        throw bookingsError;
      }

      setUpcomingBookings(bookings || []);

      // -------------------------------------------------------
      // 4. Count clients
      // -------------------------------------------------------

      const {
        count: clientCount,
        error: clientsError,
      } = await supabase
        .from("clients")
        .select("client_id", {
          count: "exact",
          head: true,
        })
        .eq("photographer_id", photographerId);

      if (clientsError) {
        throw clientsError;
      }

      // -------------------------------------------------------
      // 5. Get outstanding invoices
      // -------------------------------------------------------

      const {
        data: invoices,
        error: invoicesError,
      } = await supabase
        .from("invoices")
        .select("total_amount, status")
        .eq("photographer_id", photographerId)
        .in("status", ["draft", "sent", "overdue"]);

      if (invoicesError) {
        throw invoicesError;
      }

      const outstandingTotal = (invoices || []).reduce(
        (total, invoice) => total + Number(invoice.total_amount || 0),
        0
      );

      // -------------------------------------------------------
      // 6. Count published galleries
      // -------------------------------------------------------

      const {
        count: galleryCount,
        error: galleriesError,
      } = await supabase
        .from("galleries")
        .select("gallery_id", {
          count: "exact",
          head: true,
        })
        .eq("photographer_id", photographerId)
        .eq("is_published", true);

      if (galleriesError) {
        throw galleriesError;
      }

      // -------------------------------------------------------
      // 7. Update dashboard statistics
      // -------------------------------------------------------

      setStats({
        bookings: bookings?.length || 0,
        clients: clientCount || 0,
        outstanding: outstandingTotal,
        galleries: galleryCount || 0,
      });
    } catch (err) {
      console.error("Dashboard error:", err);

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

  return (
    <div className="dashboard-page">

      <DashboardHeader profile={profile} />

      <section className="dashboard-stats">

        <StatCard
          title="Upcoming Bookings"
          value={stats.bookings}
          description="Upcoming sessions"
        />

        <StatCard
          title="Clients"
          value={stats.clients}
          description="Active clients"
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

      <section className="dashboard-section">

        <div className="section-heading">
          <div>
            <span className="eyebrow">Your schedule</span>
            <h2>Upcoming Bookings</h2>
          </div>
        </div>

        {upcomingBookings.length === 0 ? (

          <div className="empty-state">
            <p>No upcoming bookings.</p>
          </div>

        ) : (

          <div className="booking-list">

            {upcomingBookings.map((booking) => {

              const client =
                booking.clients?.profiles;

              const clientName = client
                ? `${client.first_name} ${client.last_name}`
                : "Unknown Client";

              return (
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
                    <strong>{clientName}</strong>

                    <span>
                      {booking.services?.name ||
                        "Photography Session"}
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
                    ${Number(
                      booking.total_amount || 0
                    ).toFixed(2)}
                  </div>

                </div>
              );
            })}

          </div>

        )}

      </section>

    </div>
  );
}