import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { getClient, calculateEndTime, formatCurrency, formatDate, formatTime, localToday } from "./bookingHelpers";
import "./Bookings.css";

export default function NewBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPhotographer = searchParams.get("photographer");
  const requestedService = searchParams.get("service");
  const submitting = useRef(false);
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      setClient(null);
      setServices([]);
      setServiceId("");
      try {
        const profile = await getClient(user?.id);
        if (!profile.photographer_id) throw new Error("No photographer assigned.");
        if (requestedPhotographer && profile.photographer_id !== requestedPhotographer) {
          if (active) setLoadError("Your account is not linked to this photographer. Please contact them to arrange client access before booking.");
          return;
        }
        const { data, error: queryError } = await supabase.from("services")
          .select("service_id, name, description, price, duration_minutes")
          .eq("photographer_id", profile.photographer_id).eq("is_active", true).order("name");
        if (queryError) throw queryError;
        if (active) {
          setClient(profile); setServices(data || []);
          if ((data || []).some((item) => String(item.service_id) === requestedService)) setServiceId(requestedService);
        }
      } catch (err) {
        console.error("Unable to load booking services:", err);
        if (active) setLoadError("We couldn't load your photographer's services. Please try again or contact your photographer.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user?.id, retry, requestedPhotographer, requestedService]);

  const service = services.find((item) => String(item.service_id) === serviceId);
  const end = calculateEndTime(start, service?.duration_minutes);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!client || !service) { setError("Please select an available service."); return; }
    const sessionDate = new Date(`${date}T${start}`);
    if (!date || !start || Number.isNaN(sessionDate.getTime()) || sessionDate <= new Date()) {
      setError("Please choose a date and time in the future."); return;
    }
    if (!end) { setError("Choose a start time that allows the full session to finish before midnight. If the service has no duration, contact your photographer."); return; }
    submitting.current = true;
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase.from("bookings").insert({
        client_id: client.client_id,
        photographer_id: client.photographer_id,
        service_id: service.service_id,
        booking_date: date,
        start_time: start,
        end_time: end,
        location: location.trim() || null,
        notes: notes.trim() || null,
        status: "pending",
        total_amount: service.price,
      }).select("booking_id").single();
      if (insertError) throw insertError;
      navigate(`/client/bookings/${data.booking_id}`, { replace: true });
    } catch (err) {
      console.error("Unable to request booking:", err);
      setError("Your booking request couldn't be saved. Please try again or contact your photographer.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="client-bookings-page">
      <Link className="client-booking-back" to="/client/bookings">← Back to My Bookings</Link>
      <header className="client-bookings-header">
        <p className="client-bookings-eyebrow">Your photography</p><h1>New Booking</h1>
        <p>Request a session with your photographer. Your preferred date and time are subject to confirmation.</p>
      </header>
      {loading ? <div className="client-bookings-state" role="status">Loading available services…</div> :
        loadError ? <div className="client-bookings-state" role="alert"><p>{loadError}</p><button onClick={() => setRetry((value) => value + 1)}>Try again</button></div> :
        services.length === 0 ? <div className="client-bookings-state"><h2>No services available</h2><p>Please contact your photographer to arrange a session.</p></div> : (
          <form className="client-booking-form-layout" onSubmit={handleSubmit}>
            <fieldset className="client-booking-panel client-booking-fields" disabled={saving}>
              <legend>Session information</legend>
              <label htmlFor="client-service">Photography service</label>
              <select id="client-service" required value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">Select a service</option>
                {services.map((item) => <option key={item.service_id} value={item.service_id}>{item.name} — {formatCurrency(item.price)}</option>)}
              </select>
              {service && <p>{service.description}{service.duration_minutes > 0 && ` (${service.duration_minutes} minutes)`}</p>}
              <label htmlFor="client-booking-date">Preferred date</label>
              <input id="client-booking-date" type="date" required min={localToday()} value={date} onChange={(event) => setDate(event.target.value)} />
              <label htmlFor="client-booking-start">Preferred start time</label>
              <input id="client-booking-start" type="time" required value={start} onChange={(event) => setStart(event.target.value)} />
              <label htmlFor="client-booking-end">End time</label>
              <input id="client-booking-end" type="time" value={end} readOnly aria-describedby="client-end-help" />
              <small id="client-end-help">Calculated from your selected service's duration.</small>
              <label htmlFor="client-booking-location">Preferred location (optional)</label>
              <input id="client-booking-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Mount Maunganui Beach" />
              <label htmlFor="client-booking-notes">Notes or special requirements (optional)</label>
              <textarea id="client-booking-notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </fieldset>
            <aside className="client-booking-panel client-booking-request-summary">
              <p className="client-bookings-eyebrow">Summary</p><h2>Your booking request</h2>
              <dl className="client-booking-facts">
                <div><dt>Service</dt><dd>{service?.name || "Not selected"}</dd></div>
                <div><dt>Date</dt><dd>{date ? formatDate(date) : "Not selected"}</dd></div>
                <div><dt>Time</dt><dd>{start ? formatTime(start) : "Not selected"}{end && ` – ${formatTime(end)}`}</dd></div>
                <div><dt>Total</dt><dd>{formatCurrency(service?.price)}</dd></div>
              </dl>
              <p>Your photographer will review your request and confirm availability.</p>
              {error && <p className="client-booking-error" role="alert">{error}</p>}
              <button className="client-booking-button" type="submit" disabled={saving || !service}>{saving ? "Sending request…" : "Request Booking"}</button>
              <button className="client-booking-button client-booking-button-secondary" type="button" disabled={saving} onClick={() => navigate("/client/bookings")}>Cancel</button>
            </aside>
          </form>
        )}
    </div>
  );
}
