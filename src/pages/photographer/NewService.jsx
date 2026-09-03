import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./NewService.css";

export default function NewService() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        duration_minutes: "",
        deposit_amount: "",
        image_url: "",
        is_active: true,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

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

        setLoading(true);

        try {
            // -------------------------
            // Get authenticated user
            // -------------------------

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) {
                throw userError;
            }

            if (!user) {
                throw new Error(
                    "You must be logged in to create a service."
                );
            }

            // -------------------------
            // Get photographer profile
            // -------------------------

            const { data: photographer, error: photographerError } =
                await supabase
                    .from("photographer_profiles")
                    .select("photographer_id")
                    .eq("user_id", user.id)
                    .single();

            if (photographerError) {
                throw photographerError;
            }

            if (!photographer) {
                throw new Error(
                    "Photographer profile could not be found."
                );
            }

            // -------------------------
            // Create service
            // -------------------------

            const { data, error: insertError } = await supabase
                .from("services")
                .insert({
                    photographer_id: photographer.photographer_id,
                    name,
                    description: description || null,
                    price,
                    duration_minutes: duration,
                    deposit_amount: deposit,
                    image_url: imageUrl || null,
                    is_active: formData.is_active,
                })
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            if (!data) {
                throw new Error(
                    "The service could not be created."
                );
            }

            setSuccess("Service created successfully.");

            setTimeout(() => {
                navigate("/photographer/services");
            }, 700);
        } catch (err) {
            console.error("Error creating service:", err);

            setError(
                err.message || "Unable to create the service."
            );
        } finally {
            setLoading(false);
        }
    }

    function handleCancel() {
        navigate("/photographer/services");
    }

    return (
        <div className="new-service-page">
            <header className="new-service-header">
                <div>
                    <p className="page-eyebrow">LensFlow / Services</p>

                    <h1>New Service</h1>

                    <p className="page-description">
                        Create a photography service that you can offer to your clients.
                    </p>
                </div>
            </header>

            <form
                className="new-service-form"
                onSubmit={handleSubmit}
            >
                <section className="form-section">
                    <div className="form-section-heading">
                        <h2>Service Details</h2>

                        <p>
                            Add the basic information about the photography service.
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
                                disabled={loading}
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
                                disabled={loading}
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
                            Set the price, booking duration and optional deposit.
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
                                    disabled={loading}
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
                                    disabled={loading}
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
                                    disabled={loading}
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
                            Add an image to visually represent this service.
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
                                disabled={loading}
                            />

                            <small>
                                You can add a Supabase Storage image URL or another
                                publicly accessible image URL.
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
                            disabled={loading}
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
                        <strong>Unable to create service</strong>
                        <p>{error}</p>
                    </div>
                )}

                {success && (
                    <div className="form-message success-message">
                        <strong>Service created</strong>
                        <p>{success}</p>
                    </div>
                )}

                <div className="form-actions">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={handleCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                    >
                        {loading ? (
                            "Creating..."
                        ) : (
                            <>
                                <span>+</span>
                                Create Service
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}