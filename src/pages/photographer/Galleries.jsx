import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./Galleries.css";

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function getClientName(profile) {
  if (!profile) return "Unknown client";

  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || profile.email || "Unknown client";
}

function formatMediaCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function getInitials(name) {
  if (!name || name === "Unknown client") return "?";

  const parts = name.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(
    0
  )}`.toUpperCase();
}

function getGalleryStatus(isPublished) {
  return isPublished ? "Published" : "Unpublished";
}

export default function Galleries() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [photographerId, setPhotographerId] = useState(null);
  const [galleries, setGalleries] = useState([]);
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [media, setMedia] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadGalleries() {
      if (!user?.id) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        // -------------------------------------------------------
        // 1. Get photographer profile
        // -------------------------------------------------------
        const { data: photographer, error: photographerError } =
          await supabase
            .from("photographer_profiles")
            .select("photographer_id")
            .eq("user_id", user.id)
            .single();

        if (photographerError) {
          throw photographerError;
        }

        if (!photographer?.photographer_id) {
          throw new Error("Photographer profile could not be found.");
        }

        const currentPhotographerId = photographer.photographer_id;

        // -------------------------------------------------------
        // 2. Load photographer galleries
        // -------------------------------------------------------
        const { data: galleryData, error: galleryError } = await supabase
          .from("galleries")
          .select(`
            gallery_id,
            photographer_id,
            client_id,
            booking_id,
            name,
            description,
            is_published,
            allow_downloads,
            created_at,
            updated_at
          `)
          .eq("photographer_id", currentPhotographerId)
          .order("updated_at", { ascending: false });

        if (galleryError) {
          throw galleryError;
        }

        const loadedGalleries = galleryData || [];

        // -------------------------------------------------------
        // 3. Load photographer clients
        // -------------------------------------------------------
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select(`
            client_id,
            user_id
          `)
          .eq("photographer_id", currentPhotographerId);

        if (clientError) {
          throw clientError;
        }

        const loadedClients = clientData || [];

        // -------------------------------------------------------
        // 4. Load related profiles
        // -------------------------------------------------------
        const clientUserIds = [
          ...new Set(
            loadedClients
              .map((client) => client.user_id)
              .filter(Boolean)
          ),
        ];

        let loadedProfiles = [];

        if (clientUserIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select(`
              user_id,
              first_name,
              last_name,
              email,
              phone
            `)
            .in("user_id", clientUserIds);

          if (profileError) {
            throw profileError;
          }

          loadedProfiles = profileData || [];
        }

        // -------------------------------------------------------
        // 5. Load bookings
        // -------------------------------------------------------
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(`
            booking_id,
            client_id,
            service_id,
            booking_date,
            start_time,
            end_time,
            location,
            status,
            total_amount
          `)
          .eq("photographer_id", currentPhotographerId)
          .order("booking_date", { ascending: false });

        if (bookingError) {
          throw bookingError;
        }

        const loadedBookings = bookingData || [];

        // -------------------------------------------------------
        // 6. Load media for media counts
        // -------------------------------------------------------
        const galleryIds = loadedGalleries.map(
          (gallery) => gallery.gallery_id
        );

        let loadedMedia = [];

        if (galleryIds.length > 0) {
          const { data: mediaData, error: mediaError } = await supabase
            .from("media")
            .select(`
              media_id,
              gallery_id,
              media_type,
              is_downloadable,
              uploaded_at
            `)
            .in("gallery_id", galleryIds);

          if (mediaError) {
            throw mediaError;
          }

          loadedMedia = mediaData || [];
        }

        if (!isMounted) return;

        setPhotographerId(currentPhotographerId);
        setGalleries(loadedGalleries);
        setClients(loadedClients);
        setProfiles(loadedProfiles);
        setBookings(loadedBookings);
        setMedia(loadedMedia);
      } catch (error) {
        console.error("Error loading galleries:", error);

        if (isMounted) {
          setErrorMessage(
            error?.message ||
              "Unable to load your galleries. Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadGalleries();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // -------------------------------------------------------------
  // Create lookup maps
  // -------------------------------------------------------------

  const clientMap = useMemo(() => {
    const map = new Map();

    clients.forEach((client) => {
      const profile = profiles.find(
        (item) => item.user_id === client.user_id
      );

      map.set(client.client_id, {
        ...client,
        profile,
      });
    });

    return map;
  }, [clients, profiles]);

  const bookingMap = useMemo(() => {
    const map = new Map();

    bookings.forEach((booking) => {
      map.set(booking.booking_id, booking);
    });

    return map;
  }, [bookings]);

  const mediaCountMap = useMemo(() => {
    const map = new Map();

    media.forEach((item) => {
      const currentCount = map.get(item.gallery_id) || 0;
      map.set(item.gallery_id, currentCount + 1);
    });

    return map;
  }, [media]);

  const photoCountMap = useMemo(() => {
    const map = new Map();

    media.forEach((item) => {
      if (item.media_type !== "video") {
        const currentCount = map.get(item.gallery_id) || 0;
        map.set(item.gallery_id, currentCount + 1);
      }
    });

    return map;
  }, [media]);

  const videoCountMap = useMemo(() => {
    const map = new Map();

    media.forEach((item) => {
      if (item.media_type === "video") {
        const currentCount = map.get(item.gallery_id) || 0;
        map.set(item.gallery_id, currentCount + 1);
      }
    });

    return map;
  }, [media]);

  // -------------------------------------------------------------
  // Enhance gallery records
  // -------------------------------------------------------------

  const enrichedGalleries = useMemo(() => {
    return galleries.map((gallery) => {
      const client = clientMap.get(gallery.client_id);
      const booking = bookingMap.get(gallery.booking_id);

      const clientName = getClientName(client?.profile);

      return {
        ...gallery,
        clientName,
        clientEmail: client?.profile?.email || "",
        booking,
        mediaCount: mediaCountMap.get(gallery.gallery_id) || 0,
        photoCount: photoCountMap.get(gallery.gallery_id) || 0,
        videoCount: videoCountMap.get(gallery.gallery_id) || 0,
      };
    });
  }, [
    galleries,
    clientMap,
    bookingMap,
    mediaCountMap,
    photoCountMap,
    videoCountMap,
  ]);

  // -------------------------------------------------------------
  // Filter galleries
  // -------------------------------------------------------------

  const filteredGalleries = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return enrichedGalleries.filter((gallery) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && gallery.is_published) ||
        (statusFilter === "unpublished" && !gallery.is_published);

      if (!matchesStatus) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        gallery.name,
        gallery.description,
        gallery.clientName,
        gallery.clientEmail,
        gallery.booking?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [enrichedGalleries, searchTerm, statusFilter]);

  // -------------------------------------------------------------
  // Summary statistics
  // -------------------------------------------------------------

  const totalGalleries = galleries.length;

  const publishedGalleries = galleries.filter(
    (gallery) => gallery.is_published
  ).length;

  const unpublishedGalleries = galleries.filter(
    (gallery) => !gallery.is_published
  ).length;

  const totalMedia = media.length;

  // -------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------

  const handleCreateGallery = () => {
    navigate("/photographer/galleries/new");
  };

  const handleViewGallery = (galleryId) => {
    navigate(`/photographer/galleries/${galleryId}`);
  };

  const handleEditGallery = (galleryId) => {
    navigate(`/photographer/galleries/${galleryId}/edit`);
  };

  // -------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------

  if (loading) {
    return (
      <div className="galleries-page">
        <div className="galleries-loading">
          <div className="galleries-spinner"></div>
          <p>Loading galleries...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------

  if (errorMessage) {
    return (
      <div className="galleries-page">
        <div className="galleries-header">
          <div>
            <p className="galleries-eyebrow">Client delivery</p>
            <h1>Galleries</h1>
            <p className="galleries-description">
              Manage your client galleries and delivered photography.
            </p>
          </div>
        </div>

        <div className="galleries-message error-message">
          <strong>Unable to load galleries</strong>
          <span>{errorMessage}</span>
          <button
            type="button"
            className="galleries-retry-button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="galleries-page">
      {/* ========================================================
          HEADER
      ======================================================== */}
      <header className="galleries-header">
        <div>
          <p className="galleries-eyebrow">Client delivery</p>

          <h1>Galleries</h1>

          <p className="galleries-description">
            Manage your client galleries, delivered media and download
            access.
          </p>
        </div>

        <button
          type="button"
          className="galleries-primary-button"
          onClick={handleCreateGallery}
        >
          <span className="galleries-button-icon">+</span>
          New Gallery
        </button>
      </header>

      {/* ========================================================
          SUMMARY CARDS
      ======================================================== */}
      <section className="galleries-summary">
        <div className="gallery-summary-card">
          <div className="gallery-summary-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="m21 15-4.5-4.5L8 19" />
            </svg>
          </div>

          <div>
            <span>Total Galleries</span>
            <strong>{totalGalleries}</strong>
          </div>
        </div>

        <div className="gallery-summary-card">
          <div className="gallery-summary-icon published">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <div>
            <span>Published</span>
            <strong>{publishedGalleries}</strong>
          </div>
        </div>

        <div className="gallery-summary-card">
          <div className="gallery-summary-icon unpublished">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>

          <div>
            <span>Unpublished</span>
            <strong>{unpublishedGalleries}</strong>
          </div>
        </div>

        <div className="gallery-summary-card">
          <div className="gallery-summary-icon media">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>

          <div>
            <span>Total Media</span>
            <strong>{totalMedia}</strong>
          </div>
        </div>
      </section>

      {/* ========================================================
          TOOLBAR
      ======================================================== */}
      <section className="galleries-toolbar">
        <div className="galleries-search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>

          <input
            type="text"
            placeholder="Search galleries or clients..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searchTerm && (
            <button
              type="button"
              className="galleries-clear-search"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="galleries-filter-tabs">
          <button
            type="button"
            className={
              statusFilter === "all"
                ? "gallery-filter active"
                : "gallery-filter"
            }
            onClick={() => setStatusFilter("all")}
          >
            All
            <span>{totalGalleries}</span>
          </button>

          <button
            type="button"
            className={
              statusFilter === "published"
                ? "gallery-filter active"
                : "gallery-filter"
            }
            onClick={() => setStatusFilter("published")}
          >
            Published
            <span>{publishedGalleries}</span>
          </button>

          <button
            type="button"
            className={
              statusFilter === "unpublished"
                ? "gallery-filter active"
                : "gallery-filter"
            }
            onClick={() => setStatusFilter("unpublished")}
          >
            Unpublished
            <span>{unpublishedGalleries}</span>
          </button>
        </div>
      </section>

      {/* ========================================================
          RESULTS
      ======================================================== */}
      <section className="galleries-content">
        {filteredGalleries.length === 0 ? (
          <div className="galleries-empty">
            <div className="galleries-empty-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="8.5" cy="9" r="1.5" />
                <path d="m21 15-4.5-4.5L8 19" />
              </svg>
            </div>

            <h2>
              {searchTerm || statusFilter !== "all"
                ? "No galleries found"
                : "No galleries yet"}
            </h2>

            <p>
              {searchTerm || statusFilter !== "all"
                ? "Try changing your search or filter."
                : "Create your first client gallery to start delivering photography."}
            </p>

            {!searchTerm && statusFilter === "all" && (
              <button
                type="button"
                className="galleries-primary-button"
                onClick={handleCreateGallery}
              >
                <span className="galleries-button-icon">+</span>
                Create Your First Gallery
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="galleries-results-heading">
              <div>
                <h2>Your Galleries</h2>
                <span>
                  Showing {filteredGalleries.length}{" "}
                  {filteredGalleries.length === 1
                    ? "gallery"
                    : "galleries"}
                </span>
              </div>
            </div>

            <div className="galleries-grid">
              {filteredGalleries.map((gallery) => {
                const clientName = gallery.clientName;
                const bookingDate = gallery.booking?.booking_date;

                return (
                  <article
                    className="gallery-card"
                    key={gallery.gallery_id}
                  >
                    {/* ------------------------------------------------
                        CARD PREVIEW
                    ------------------------------------------------ */}
                    <div className="gallery-card-preview">
                      <div className="gallery-preview-placeholder">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="16"
                            rx="2"
                          />
                          <circle cx="8.5" cy="9" r="1.5" />
                          <path d="m21 15-4.5-4.5L8 19" />
                        </svg>

                        <span>
                          {gallery.mediaCount > 0
                            ? `${gallery.mediaCount} media`
                            : "No media yet"}
                        </span>
                      </div>

                      <span
                        className={
                          gallery.is_published
                            ? "gallery-status published"
                            : "gallery-status unpublished"
                        }
                      >
                        <span className="gallery-status-dot"></span>
                        {getGalleryStatus(gallery.is_published)}
                      </span>
                    </div>

                    {/* ------------------------------------------------
                        CARD CONTENT
                    ------------------------------------------------ */}
                    <div className="gallery-card-content">
                      <div className="gallery-card-heading">
                        <div>
                          <h3>{gallery.name}</h3>

                          {gallery.description && (
                            <p>{gallery.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Client */}
                      <div className="gallery-client">
                        <div className="gallery-client-avatar">
                          {getInitials(clientName)}
                        </div>

                        <div>
                          <span>Client</span>
                          <strong>{clientName}</strong>
                        </div>
                      </div>

                      {/* Gallery metadata */}
                      <div className="gallery-meta">
                        <div className="gallery-meta-item">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="17"
                              rx="2"
                            />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>

                          <div>
                            <span>Booking</span>
                            <strong>
                              {bookingDate
                                ? formatDate(bookingDate)
                                : "No booking"}
                            </strong>
                          </div>
                        </div>

                        <div className="gallery-meta-item">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                            />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>

                          <div>
                            <span>Media</span>
                            <strong>
                              {formatMediaCount(gallery.mediaCount)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Media breakdown */}
                      <div className="gallery-media-breakdown">
                        <span>
                          <strong>{gallery.photoCount}</strong>{" "}
                          {gallery.photoCount === 1 ? "photo" : "photos"}
                        </span>

                        <span className="gallery-breakdown-divider">
                          •
                        </span>

                        <span>
                          <strong>{gallery.videoCount}</strong>{" "}
                          {gallery.videoCount === 1 ? "video" : "videos"}
                        </span>
                      </div>

                      {/* Download access */}
                      <div className="gallery-download-status">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M12 3v12" />
                          <path d="m7 10 5 5 5-5" />
                          <path d="M5 21h14" />
                        </svg>

                        <span>
                          Downloads{" "}
                          <strong>
                            {gallery.allow_downloads
                              ? "Enabled"
                              : "Disabled"}
                          </strong>
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="gallery-card-actions">
                        <button
                          type="button"
                          className="gallery-view-button"
                          onClick={() =>
                            handleViewGallery(gallery.gallery_id)
                          }
                        >
                          View Gallery
                        </button>

                        <button
                          type="button"
                          className="gallery-edit-button"
                          onClick={() =>
                            handleEditGallery(gallery.gallery_id)
                          }
                          aria-label={`Edit ${gallery.name}`}
                          title="Edit gallery"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="gallery-card-footer">
                      Updated {formatDate(gallery.updated_at)}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}