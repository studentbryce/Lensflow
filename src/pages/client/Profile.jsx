import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./Profile.css";

export default function ClientProfile() {
  const navigate = useNavigate();
  const { client_id } = useParams();

  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (client_id) {
      fetchClient();
    }
  }, [client_id]);

  async function fetchClient() {
    setLoading(true);
    setError("");

    try {
      /*
       * Get authenticated photographer.
       *
       * RLS remains the final security boundary.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error(
          "You must be logged in to view this client."
        );
      }

      /*
       * Retrieve the client record.
       */
      const { data: clientData, error: clientError } =
        await supabase
          .from("clients")
          .select(`
            client_id,
            photographer_id,
            user_id,
            notes,
            created_at
          `)
          .eq("client_id", client_id)
          .single();

      if (clientError) throw clientError;

      if (!clientData) {
        throw new Error("Client could not be found.");
      }

      /*
       * Retrieve the client's profile.
       */
      let profile = null;

      if (clientData.user_id) {
        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select(`
              user_id,
              first_name,
              last_name,
              email,
              phone,
              avatar_url
            `)
            .eq("user_id", clientData.user_id)
            .single();

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        profile = profileData || null;
      }

      /*
       * Retrieve all bookings belonging to this client.
       *
       * RLS ensures the photographer can only access
       * bookings they are authorised to view.
       */
      const { data: bookingData, error: bookingsError } =
        await supabase
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
          .eq("client_id", client_id)
          .order("booking_date", {
            ascending: false,
          });

      if (bookingsError) throw bookingsError;

      setClient({
        ...clientData,
        profile,
      });

      setBookings(bookingData || []);
    } catch (err) {
      console.error(
        "Error loading client profile:",
        err
      );

      setError(
        err.message ||
          "Unable to load client profile."
      );
    } finally {
      setLoading(false);
    }
  }

  function getClientName() {
    const profile = client?.profile;

    if (!profile) {
      return "Unknown Client";
    }

    return (
      `${profile.first_name || ""} ${
        profile.last_name || ""
      }`.trim() || "Unknown Client"
    );
  }

  function getInitials() {
    const profile = client?.profile;

    if (!profile) {
      return "?";
    }

    const first =
      profile.first_name?.charAt(0) || "";

    const last =
      profile.last_name?.charAt(0) || "";

    return (
      `${first}${last}`.toUpperCase() || "?"
    );
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "—";
    }

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

  function getBookingStatus(status) {
    if (!status) {
      return "Unknown";
    }

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
  }

  function isUpcoming(booking) {
    if (!booking?.booking_date) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingDate = new Date(
      `${booking.booking_date}T00:00:00`
    );

    return bookingDate >= today;
  }

  const statistics = useMemo(() => {
    const totalBookings = bookings.length;

    const completedBookings = bookings.filter(
      (booking) =>
        booking.status?.toLowerCase() === "completed"
    ).length;

    const upcomingBookings = bookings.filter(
      (booking) => isUpcoming(booking)
    ).length;

    const totalValue = bookings.reduce(
      (total, booking) =>
        total + Number(booking.total_amount || 0),
      0
    );

    return {
      totalBookings,
      completedBookings,
      upcomingBookings,
      totalValue,
    };
  }, [bookings]);

  if (loading) {
    return (
      <div className="client-profile-page">
        <div className="client-profile-state">
          <p>Loading client profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-profile-page">
        <div className="client-profile-state error-state">
          <h2>Unable to load client</h2>

          <p>{error}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              navigate("/photographer/clients")
            }
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const profile = client.profile;

  return (
    <div className="client-profile-page">

      {/* =====================================================
          Back Navigation
      ===================================================== */}

      <button
        type="button"
        className="back-to-clients"
        onClick={() =>
          navigate("/photographer/clients")
        }
      >
        <span>←</span>
        Back to Clients
      </button>

      {/* =====================================================
          Client Header
      ===================================================== */}

      <header className="client-profile-header">

        <div className="client-profile-identity">

          <div className="client-profile-avatar">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={getClientName()}
              />
            ) : (
              getInitials()
            )}
          </div>

          <div className="client-profile-name">

            <p className="page-eyebrow">
              Client Profile
            </p>

            <h1>{getClientName()}</h1>

            <div className="client-contact">

              {profile?.email && (
                <a
                  href={`mailto:${profile.email}`}
                >
                  {profile.email}
                </a>
              )}

              {profile?.phone && (
                <a
                  href={`tel:${profile.phone}`}
                >
                  {profile.phone}
                </a>
              )}

            </div>

          </div>

        </div>

        <div className="client-profile-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              navigate(
                `/photographer/clients/${client_id}/edit`
              )
            }
          >
            Edit Client
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              navigate(
                `/photographer/bookings/new?client=${client_id}`
              )
            }
          >
            New Booking
          </button>

        </div>

      </header>

      {/* =====================================================
          Overview
      ===================================================== */}

      <section className="client-overview">

        <div className="overview-card">

          <span>Total Bookings</span>

          <strong>
            {statistics.totalBookings}
          </strong>

        </div>

        <div className="overview-card">

          <span>Completed</span>

          <strong>
            {statistics.completedBookings}
          </strong>

        </div>

        <div className="overview-card">

          <span>Upcoming</span>

          <strong>
            {statistics.upcomingBookings}
          </strong>

        </div>

        <div className="overview-card">

          <span>Total Value</span>

          <strong>
            {formatCurrency(
              statistics.totalValue
            )}
          </strong>

        </div>

      </section>

      {/* =====================================================
          Client Details
      ===================================================== */}

      <section className="profile-section">

        <div className="section-heading">
          <div>
            <p className="section-eyebrow">
              Information
            </p>

            <h2>Client Details</h2>
          </div>
        </div>

        <div className="client-details">

          <div className="detail-item">
            <span>First Name</span>
            <strong>
              {profile?.first_name || "—"}
            </strong>
          </div>

          <div className="detail-item">
            <span>Last Name</span>
            <strong>
              {profile?.last_name || "—"}
            </strong>
          </div>

          <div className="detail-item">
            <span>Email</span>
            <strong>
              {profile?.email || "—"}
            </strong>
          </div>

          <div className="detail-item">
            <span>Phone</span>
            <strong>
              {profile?.phone || "—"}
            </strong>
          </div>

        </div>

      </section>

      {/* =====================================================
          Bookings
      ===================================================== */}

      <section className="profile-section">

        <div className="section-heading">

          <div>
            <p className="section-eyebrow">
              History
            </p>

            <h2>Bookings</h2>
          </div>

          <span className="section-count">
            {bookings.length}{" "}
            {bookings.length === 1
              ? "Booking"
              : "Bookings"}
          </span>

        </div>

        {bookings.length === 0 ? (
          <div className="profile-empty">
            <span className="profile-empty-icon">
              ◇
            </span>

            <h3>No bookings yet</h3>

            <p>
              This client does not have any
              bookings yet.
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                navigate(
                  `/photographer/bookings/new?client=${client_id}`
                )
              }
            >
              Create Booking
            </button>
          </div>
        ) : (
          <div className="booking-table">

            <div className="booking-table-header">
              <span>Date</span>
              <span>Service</span>
              <span>Status</span>
              <span>Amount</span>
            </div>

            {bookings.map((booking) => (
              <button
                type="button"
                className="booking-row"
                key={booking.booking_id}
                onClick={() =>
                  navigate(
                    `/photographer/bookings/${booking.booking_id}`
                  )
                }
              >

                <span className="booking-date">
                  {formatDate(
                    booking.booking_date
                  )}
                </span>

                <span className="booking-service">
                  {booking.services?.name ||
                    "Photography Session"}
                </span>

                <span>
                  <span
                    className={`booking-status status-${booking.status?.toLowerCase() || "unknown"}`}
                  >
                    {getBookingStatus(
                      booking.status
                    )}
                  </span>
                </span>

                <span className="booking-amount">
                  {formatCurrency(
                    booking.total_amount
                  )}
                </span>

                <span className="booking-arrow">
                  →
                </span>

              </button>
            ))}

          </div>
        )}

      </section>

      {/* =====================================================
          Notes
      ===================================================== */}

      <section className="profile-section">

        <div className="section-heading">
          <div>
            <p className="section-eyebrow">
              Private
            </p>

            <h2>Client Notes</h2>
          </div>
        </div>

        <div className="client-notes">

          {client.notes ? (
            <p>{client.notes}</p>
          ) : (
            <p className="no-notes">
              No notes have been added for this
              client.
            </p>
          )}

        </div>

      </section>

    </div>
  );
}