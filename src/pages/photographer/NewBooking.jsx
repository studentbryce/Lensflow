import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./NewBooking.css";

export default function NewBooking() {
  const navigate = useNavigate();

  const [photographer, setPhotographer] = useState(null);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);

  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadBookingData();
  }, []);

  async function loadBookingData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You must be logged in to create a booking.");
      }

      /*
       * Find the photographer profile belonging
       * to the currently logged-in user.
       */
      const {
        data: photographerData,
        error: photographerError,
      } = await supabase
        .from("photographer_profiles")
        .select(`
          photographer_id,
          user_id,
          business_name
        `)
        .eq("user_id", user.id)
        .single();

      if (photographerError) throw photographerError;

      setPhotographer(photographerData);

      /*
       * Load clients belonging to this photographer.
       */
      const { data: clientData, error: clientsError } =
        await supabase
          .from("clients")
          .select(`
            client_id,
            user_id
          `)
          .eq(
            "photographer_id",
            photographerData.photographer_id
          );

      if (clientsError) throw clientsError;

      /*
       * Retrieve the profile information for each client.
       */
      const clientUserIds = [
        ...new Set(
          (clientData || [])
            .map((client) => client.user_id)
            .filter(Boolean)
        ),
      ];

      let profileMap = {};

      if (clientUserIds.length > 0) {
        const {
          data: profiles,
          error: profilesError,
        } = await supabase
          .from("profiles")
          .select(`
            user_id,
            first_name,
            last_name,
            email
          `)
          .in("user_id", clientUserIds);

        if (profilesError) throw profilesError;

        profileMap = Object.fromEntries(
          (profiles || []).map((profile) => [
            profile.user_id,
            profile,
          ])
        );
      }

      const formattedClients = (clientData || []).map(
        (client) => ({
          ...client,
          profile: profileMap[client.user_id],
        })
      );

      setClients(formattedClients);

      /*
       * Load active services belonging to this photographer.
       */
      const { data: serviceData, error: servicesError } =
        await supabase
          .from("services")
          .select(`
            service_id,
            name,
            description,
            price,
            duration_minutes,
            deposit_amount
          `)
          .eq(
            "photographer_id",
            photographerData.photographer_id
          )
          .eq("is_active", true)
          .order("name", { ascending: true });

      if (servicesError) throw servicesError;

      setServices(serviceData || []);
    } catch (err) {
      console.error("Error loading booking data:", err);
      setError(
        err.message || "Unable to load booking information."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedService = services.find(
    (service) => service.service_id === serviceId
  );

  function calculateEndTime(start, durationMinutes) {
    if (!start || !durationMinutes) {
      return "";
    }

    const [hours, minutes] = start.split(":").map(Number);

    const totalMinutes =
      hours * 60 + minutes + Number(durationMinutes);

    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${String(endHours).padStart(2, "0")}:${String(
      endMinutes
    ).padStart(2, "0")}`;
  }

  const endTime = calculateEndTime(
    startTime,
    selectedService?.duration_minutes
  );

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount || 0);
  }

  function getClientName(client) {
    if (!client.profile) {
      return client.profile?.email || "Unknown Client";
    }

    return `${client.profile.first_name || ""} ${
      client.profile.last_name || ""
    }`.trim();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!photographer) {
      setError("Photographer profile could not be found.");
      return;
    }

    if (!clientId) {
      setError("Please select a client.");
      return;
    }

    if (!serviceId) {
      setError("Please select a service.");
      return;
    }

    if (!bookingDate) {
      setError("Please select a booking date.");
      return;
    }

    if (!startTime) {
      setError("Please select a start time.");
      return;
    }

    if (!endTime) {
      setError("Unable to calculate the booking end time.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          photographer_id: photographer.photographer_id,
          client_id: clientId,
          service_id: serviceId,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          location: location.trim() || null,
          notes: notes.trim() || null,
          status: "confirmed",
          total_amount: selectedService?.price || 0,
        })
        .select("booking_id")
        .single();

      if (bookingError) throw bookingError;

      navigate(
        `/photographer/bookings/${data.booking_id}`,
        { replace: true }
      );
    } catch (err) {
      console.error("Error creating booking:", err);

      setError(
        err.message || "Unable to create booking."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="new-booking-page">
        <div className="booking-state">
          <p>Loading booking information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-booking-page">

      <header className="new-booking-header">

        <div>
          <button
            type="button"
            className="back-button"
            onClick={() => navigate("/photographer/bookings")}
          >
            ← Back to Bookings
          </button>

          <p className="page-eyebrow">LensFlow</p>

          <h1>New Booking</h1>

          <p className="page-description">
            Create a new photography booking for one of your clients.
          </p>
        </div>

      </header>

      {error && (
        <div className="new-booking-error">
          <strong>Unable to create booking</strong>
          <p>{error}</p>
        </div>
      )}

      <form
        className="new-booking-layout"
        onSubmit={handleSubmit}
      >

        {/* Booking Details */}

        <section className="booking-form-card">

          <div className="form-section-heading">
            <p className="section-eyebrow">Booking details</p>
            <h2>Session Information</h2>
          </div>

          <div className="form-grid">

            {/* Client */}

            <div className="form-field">

              <label htmlFor="client">
                Client
              </label>

              <select
                id="client"
                value={clientId}
                onChange={(e) =>
                  setClientId(e.target.value)
                }
                required
              >
                <option value="">
                  Select a client
                </option>

                {clients.map((client) => (
                  <option
                    key={client.client_id}
                    value={client.client_id}
                  >
                    {getClientName(client)}
                  </option>
                ))}
              </select>

              {clients.length === 0 && (
                <small>
                  No clients are currently available.
                </small>
              )}

            </div>

            {/* Service */}

            <div className="form-field">

              <label htmlFor="service">
                Photography Service
              </label>

              <select
                id="service"
                value={serviceId}
                onChange={(e) =>
                  setServiceId(e.target.value)
                }
                required
              >
                <option value="">
                  Select a service
                </option>

                {services.map((service) => (
                  <option
                    key={service.service_id}
                    value={service.service_id}
                  >
                    {service.name} —{" "}
                    {formatCurrency(service.price)}
                  </option>
                ))}
              </select>

              {selectedService && (
                <small>
                  {selectedService.duration_minutes} minute session
                </small>
              )}

              {services.length === 0 && (
                <small>
                  No active services are currently available.
                </small>
              )}

            </div>

            {/* Date */}

            <div className="form-field">

              <label htmlFor="booking-date">
                Date
              </label>

              <input
                id="booking-date"
                type="date"
                value={bookingDate}
                onChange={(e) =>
                  setBookingDate(e.target.value)
                }
                min={
                  new Date()
                    .toISOString()
                    .split("T")[0]
                }
                required
              />

            </div>

            {/* Start Time */}

            <div className="form-field">

              <label htmlFor="start-time">
                Start Time
              </label>

              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                required
              />

            </div>

            {/* End Time */}

            <div className="form-field">

              <label htmlFor="end-time">
                End Time
              </label>

              <input
                id="end-time"
                type="time"
                value={endTime}
                readOnly
                disabled
              />

              <small>
                Automatically calculated from the selected service.
              </small>

            </div>

            {/* Location */}

            <div className="form-field">

              <label htmlFor="location">
                Location
              </label>

              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
                placeholder="e.g. Mount Maunganui Beach"
              />

            </div>

          </div>

          {/* Notes */}

          <div className="form-field form-field-full">

            <label htmlFor="notes">
              Notes
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Add any notes or special requirements..."
              rows="5"
            />

          </div>

        </section>

        {/* Summary */}

        <aside className="booking-summary-card">

          <div className="form-section-heading">

            <p className="section-eyebrow">
              Summary
            </p>

            <h2>Booking Summary</h2>

          </div>

          <div className="summary-content">

            <div className="summary-row">

              <span>Client</span>

              <strong>
                {clientId
                  ? getClientName(
                      clients.find(
                        (client) =>
                          client.client_id === clientId
                      ) || {}
                    )
                  : "Not selected"}
              </strong>

            </div>

            <div className="summary-row">

              <span>Service</span>

              <strong>
                {selectedService?.name ||
                  "Not selected"}
              </strong>

            </div>

            <div className="summary-row">

              <span>Date</span>

              <strong>
                {bookingDate
                  ? new Date(
                      `${bookingDate}T00:00:00`
                    ).toLocaleDateString("en-NZ", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not selected"}
              </strong>

            </div>

            <div className="summary-row">

              <span>Time</span>

              <strong>
                {startTime && endTime
                  ? `${startTime} – ${endTime}`
                  : "Not selected"}
              </strong>

            </div>

            <div className="summary-divider" />

            <div className="summary-total">

              <span>Total</span>

              <strong>
                {formatCurrency(
                  selectedService?.price || 0
                )}
              </strong>

            </div>

          </div>

          <button
            type="submit"
            className="primary-button create-booking-button"
            disabled={saving}
          >
            {saving
              ? "Creating Booking..."
              : "Create Booking"}
          </button>

          <button
            type="button"
            className="secondary-button cancel-booking-button"
            onClick={() =>
              navigate("/photographer/bookings")
            }
            disabled={saving}
          >
            Cancel
          </button>

        </aside>

      </form>

    </div>
  );
}