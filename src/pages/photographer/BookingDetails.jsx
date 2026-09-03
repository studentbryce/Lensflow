import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./BookingDetails.css";

export default function BookingDetails() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [client, setClient] = useState(null);
  const [service, setService] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  async function fetchBooking() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You must be logged in.");
      }

      const { data, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          booking_id,
          photographer_id,
          client_id,
          service_id,
          booking_date,
          start_time,
          end_time,
          location,
          notes,
          status,
          total_amount,
          created_at,
          updated_at,
          clients (
            client_id,
            user_id,
            notes
          ),
          services (
            service_id,
            name,
            description,
            price,
            duration_minutes
          )
        `)
        .eq("booking_id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      setBooking(data);
      setService(data.services);

      /*
       * Retrieve the client profile using the user_id
       * associated with the LensFlow client record.
       */
      if (data.clients?.user_id) {
        const { data: profile, error: profileError } =
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
            .eq("user_id", data.clients.user_id)
            .single();

        if (profileError) throw profileError;

        setClient(profile);
      }
    } catch (err) {
      console.error("Error loading booking:", err);
      setError(err.message || "Unable to load booking.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBookingStatus(newStatus) {
    if (!booking) return;

    const confirmed = window.confirm(
      `Are you sure you want to mark this booking as ${newStatus}?`
    );

    if (!confirmed) return;

    setUpdating(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("bookings")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", booking.booking_id)
        .select()
        .single();

      if (updateError) throw updateError;

      setBooking((current) => ({
        ...current,
        ...data,
      }));
    } catch (err) {
      console.error("Error updating booking:", err);

      setError(
        err.message || "Unable to update booking status."
      );
    } finally {
      setUpdating(false);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "";

    return new Date(
      `${dateString}T00:00:00`
    ).toLocaleDateString("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatShortDate(dateString) {
    if (!dateString) return "";

    return new Date(
      `${dateString}T00:00:00`
    ).toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(timeString) {
    if (!timeString) return "";

    const [hours, minutes] = timeString.split(":");

    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount || 0);
  }

  function getClientName() {
    if (!client) return "Unknown Client";

    return `${client.first_name || ""} ${
      client.last_name || ""
    }`.trim() || "Unknown Client";
  }

  function getClientInitials() {
    if (!client) return "?";

    const first = client.first_name?.charAt(0) || "";
    const last = client.last_name?.charAt(0) || "";

    return `${first}${last}`.toUpperCase() || "?";
  }

  function getStatusClass() {
    return `booking-status booking-status-${booking.status}`;
  }

  function getStatusLabel(status) {
    if (!status) return "";

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getGoogleMapsUrl() {
    if (!booking?.location) return "#";

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      booking.location
    )}`;
  }

  function getBookingDuration() {
    if (!service?.duration_minutes) return null;

    return `${service.duration_minutes} minutes`;
  }

  function renderActions() {
    if (updating) {
      return (
        <div className="booking-actions">
          <span className="updating-message">
            Updating booking...
          </span>
        </div>
      );
    }

    switch (booking.status) {
      case "pending":
        return (
          <div className="booking-actions">
            <button
              className="action-button confirm-button"
              onClick={() =>
                updateBookingStatus("confirmed")
              }
            >
              Confirm Booking
            </button>

            <button
              className="action-button decline-button"
              onClick={() =>
                updateBookingStatus("declined")
              }
            >
              Decline
            </button>

            <button
              className="action-button secondary-action"
              onClick={() =>
                console.log("Edit booking")
              }
            >
              Edit Booking
            </button>
          </div>
        );

      case "confirmed":
        return (
          <div className="booking-actions">
            <button
              className="action-button complete-button"
              onClick={() =>
                updateBookingStatus("completed")
              }
            >
              Mark Completed
            </button>

            <button
              className="action-button secondary-action"
              onClick={() =>
                console.log("Edit booking")
              }
            >
              Edit Booking
            </button>

            <button
              className="action-button decline-button"
              onClick={() =>
                updateBookingStatus("cancelled")
              }
            >
              Cancel Booking
            </button>
          </div>
        );

      case "completed":
        return (
          <div className="booking-actions">
            <button
              className="action-button secondary-action"
              onClick={() =>
                console.log("Create invoice")
              }
            >
              Create Invoice
            </button>

            <button
              className="action-button secondary-action"
              onClick={() =>
                console.log("Create gallery")
              }
            >
              Create Gallery
            </button>
          </div>
        );

      case "cancelled":
      case "declined":
        return (
          <div className="booking-actions">
            <span className="inactive-message">
              No further actions are available for this booking.
            </span>
          </div>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="booking-details-page">
        <div className="booking-details-state">
          <p>Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="booking-details-page">
        <div className="booking-details-state error-state">
          <p className="page-eyebrow">LensFlow</p>

          <h2>Unable to load booking</h2>

          <p>{error}</p>

          <button
            className="secondary-button"
            onClick={() =>
              navigate("/photographer/bookings")
            }
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div className="booking-details-page">

      {/* Back navigation */}

      <button
        className="back-button"
        onClick={() =>
          navigate("/photographer/bookings")
        }
      >
        ← Back to Bookings
      </button>

      {/* Header */}

      <header className="booking-details-header">

        <div className="booking-heading-content">

          <p className="page-eyebrow">
            Booking Details
          </p>

          <h1>
            {formatDate(booking.booking_date)}
          </h1>

          <p className="booking-time-large">
            {formatTime(booking.start_time)}
            {" – "}
            {formatTime(booking.end_time)}
          </p>

        </div>

        <div className="booking-header-status">
          <span className={getStatusClass()}>
            {getStatusLabel(booking.status)}
          </span>
        </div>

      </header>

      {error && (
        <div className="inline-error">
          {error}
        </div>
      )}

      {/* Main booking information */}

      <div className="booking-details-grid">

        {/* Client */}

        <section className="details-card">

          <p className="card-eyebrow">
            Client
          </p>

          <div className="client-profile">

            <div className="client-avatar">
              {client?.avatar_url ? (
                <img
                  src={client.avatar_url}
                  alt={getClientName()}
                />
              ) : (
                getClientInitials()
              )}
            </div>

            <div className="client-information">

              <h2>
                {getClientName()}
              </h2>

              {client?.email && (
                <a href={`mailto:${client.email}`}>
                  {client.email}
                </a>
              )}

              {client?.phone && (
                <a href={`tel:${client.phone}`}>
                  {client.phone}
                </a>
              )}

            </div>

          </div>

          <button
            className="text-button"
            onClick={() =>
              navigate(
                `/photographer/clients/${booking.client_id}`
              )
            }
          >
            View Client Profile →
          </button>

        </section>

        {/* Service */}

        <section className="details-card">

          <p className="card-eyebrow">
            Service
          </p>

          <h2>
            {service?.name || "Unknown Service"}
          </h2>

          {service?.description && (
            <p className="service-description">
              {service.description}
            </p>
          )}

          <div className="service-details">

            {getBookingDuration() && (
              <div>
                <span>Duration</span>

                <strong>
                  {getBookingDuration()}
                </strong>
              </div>
            )}

            <div>
              <span>Total</span>

              <strong>
                {formatCurrency(
                  booking.total_amount
                )}
              </strong>
            </div>

          </div>

        </section>

        {/* Location */}

        <section className="details-card">

          <p className="card-eyebrow">
            Location
          </p>

          <div className="location-content">

            <div className="location-icon">
              ◇
            </div>

            <h2>
              {booking.location ||
                "No location specified"}
            </h2>

          </div>

          {booking.location && (
            <a
              className="text-button"
              href={getGoogleMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps →
            </a>
          )}

        </section>

        {/* Financial summary */}

        <section className="details-card financial-card">

          <p className="card-eyebrow">
            Booking Summary
          </p>

          <div className="financial-summary">

            <div className="financial-row">
              <span>Service</span>

              <strong>
                {formatCurrency(
                  booking.total_amount
                )}
              </strong>
            </div>

            <div className="financial-row total-row">
              <span>Total Booking Value</span>

              <strong>
                {formatCurrency(
                  booking.total_amount
                )}
              </strong>
            </div>

          </div>

        </section>

        {/* Notes */}

        <section className="details-card notes-card">

          <p className="card-eyebrow">
            Booking Notes
          </p>

          <p className="booking-notes">
            {booking.notes ||
              "No notes have been added to this booking."}
          </p>

        </section>

      </div>

      {/* Booking information */}

      <section className="booking-meta-card">

        <div className="meta-item">
          <span>Booking Date</span>
          <strong>
            {formatShortDate(
              booking.booking_date
            )}
          </strong>
        </div>

        <div className="meta-item">
          <span>Start Time</span>
          <strong>
            {formatTime(booking.start_time)}
          </strong>
        </div>

        <div className="meta-item">
          <span>End Time</span>
          <strong>
            {formatTime(booking.end_time)}
          </strong>
        </div>

        <div className="meta-item">
          <span>Last Updated</span>
          <strong>
            {booking.updated_at
              ? new Date(
                  booking.updated_at
                ).toLocaleDateString("en-NZ", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </strong>
        </div>

      </section>

      {/* Actions */}

      <section className="booking-actions-card">

        <div className="actions-heading">

          <p className="card-eyebrow">
            Booking Actions
          </p>

          <h2>
            Manage this booking
          </h2>

        </div>

        {renderActions()}

      </section>

    </div>
  );
}