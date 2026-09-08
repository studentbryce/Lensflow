import {
  useEffect,
  useState,
} from "react";

import {
  BiBell,
  BiBuilding,
  BiCalendar,
  BiCheckCircle,
  BiCreditCard,
  BiGlobe,
  BiLockAlt,
  BiLogOut,
  BiRefresh,
  BiSave,
  BiShield,
  BiUser,
} from "react-icons/bi";

import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

import "./Settings.css";


const SETTINGS_SECTIONS = [
  {
    id: "account",
    label: "Account",
    icon: BiUser,
  },
  {
    id: "business",
    label: "Business Profile",
    icon: BiBuilding,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: BiBell,
  },
  {
    id: "payments",
    label: "Payments",
    icon: BiCreditCard,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: BiCalendar,
  },
  {
    id: "security",
    label: "Security",
    icon: BiShield,
  },
  {
    id: "website",
    label: "Website",
    icon: BiGlobe,
  },
];


export default function Settings() {
  const navigate = useNavigate();

  const {
    signOut,
  } = useAuth();


  /* =========================================================
     Page state
     ========================================================= */

  const [activeSection, setActiveSection] =
    useState("account");

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");


  /* =========================================================
     Account state
     ========================================================= */

  const [accountForm, setAccountForm] =
    useState({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    });

  const [originalEmail, setOriginalEmail] =
    useState("");

  const [savingAccount, setSavingAccount] =
    useState(false);

  const [accountMessage, setAccountMessage] =
    useState("");

  const [accountError, setAccountError] =
    useState("");


  /* =========================================================
     Photographer / business state
     ========================================================= */

  const [photographerId, setPhotographerId] =
    useState("");

  const [businessForm, setBusinessForm] =
    useState({
      business_name: "",
      email: "",
      phone: "",
      address: "",
      website_url: "",
      description: "",
    });

  const [savingBusiness, setSavingBusiness] =
    useState(false);

  const [businessMessage, setBusinessMessage] =
    useState("");

  const [businessError, setBusinessError] =
    useState("");


  /* =========================================================
     Calendar state
     ========================================================= */

  const [calendarIntegration, setCalendarIntegration] =
    useState(null);


  /* =========================================================
     Security state
     ========================================================= */

  const [passwordForm, setPasswordForm] =
    useState({
      password: "",
      confirmPassword: "",
    });

  const [savingPassword, setSavingPassword] =
    useState(false);

  const [securityMessage, setSecurityMessage] =
    useState("");

  const [securityError, setSecurityError] =
    useState("");


  /* =========================================================
     Load settings
     ========================================================= */

  async function loadSettings() {
    try {
      setLoading(true);
      setLoadError("");

      const {
        data: {
          user,
        },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "No authenticated photographer was found."
        );
      }


      /* -----------------------------------------------------
         Account profile
         ----------------------------------------------------- */

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          user_id,
          role,
          first_name,
          last_name,
          email,
          phone
        `)
        .eq(
          "user_id",
          user.id
        )
        .single();

      if (profileError) {
        throw profileError;
      }


      /*
       * Supabase Auth is the source of truth for account email.
       *
       * If an email confirmation has previously completed and
       * profiles.email has not yet caught up, synchronize it.
       */

      const authEmail =
        user.email ||
        profileData.email ||
        "";

      if (
        user.email &&
        profileData.email !== user.email
      ) {
        const {
          error: syncEmailError,
        } = await supabase
          .from("profiles")
          .update({
            email: user.email,
          })
          .eq(
            "user_id",
            user.id
          );

        if (syncEmailError) {
          console.error(
            "Unable to synchronize profile email:",
            syncEmailError
          );
        }
      }


      setAccountForm({
        first_name:
          profileData.first_name || "",

        last_name:
          profileData.last_name || "",

        email:
          authEmail,

        phone:
          profileData.phone || "",
      });

      setOriginalEmail(authEmail);


      /* -----------------------------------------------------
         Photographer profile
         ----------------------------------------------------- */

      const {
        data: photographerData,
        error: photographerError,
      } = await supabase
        .from("photographer_profiles")
        .select(`
          photographer_id,
          user_id,
          business_name,
          description,
          email,
          phone,
          website_url,
          address
        `)
        .eq(
          "user_id",
          user.id
        )
        .single();

      if (photographerError) {
        throw photographerError;
      }


      setPhotographerId(
        photographerData.photographer_id
      );

      setBusinessForm({
        business_name:
          photographerData.business_name || "",

        email:
          photographerData.email || "",

        phone:
          photographerData.phone || "",

        address:
          photographerData.address || "",

        website_url:
          photographerData.website_url || "",

        description:
          photographerData.description || "",
      });


      /* -----------------------------------------------------
         Calendar integration
         ----------------------------------------------------- */

      const {
        data: calendarData,
        error: calendarError,
      } = await supabase
        .from("calendar_integrations")
        .select(`
          integration_id,
          photographer_id,
          provider,
          calendar_id,
          token_expires_at,
          is_active,
          created_at,
          updated_at
        `)
        .eq(
          "photographer_id",
          photographerData.photographer_id
        )
        .eq(
          "provider",
          "google"
        )
        .maybeSingle();

      if (calendarError) {
        throw calendarError;
      }

      setCalendarIntegration(
        calendarData || null
      );

    } catch (error) {
      console.error(
        "Unable to load photographer settings:",
        error
      );

      setLoadError(
        error.message ||
        "Unable to load your settings."
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadSettings();
  }, []);


  /* =========================================================
     Account handlers
     ========================================================= */

  function handleAccountChange(event) {
    const {
      name,
      value,
    } = event.target;

    setAccountForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

    setAccountMessage("");
    setAccountError("");
  }


  async function handleSaveAccount(event) {
    event.preventDefault();

    const firstName =
      accountForm.first_name.trim();

    const lastName =
      accountForm.last_name.trim();

    const email =
      accountForm.email
        .trim()
        .toLowerCase();

    const phone =
      accountForm.phone.trim();


    if (!firstName || !lastName) {
      setAccountError(
        "First name and last name are required."
      );

      return;
    }


    if (!email) {
      setAccountError(
        "Email address is required."
      );

      return;
    }


    try {
      setSavingAccount(true);

      setAccountMessage("");
      setAccountError("");


      const {
        data: {
          user,
        },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "Your authenticated account could not be found."
        );
      }


      /* -----------------------------------------------------
         Save name / phone
         ----------------------------------------------------- */

      const {
        error: profileUpdateError,
      } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone:
            phone || null,
        })
        .eq(
          "user_id",
          user.id
        );

      if (profileUpdateError) {
        throw profileUpdateError;
      }


      /* -----------------------------------------------------
         Email change
         ----------------------------------------------------- */

      if (
        email !==
        originalEmail.toLowerCase()
      ) {
        const {
          data: authUpdateData,
          error: emailUpdateError,
        } = await supabase.auth.updateUser({
          email,
        });

        if (emailUpdateError) {
          throw emailUpdateError;
        }


        /*
         * If Supabase immediately changes the email,
         * keep profiles.email synchronized.
         *
         * If email confirmation is required,
         * authUpdateData.user.email may remain the old
         * address until confirmation is completed.
         */

        if (
          authUpdateData?.user?.email
            ?.toLowerCase() === email
        ) {
          const {
            error: profileEmailError,
          } = await supabase
            .from("profiles")
            .update({
              email,
            })
            .eq(
              "user_id",
              user.id
            );

          if (profileEmailError) {
            throw profileEmailError;
          }

          setOriginalEmail(email);

          setAccountMessage(
            "Account details updated successfully."
          );
        } else {
          setAccountMessage(
            "Your account details were saved. Check your email to confirm the new email address."
          );
        }

      } else {
        setAccountMessage(
          "Account details updated successfully."
        );
      }


      setAccountForm(
        (current) => ({
          ...current,

          first_name:
            firstName,

          last_name:
            lastName,

          email,

          phone,
        })
      );

    } catch (error) {
      console.error(
        "Unable to update account settings:",
        error
      );

      setAccountError(
        error.message ||
        "Your account could not be updated."
      );

    } finally {
      setSavingAccount(false);
    }
  }


  /* =========================================================
     Business handlers
     ========================================================= */

  function handleBusinessChange(event) {
    const {
      name,
      value,
    } = event.target;

    setBusinessForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

    setBusinessMessage("");
    setBusinessError("");
  }


  async function handleSaveBusiness(event) {
    event.preventDefault();

    const businessName =
      businessForm.business_name.trim();

    const email =
      businessForm.email
        .trim()
        .toLowerCase();

    const phone =
      businessForm.phone.trim();

    const address =
      businessForm.address.trim();

    const websiteUrl =
      businessForm.website_url.trim();

    const description =
      businessForm.description.trim();


    if (!businessName) {
      setBusinessError(
        "Business name is required."
      );

      return;
    }


    if (!email) {
      setBusinessError(
        "Business email is required."
      );

      return;
    }


    if (websiteUrl) {
      try {
        const parsedUrl =
          new URL(websiteUrl);

        if (
          ![
            "http:",
            "https:",
          ].includes(
            parsedUrl.protocol
          )
        ) {
          throw new Error();
        }

      } catch {
        setBusinessError(
          "Website URL must be a valid http:// or https:// address."
        );

        return;
      }
    }


    if (!photographerId) {
      setBusinessError(
        "Photographer profile could not be found."
      );

      return;
    }


    try {
      setSavingBusiness(true);

      setBusinessMessage("");
      setBusinessError("");


      const {
        error: updateError,
      } = await supabase
        .from("photographer_profiles")
        .update({
          business_name:
            businessName,

          email,

          phone:
            phone || null,

          address:
            address || null,

          website_url:
            websiteUrl || null,

          description:
            description || null,
        })
        .eq(
          "photographer_id",
          photographerId
        );


      if (updateError) {
        throw updateError;
      }


      setBusinessForm({
        business_name:
          businessName,

        email,

        phone,

        address,

        website_url:
          websiteUrl,

        description,
      });


      setBusinessMessage(
        "Business profile updated successfully."
      );

    } catch (error) {
      console.error(
        "Unable to update business profile:",
        error
      );

      setBusinessError(
        error.message ||
        "Your business profile could not be updated."
      );

    } finally {
      setSavingBusiness(false);
    }
  }


  /* =========================================================
     Security handlers
     ========================================================= */

  function handlePasswordChange(event) {
    const {
      name,
      value,
    } = event.target;

    setPasswordForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

    setSecurityMessage("");
    setSecurityError("");
  }


  async function handleUpdatePassword(event) {
    event.preventDefault();

    if (
      passwordForm.password.length < 8
    ) {
      setSecurityError(
        "Your new password must contain at least 8 characters."
      );

      return;
    }


    if (
      passwordForm.password !==
      passwordForm.confirmPassword
    ) {
      setSecurityError(
        "The passwords do not match."
      );

      return;
    }


    try {
      setSavingPassword(true);

      setSecurityMessage("");
      setSecurityError("");


      const {
        error: passwordError,
      } = await supabase.auth.updateUser({
        password:
          passwordForm.password,
      });


      if (passwordError) {
        throw passwordError;
      }


      setPasswordForm({
        password: "",
        confirmPassword: "",
      });


      setSecurityMessage(
        "Your password has been updated successfully."
      );

    } catch (error) {
      console.error(
        "Unable to update password:",
        error
      );

      setSecurityError(
        error.message ||
        "Your password could not be updated."
      );

    } finally {
      setSavingPassword(false);
    }
  }


  async function handleSignOut() {
    try {
      if (signOut) {
        await signOut();
      } else {
        await supabase.auth.signOut();
      }

      navigate(
        "/login",
        {
          replace: true,
        }
      );

    } catch (error) {
      console.error(
        "Unable to sign out:",
        error
      );

      setSecurityError(
        error.message ||
        "Unable to sign out."
      );
    }
  }


  /* =========================================================
     Helpers
     ========================================================= */

  function formatCalendarDate(value) {
    if (!value) {
      return "Not available";
    }

    return new Date(value).toLocaleString(
      "en-NZ",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }


  function renderStatusMessage(
    message,
    error
  ) {
    if (error) {
      return (
        <div className="settings-status settings-status--error">
          {error}
        </div>
      );
    }

    if (message) {
      return (
        <div className="settings-status settings-status--success">
          <BiCheckCircle
            aria-hidden="true"
          />

          <span>
            {message}
          </span>
        </div>
      );
    }

    return null;
  }


  /* =========================================================
     Loading state
     ========================================================= */

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <span className="settings-spinner" />

          <p>
            Loading settings...
          </p>
        </div>
      </div>
    );
  }


  /* =========================================================
     Load error
     ========================================================= */

  if (loadError) {
    return (
      <div className="settings-page">
        <div className="settings-load-error">
          <BiShield
            aria-hidden="true"
          />

          <h2>
            Unable to load settings
          </h2>

          <p>
            {loadError}
          </p>

          <button
            type="button"
            onClick={
              loadSettings
            }
          >
            <BiRefresh
              aria-hidden="true"
            />

            Try again
          </button>
        </div>
      </div>
    );
  }


  /* =========================================================
     Section content
     ========================================================= */

  function renderAccountSection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Personal details
            </span>

            <h2>
              Account
            </h2>

            <p>
              Manage the personal information associated
              with your LensFlow account.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiUser
              aria-hidden="true"
            />
          </div>
        </div>


        <form
          className="settings-form"
          onSubmit={
            handleSaveAccount
          }
        >
          <div className="settings-form-grid">

            <div className="settings-field">
              <label htmlFor="settings-first-name">
                First name
              </label>

              <input
                id="settings-first-name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                value={
                  accountForm.first_name
                }
                onChange={
                  handleAccountChange
                }
                required
              />
            </div>


            <div className="settings-field">
              <label htmlFor="settings-last-name">
                Last name
              </label>

              <input
                id="settings-last-name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                value={
                  accountForm.last_name
                }
                onChange={
                  handleAccountChange
                }
                required
              />
            </div>


            <div className="settings-field settings-field--full">
              <label htmlFor="settings-account-email">
                Account email
              </label>

              <input
                id="settings-account-email"
                name="email"
                type="email"
                autoComplete="email"
                value={
                  accountForm.email
                }
                onChange={
                  handleAccountChange
                }
                required
              />

              <span className="settings-field-help">
                Changing your login email may require
                confirmation through Supabase Auth.
              </span>
            </div>


            <div className="settings-field settings-field--full">
              <label htmlFor="settings-account-phone">
                Phone
              </label>

              <input
                id="settings-account-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={
                  accountForm.phone
                }
                onChange={
                  handleAccountChange
                }
                placeholder="Optional"
              />
            </div>

          </div>


          {renderStatusMessage(
            accountMessage,
            accountError
          )}


          <div className="settings-form-actions">
            <button
              type="submit"
              className="settings-primary-button"
              disabled={
                savingAccount
              }
            >
              <BiSave
                aria-hidden="true"
              />

              {savingAccount
                ? "Saving..."
                : "Save Account"}
            </button>
          </div>
        </form>
      </>
    );
  }


  function renderBusinessSection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Business details
            </span>

            <h2>
              Business Profile
            </h2>

            <p>
              Manage the core contact and business
              information used throughout LensFlow.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiBuilding
              aria-hidden="true"
            />
          </div>
        </div>


        <form
          className="settings-form"
          onSubmit={
            handleSaveBusiness
          }
        >
          <div className="settings-form-grid">

            <div className="settings-field settings-field--full">
              <label htmlFor="settings-business-name">
                Business name
              </label>

              <input
                id="settings-business-name"
                name="business_name"
                type="text"
                value={
                  businessForm.business_name
                }
                onChange={
                  handleBusinessChange
                }
                required
              />
            </div>


            <div className="settings-field">
              <label htmlFor="settings-business-email">
                Business email
              </label>

              <input
                id="settings-business-email"
                name="email"
                type="email"
                value={
                  businessForm.email
                }
                onChange={
                  handleBusinessChange
                }
                required
              />
            </div>


            <div className="settings-field">
              <label htmlFor="settings-business-phone">
                Business phone
              </label>

              <input
                id="settings-business-phone"
                name="phone"
                type="tel"
                value={
                  businessForm.phone
                }
                onChange={
                  handleBusinessChange
                }
                placeholder="Optional"
              />
            </div>


            <div className="settings-field settings-field--full">
              <label htmlFor="settings-business-address">
                Address
              </label>

              <textarea
                id="settings-business-address"
                name="address"
                rows="3"
                value={
                  businessForm.address
                }
                onChange={
                  handleBusinessChange
                }
                placeholder="Business address"
              />
            </div>


            <div className="settings-field settings-field--full">
              <label htmlFor="settings-business-website">
                Website URL
              </label>

              <input
                id="settings-business-website"
                name="website_url"
                type="url"
                value={
                  businessForm.website_url
                }
                onChange={
                  handleBusinessChange
                }
                placeholder="https://example.com"
              />
            </div>


            <div className="settings-field settings-field--full">
              <label htmlFor="settings-business-description">
                Business description
              </label>

              <textarea
                id="settings-business-description"
                name="description"
                rows="6"
                value={
                  businessForm.description
                }
                onChange={
                  handleBusinessChange
                }
                placeholder="Tell clients about your photography business..."
              />
            </div>

          </div>


          {renderStatusMessage(
            businessMessage,
            businessError
          )}


          <div className="settings-form-actions">
            <button
              type="submit"
              className="settings-primary-button"
              disabled={
                savingBusiness
              }
            >
              <BiSave
                aria-hidden="true"
              />

              {savingBusiness
                ? "Saving..."
                : "Save Business Profile"}
            </button>
          </div>
        </form>
      </>
    );
  }


  function renderNotificationsSection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Alerts
            </span>

            <h2>
              Notifications
            </h2>

            <p>
              Review the notification features currently
              available in LensFlow.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiBell
              aria-hidden="true"
            />
          </div>
        </div>


        <div className="settings-option-list">

          <div className="settings-option-card">
            <div className="settings-option-icon">
              <BiBell
                aria-hidden="true"
              />
            </div>

            <div className="settings-option-content">
              <div className="settings-option-title">
                <div>
                  <h3>
                    In-app message notifications
                  </h3>

                  <p>
                    Unread client messages are displayed
                    using the notification bell in the
                    LensFlow header.
                  </p>
                </div>

                <span className="settings-status-pill settings-status-pill--active">
                  Enabled
                </span>
              </div>
            </div>
          </div>


          <div className="settings-option-card">
            <div className="settings-option-icon">
              <BiBell
                aria-hidden="true"
              />
            </div>

            <div className="settings-option-content">
              <div className="settings-option-title">
                <div>
                  <h3>
                    Email notifications
                  </h3>

                  <p>
                    Email alerts for new messages,
                    bookings and other LensFlow activity
                    will be added in a future integration.
                  </p>
                </div>

                <span className="settings-status-pill">
                  Coming soon
                </span>
              </div>
            </div>
          </div>

        </div>
      </>
    );
  }


  function renderPaymentsSection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Payment processing
            </span>

            <h2>
              Payments
            </h2>

            <p>
              Manage payment integrations used for
              bookings and invoices.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiCreditCard
              aria-hidden="true"
            />
          </div>
        </div>


        <div className="settings-integration-card">
          <div className="settings-integration-top">
            <div className="settings-integration-icon">
              <BiCreditCard
                aria-hidden="true"
              />
            </div>

            <div>
              <span className="settings-integration-label">
                Payment provider
              </span>

              <h3>
                Stripe
              </h3>
            </div>

            <span className="settings-status-pill">
              Not connected
            </span>
          </div>


          <p className="settings-integration-description">
            Stripe integration will allow clients to
            securely pay invoices and booking payments
            online through LensFlow.
          </p>


          <div className="settings-coming-soon">
            Stripe integration is planned for a future
            LensFlow release.
          </div>
        </div>
      </>
    );
  }


  function renderCalendarSection() {
    const isConnected =
      Boolean(
        calendarIntegration &&
        calendarIntegration.is_active
      );

    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Scheduling
            </span>

            <h2>
              Calendar
            </h2>

            <p>
              Review your Google Calendar integration
              status.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiCalendar
              aria-hidden="true"
            />
          </div>
        </div>


        <div className="settings-integration-card">

          <div className="settings-integration-top">
            <div className="settings-integration-icon">
              <BiCalendar
                aria-hidden="true"
              />
            </div>

            <div>
              <span className="settings-integration-label">
                Calendar provider
              </span>

              <h3>
                Google Calendar
              </h3>
            </div>

            <span
              className={`settings-status-pill ${
                isConnected
                  ? "settings-status-pill--active"
                  : ""
              }`}
            >
              {isConnected
                ? "Connected"
                : "Not connected"}
            </span>
          </div>


          {calendarIntegration ? (
            <div className="settings-detail-list">

              <div className="settings-detail-row">
                <span>
                  Calendar ID
                </span>

                <strong>
                  {calendarIntegration.calendar_id ||
                    "Not assigned"}
                </strong>
              </div>


              <div className="settings-detail-row">
                <span>
                  Integration status
                </span>

                <strong>
                  {calendarIntegration.is_active
                    ? "Active"
                    : "Inactive"}
                </strong>
              </div>


              <div className="settings-detail-row">
                <span>
                  Provider
                </span>

                <strong>
                  Google
                </strong>
              </div>


              <div className="settings-detail-row">
                <span>
                  Last updated
                </span>

                <strong>
                  {formatCalendarDate(
                    calendarIntegration.updated_at
                  )}
                </strong>
              </div>

            </div>
          ) : (
            <div className="settings-empty-integration">
              <BiCalendar
                aria-hidden="true"
              />

              <h3>
                Google Calendar is not connected
              </h3>

              <p>
                Calendar authentication will allow
                LensFlow bookings to synchronize with
                your Google Calendar.
              </p>

              <span>
                OAuth integration coming soon
              </span>
            </div>
          )}

        </div>
      </>
    );
  }


  function renderSecuritySection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Account protection
            </span>

            <h2>
              Security
            </h2>

            <p>
              Update your password or manage your
              current LensFlow session.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiShield
              aria-hidden="true"
            />
          </div>
        </div>


        <div className="settings-security-grid">

          <form
            className="settings-security-card"
            onSubmit={
              handleUpdatePassword
            }
          >
            <div className="settings-security-card-heading">
              <BiLockAlt
                aria-hidden="true"
              />

              <div>
                <h3>
                  Change password
                </h3>

                <p>
                  Choose a strong password with at
                  least 8 characters.
                </p>
              </div>
            </div>


            <div className="settings-field">
              <label htmlFor="settings-password">
                New password
              </label>

              <input
                id="settings-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={
                  passwordForm.password
                }
                onChange={
                  handlePasswordChange
                }
                minLength="8"
                required
              />
            </div>


            <div className="settings-field">
              <label htmlFor="settings-confirm-password">
                Confirm new password
              </label>

              <input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={
                  passwordForm.confirmPassword
                }
                onChange={
                  handlePasswordChange
                }
                minLength="8"
                required
              />
            </div>


            {renderStatusMessage(
              securityMessage,
              securityError
            )}


            <button
              type="submit"
              className="settings-primary-button"
              disabled={
                savingPassword
              }
            >
              <BiLockAlt
                aria-hidden="true"
              />

              {savingPassword
                ? "Updating..."
                : "Update Password"}
            </button>
          </form>


          <div className="settings-security-card">
            <div className="settings-security-card-heading">
              <BiLogOut
                aria-hidden="true"
              />

              <div>
                <h3>
                  Sign out
                </h3>

                <p>
                  End your current LensFlow session on
                  this device.
                </p>
              </div>
            </div>


            <div className="settings-security-session">
              <span>
                Signed in as
              </span>

              <strong>
                {accountForm.email}
              </strong>
            </div>


            <button
              type="button"
              className="settings-secondary-button settings-signout-button"
              onClick={
                handleSignOut
              }
            >
              <BiLogOut
                aria-hidden="true"
              />

              Sign Out
            </button>
          </div>

        </div>
      </>
    );
  }


  function renderWebsiteSection() {
    return (
      <>
        <div className="settings-section-heading">
          <div>
            <span className="settings-section-eyebrow">
              Public presence
            </span>

            <h2>
              Website
            </h2>

            <p>
              Manage your public LensFlow photography
              website.
            </p>
          </div>

          <div className="settings-heading-icon">
            <BiGlobe
              aria-hidden="true"
            />
          </div>
        </div>


        <div className="settings-website-card">

          <div className="settings-website-icon">
            <BiGlobe
              aria-hidden="true"
            />
          </div>


          <div className="settings-website-content">
            <span>
              LensFlow Website Builder
            </span>

            <h3>
              Manage your photography website
            </h3>

            <p>
              Configure your hero section, portfolio,
              About content, services, reviews, contact
              details, typography and other public
              website options from the Website Builder.
            </p>


            <button
              type="button"
              className="settings-primary-button"
              onClick={() =>
                navigate(
                  "/photographer/website"
                )
              }
            >
              <BiGlobe
                aria-hidden="true"
              />

              Open Website Builder
            </button>
          </div>

        </div>
      </>
    );
  }


  function renderActiveSection() {
    switch (activeSection) {
      case "business":
        return renderBusinessSection();

      case "notifications":
        return renderNotificationsSection();

      case "payments":
        return renderPaymentsSection();

      case "calendar":
        return renderCalendarSection();

      case "security":
        return renderSecuritySection();

      case "website":
        return renderWebsiteSection();

      case "account":
      default:
        return renderAccountSection();
    }
  }


  /* =========================================================
     Page
     ========================================================= */

  return (
    <div className="settings-page">

      {/* =====================================================
          Header
          ===================================================== */}

      <section className="settings-page-header">

        <span className="settings-page-eyebrow">
          Preferences
        </span>

        <h1>
          Settings
        </h1>

        <p>
          Manage your LensFlow account, business
          information, integrations and security.
        </p>

      </section>


      {/* =====================================================
          Settings layout
          ===================================================== */}

      <section className="settings-layout">

        {/* Navigation */}

        <aside className="settings-navigation">

          <div className="settings-navigation-heading">
            <span>
              Settings
            </span>
          </div>


          <nav
            className="settings-navigation-list"
            aria-label="Settings sections"
          >
            {SETTINGS_SECTIONS.map(
              (section) => {
                const Icon =
                  section.icon;

                const isActive =
                  activeSection ===
                  section.id;

                return (
                  <button
                    key={
                      section.id
                    }
                    type="button"
                    className={
                      isActive
                        ? "settings-nav-button is-active"
                        : "settings-nav-button"
                    }
                    onClick={() =>
                      setActiveSection(
                        section.id
                      )
                    }
                  >
                    <Icon
                      aria-hidden="true"
                    />

                    <span>
                      {section.label}
                    </span>
                  </button>
                );
              }
            )}
          </nav>

        </aside>


        {/* Main panel */}

        <div className="settings-panel">
          {renderActiveSection()}
        </div>

      </section>

    </div>
  );
}