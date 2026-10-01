import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./Login.css";
import brandLogo from "../../assets/images/Lensflow_brand_logo-transparent.png";

export default function PhotographerSignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;

    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    if (!businessName.trim()) {
      setError("Please enter your photography business name.");
      return;
    }

    if (password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }

    lock.current = true;
    setSaving(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            signup_type: "photographer",
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            business_name: businessName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/photographer`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.assign("/photographer");
      } else {
        setMessage(
          "Check your email for a confirmation link to finish creating your photographer account."
        );
        setPassword("");
        setConfirm("");
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to create your photographer account. Please try again."
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="login-page">
      <Link to="/" className="login-logo" aria-label="Back to LensFlow home">
        <img className="login-logo-img" src={brandLogo} alt="LensFlow" />
      </Link>

      <section className="login-card login-card-wide">
        <div className="login-heading">
          <p className="login-eyebrow">For photographers</p>
          <h1>Create your LensFlow account</h1>
          <p>
            Set up your photography business workspace and start managing
            clients, bookings, invoices and galleries.
          </p>
        </div>

        {message ? (
          <div className="login-success" role="status">
            {message}
          </div>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <div className="login-form-grid">
              <div className="login-field">
                <label htmlFor="photographer-first">First name</label>
                <input
                  id="photographer-first"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="login-field">
                <label htmlFor="photographer-last">Last name</label>
                <input
                  id="photographer-last"
                  autoComplete="family-name"
                  required
                  maxLength={100}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="photographer-business">Business name</label>
              <input
                id="photographer-business"
                autoComplete="organization"
                required
                maxLength={150}
                placeholder="e.g. North Shore Photography"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="login-field">
              <label htmlFor="photographer-email">Email</label>
              <input
                id="photographer-email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="login-field">
              <label htmlFor="photographer-password">
                Password (at least 8 characters)
              </label>
              <input
                id="photographer-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="login-field">
              <label htmlFor="photographer-confirm">Confirm password</label>
              <input
                id="photographer-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                disabled={saving}
              />
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="login-submit" disabled={saving}>
              {saving ? "Creating account…" : "Create Photographer Account"}
              {!saving && <span>→</span>}
            </button>
          </form>
        )}

        <div className="login-account-links">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p>
            Booking a photographer? <Link to="/signup">Create a client account</Link>
          </p>
        </div>
      </section>

      <p className="login-footer">
        LensFlow · Photography Business Management
      </p>
    </main>
  );
}
