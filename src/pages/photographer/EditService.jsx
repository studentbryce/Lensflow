import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./EditService.css";

export default function EditService() {
  const navigate = useNavigate();
  const { service_id } = useParams();

  const [service, setService] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_minutes: "",
    deposit_amount: "",
    image_url: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (service_id) {
      fetchService();
    } else {
      setError("No service was specified.");
      setLoading(false);
    }
  }, [service_id]);

  async function fetchService() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be logged in to edit a service."
        );
      }

      const { data, error: serviceError } = await supabase
        .from("services")
        .select(`
          service_id,
          photographer_id,
          name,
          description,
          price,
          duration_minutes,
          deposit_amount,
          image_url,
          is_active,
          created_at,
          updated_at
        `)
        .eq("service_id", service_id)
        .single();

      if (serviceError) {
        throw serviceError;
      }

      if (!data) {
        throw new Error("Service could not be found.");
      }

      setService(data);

      setFormData({
        name: data.name || "",
        description: data.description || "",
        price:
          data.price !== null && data.price !== undefined
            ? String(data.price)
            : "",
        duration_minutes:
          data.duration_minutes !== null &&
          data.duration_minutes !== undefined
            ? String(data.duration_minutes)
            : "",
        deposit_amount:
          data.deposit_amount !== null &&
          data.deposit_amount !== undefined
            ? String(data.deposit_amount)
            : "",
        image_url: data.image_url || "",
        is_active: data.is_active ?? true,
      });
    } catch (err) {
      console.error("Error loading service:", err);

      if (err.code === "PGRST116") {
        setError(
          "Service could not be found or you do not have permission to access it."
        );
      } else {
        setError(
          err.message || "Unable to load the service."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (error) {
      setError("");
    }

    if (success) {
      setSuccess("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = formData.name.trim();
    const description = formData.description.trim();
    const imageUrl = formData.image_url.trim();

    const price = Number(formData.price);
    const duration = Number(formData.duration_minutes);

    const deposit =
      formData.deposit_amount.trim() === ""
        ? 0
        : Number(formData.deposit_amount);

    // -------------------------
    // Client-side validation
    // -------------------------

    if (!name) {
      setError("Please enter a service name.");
      return;
    }

    if (name.length > 150) {
      setError("Service name must be 150 characters or less.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setError("Please enter a valid price of $0 or more.");
      return;
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      setError("Duration must be a whole number greater than 0.");
      return;
    }

    if (Number.isNaN(deposit) || deposit < 0) {
      setError("Please enter a valid deposit amount of $0 or more.");
      return;
    }

    if (deposit > price) {
      setError("Deposit cannot be greater than the service price.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be logged in to update a service."
        );
      }

      /*
       * We do not change photographer_id here.
       *
       * The existing RLS policy:
       *
       * photographer_id =
       * private.current_photographer_id()
       *
       * ensures that only the authenticated photographer
       * who owns the service can update it.
       */

      const { data: updatedService, error: updateError } =
        await supabase
          .from("services")
          .update({
            name,
            description: description || null,
            price,
            duration_minutes: duration,
            deposit_amount: deposit,
            image_url: imageUrl || null,
            is_active: formData.is_active,
          })
          .eq("service_id", service_id)
          .select()
          .single();

      if (updateError) {
        throw updateError;
      }

      if (!updatedService) {
        throw new Error(
          "The service could not be updated. Check the services RLS policy."
        );
      }

      setService(updatedService);
      setSuccess("Service updated successfully.");

      setTimeout(() => {
        navigate("/photographer/services");
      }, 700);
    } catch (err) {
      console.error("Error updating service:", err);

      setError(
        err.message || "Unable to update the service."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate("/photographer/services");
  }

  if (loading) {
    return (
      <div className="edit-service-page">
        <div className="edit-service-state">
          <p>Loading service...</p>
        </div>
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="edit-service-page">
        <div className="edit-service-state error-state">
          <h2>Unable to load service</h2>

          <p>{error}</p>

          <div className="state-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/photographer/services")}
            >
              Back to Services
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={fetchService}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-service-page">
      <header className="edit-service-header">
        <div>
          <p className="page-eyebrow">
            LensFlow / Services
          </p>

          <h1>Edit Service</h1>

          <p className="page-description">
            Update the details, pricing and availability of this photography service.
          </p>
        </div>
      </header>

      <form
        className="edit-service-form"
        onSubmit={handleSubmit}
      >
        <section className="form-section">
          <div className="form-section-heading">
            <h2>Service Details</h2>

            <p>
              Update the basic information about this photography service.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="name">
                Service Name
                <span>*</span>
              </label>

              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Wedding Photography"
                maxLength={150}
                disabled={saving}
                required
              />

              <small>
                Choose a clear name that clients will easily understand.
              </small>
            </div>

            <div className="form-field form-field-full">
              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe what is included with this service..."
                rows={5}
                disabled={saving}
              />

              <small>
                Explain what clients receive as part of this service.
              </small>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <h2>Pricing & Duration</h2>

            <p>
              Update the service price, booking duration and deposit.
            </p>
          </div>

          <div className="form-grid form-grid-three">
            <div className="form-field">
              <label htmlFor="price">
                Price (NZD)
                <span>*</span>
              </label>

              <div className="input-with-prefix">
                <span>$</span>

                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={saving}
                  required
                />
              </div>

              <small>
                The full price charged for the service.
              </small>
            </div>

            <div className="form-field">
              <label htmlFor="duration_minutes">
                Duration
                <span>*</span>
              </label>

              <div className="input-with-suffix">
                <input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  placeholder="60"
                  disabled={saving}
                  required
                />

                <span>min</span>
              </div>

              <small>
                How long the photography session takes.
              </small>
            </div>

            <div className="form-field">
              <label htmlFor="deposit_amount">
                Deposit
              </label>

              <div className="input-with-prefix">
                <span>$</span>

                <input
                  id="deposit_amount"
                  name="deposit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={saving}
                />
              </div>

              <small>
                Optional deposit required to secure a booking.
              </small>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <h2>Service Image</h2>

            <p>
              Update the image used to represent this service.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-field form-field-full">
              <label htmlFor="image_url">
                Image URL
              </label>

              <input
                id="image_url"
                name="image_url"
                type="url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://example.com/your-service-image.jpg"
                disabled={saving}
              />

              <small>
                Add a Supabase Storage image URL or another publicly accessible image URL.
              </small>
            </div>
          </div>
        </section>

        <section className="form-section service-status-section">
          <div className="form-section-heading">
            <h2>Service Status</h2>

            <p>
              Control whether clients can currently book this service.
            </p>
          </div>

          <label className="status-toggle">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              disabled={saving}
            />

            <span className="toggle-slider"></span>

            <span className="toggle-content">
              <strong>
                {formData.is_active
                  ? "Service is active"
                  : "Service is inactive"}
              </strong>

              <small>
                {formData.is_active
                  ? "This service can be offered to clients."
                  : "This service is hidden from new bookings."}
              </small>
            </span>
          </label>
        </section>

        {error && (
          <div className="form-message error-message">
            <strong>Unable to update service</strong>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="form-message success-message">
            <strong>Service updated</strong>
            <p>{success}</p>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                Save Changes
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}