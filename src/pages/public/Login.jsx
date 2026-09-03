import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from =
    location.state?.from?.pathname || "/";

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signIn(email, password);

      navigate(from, {
        replace: true,
      });
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to sign in. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">

      {/* =====================================================
          Brand
      ===================================================== */}

      <button
        type="button"
        className="login-brand"
        onClick={() => navigate("/")}
      >
        <span className="login-brand-mark">
          LF
        </span>

        <span>
          LensFlow
        </span>
      </button>

      {/* =====================================================
          Login Card
      ===================================================== */}

      <section className="login-card">

        <div className="login-heading">

          <p className="login-eyebrow">
            Welcome back
          </p>

          <h1>
            Sign in to LensFlow
          </h1>

          <p>
            Manage your photography business
            from one place.
          </p>

        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          {/* Email */}

          <div className="login-field">

            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="you@example.com"
              required
            />

          </div>

          {/* Password */}

          <div className="login-field">

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />

          </div>

          {/* Error */}

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {/* Submit */}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}

            {!loading && <span>→</span>}
          </button>

        </form>

        <button
          type="button"
          className="login-back"
          onClick={() => navigate("/")}
        >
          ← Back to LensFlow
        </button>

      </section>

      <p className="login-footer">
        LensFlow · Photography Business Management
      </p>

    </main>
  );
}