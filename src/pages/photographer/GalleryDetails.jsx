import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./GalleryDetails.css";

const MAX_PHOTO_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 250 * 1024 * 1024; // 250 MB

const ALLOWED_PHOTO_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const ALLOWED_VIDEO_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
];

const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-NZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// ------------------------------------------------------------
// Get the client name from the linked profile.
// ------------------------------------------------------------
const getClientName = (client) => {
    if (!client) return "Unknown client";

    const profile = client.profile;

    if (profile?.first_name || profile?.last_name) {
        return `${profile.first_name || ""} ${profile.last_name || ""
            }`.trim();
    }

    if (profile?.email) {
        return profile.email;
    }

    return "Unknown client";
};

const getBookingDate = (booking) => {
    if (!booking) return null;

    return (
        booking.booking_date ||
        booking.date ||
        booking.scheduled_date ||
        booking.start_date ||
        null
    );
};

const getBookingTime = (booking) => {
    if (!booking) return null;

    return (
        booking.start_time ||
        booking.booking_time ||
        booking.time ||
        null
    );
};

const getMediaType = (media) => {
    if (!media) return "image";

    if (media.media_type === "video") return "video";

    if (
        media.mime_type &&
        media.mime_type.toLowerCase().startsWith("video/")
    ) {
        return "video";
    }

    return "image";
};

const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "—";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]
        }`;
};

// ------------------------------------------------------------
// Create a safe filename for Supabase Storage.
// ------------------------------------------------------------
const sanitiseFileName = (fileName) => {
    const extension = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf("."))
        : "";

    const baseName = fileName
        .substring(
            0,
            fileName.length - extension.length
        )
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return `${baseName || "media"}${extension.toLowerCase()}`;
};

export default function GalleryDetails() {
    const { gallery_id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const fileInputRef = useRef(null);

    const [gallery, setGallery] = useState(null);
    const [client, setClient] = useState(null);
    const [booking, setBooking] = useState(null);
    const [media, setMedia] = useState([]);

    const [photographerId, setPhotographerId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [deletingMediaId, setDeletingMediaId] =
        useState(null);
    const [deletingGallery, setDeletingGallery] =
        useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ------------------------------------------------------------
    // Generate signed URLs for private gallery media.
    // ------------------------------------------------------------
    const addSignedUrls = useCallback(async (mediaItems) => {
        if (!mediaItems?.length) {
            return [];
        }

        const mediaWithUrls = await Promise.all(
            mediaItems.map(async (mediaItem) => {
                if (!mediaItem.storage_path) {
                    return {
                        ...mediaItem,
                        signedUrl: null,
                    };
                }

                const { data, error: signedUrlError } =
                    await supabase.storage
                        .from("client-media")
                        .createSignedUrl(
                            mediaItem.storage_path,
                            60 * 60
                        );

                if (signedUrlError) {
                    console.warn(
                        "Unable to create signed URL:",
                        signedUrlError
                    );

                    return {
                        ...mediaItem,
                        signedUrl: null,
                    };
                }

                return {
                    ...mediaItem,
                    signedUrl: data?.signedUrl || null,
                };
            })
        );

        return mediaWithUrls;
    }, []);

    // ------------------------------------------------------------
    // Load gallery
    // ------------------------------------------------------------
    const loadGallery = useCallback(async () => {
        if (!user?.id || !gallery_id) return;

        try {
            setLoading(true);
            setError("");
            setSuccess("");

            // --------------------------------------------------------
            // 1. Get photographer profile
            // --------------------------------------------------------
            const {
                data: photographer,
                error: photographerError,
            } = await supabase
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

            setPhotographerId(photographer.photographer_id);

            // --------------------------------------------------------
            // 2. Get gallery
            // --------------------------------------------------------
            const {
                data: galleryData,
                error: galleryError,
            } = await supabase
                .from("galleries")
                .select("*")
                .eq("gallery_id", gallery_id)
                .eq(
                    "photographer_id",
                    photographer.photographer_id
                )
                .single();

            if (galleryError) {
                throw galleryError;
            }

            if (!galleryData) {
                throw new Error("Gallery could not be found.");
            }

            setGallery(galleryData);

            // --------------------------------------------------------
            // 3. Get client
            // --------------------------------------------------------
            setClient(null);

            if (galleryData.client_id) {
                const {
                    data: clientData,
                    error: clientError,
                } = await supabase
                    .from("clients")
                    .select("client_id, user_id")
                    .eq("client_id", galleryData.client_id)
                    .eq(
                        "photographer_id",
                        photographer.photographer_id
                    )
                    .single();

                if (clientError) {
                    throw clientError;
                }

                if (clientData) {
                    let clientWithProfile = clientData;

                    if (clientData.user_id) {
                        const {
                            data: profileData,
                            error: profileError,
                        } = await supabase
                            .from("profiles")
                            .select(
                                "user_id, first_name, last_name, email, phone"
                            )
                            .eq("user_id", clientData.user_id)
                            .single();

                        if (profileError) {
                            throw profileError;
                        }

                        if (profileData) {
                            clientWithProfile = {
                                ...clientData,
                                profile: profileData,
                            };
                        }
                    }

                    setClient(clientWithProfile);
                }
            }

            // --------------------------------------------------------
            // 4. Get booking
            // --------------------------------------------------------
            setBooking(null);

            if (galleryData.booking_id) {
                const {
                    data: bookingData,
                    error: bookingError,
                } = await supabase
                    .from("bookings")
                    .select("*")
                    .eq("booking_id", galleryData.booking_id)
                    .eq(
                        "photographer_id",
                        photographer.photographer_id
                    )
                    .single();

                if (!bookingError) {
                    setBooking(bookingData);
                }
            }

            // --------------------------------------------------------
            // 5. Get gallery media
            // --------------------------------------------------------
            const {
                data: mediaData,
                error: mediaError,
            } = await supabase
                .from("media")
                .select("*")
                .eq("gallery_id", galleryData.gallery_id)
                .eq(
                    "photographer_id",
                    photographer.photographer_id
                )
                .order("uploaded_at", {
                    ascending: false,
                });

            if (mediaError) {
                throw mediaError;
            }

            const mediaWithUrls = await addSignedUrls(
                mediaData || []
            );

            setMedia(mediaWithUrls);
        } catch (err) {
            console.error("Error loading gallery:", err);

            setError(
                err?.message ||
                "Unable to load the gallery. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [
        gallery_id,
        user?.id,
        addSignedUrls,
    ]);

    useEffect(() => {
        loadGallery();
    }, [loadGallery]);

    // ------------------------------------------------------------
    // Update gallery settings
    // ------------------------------------------------------------
    const updateGallerySetting = async (
        field,
        value
    ) => {
        if (!gallery || !photographerId) return;

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const {
                data,
                error: updateError,
            } = await supabase
                .from("galleries")
                .update({
                    [field]: value,
                })
                .eq("gallery_id", gallery.gallery_id)
                .eq(
                    "photographer_id",
                    photographerId
                )
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            setGallery(data);

            setSuccess(
                field === "is_published"
                    ? value
                        ? "Gallery published successfully."
                        : "Gallery unpublished successfully."
                    : value
                        ? "Client downloads enabled."
                        : "Client downloads disabled."
            );

            setTimeout(() => {
                setSuccess("");
            }, 3000);
        } catch (err) {
            console.error(
                "Error updating gallery:",
                err
            );

            setError(
                err?.message ||
                "Unable to update the gallery. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    // ------------------------------------------------------------
    // Open file picker
    // ------------------------------------------------------------
    const openFilePicker = () => {
        if (uploading) return;

        fileInputRef.current?.click();
    };

    // ------------------------------------------------------------
    // Upload media
    // ------------------------------------------------------------
    const handleMediaUpload = async (event) => {
        const selectedFiles = Array.from(
            event.target.files || []
        );

        // Reset input so selecting the same file again works.
        event.target.value = "";

        if (!selectedFiles.length) {
            return;
        }

        if (!photographerId || !gallery) {
            setError(
                "Gallery information is not available. Please refresh the page."
            );
            return;
        }

        try {
            setUploading(true);
            setError("");
            setSuccess("");

            const totalFiles = selectedFiles.length;
            let uploadedCount = 0;

            for (const file of selectedFiles) {
                uploadedCount += 1;

                setUploadProgress(
                    `Uploading ${uploadedCount} of ${totalFiles}: ${file.name}`
                );

                const isPhoto = ALLOWED_PHOTO_TYPES.includes(
                    file.type
                );

                const isVideo = ALLOWED_VIDEO_TYPES.includes(
                    file.type
                );

                // ------------------------------------------------------
                // Validate file type
                // ------------------------------------------------------
                if (!isPhoto && !isVideo) {
                    throw new Error(
                        `"${file.name}" is not a supported file type. Please upload JPG, PNG, WebP, MP4, WebM, or MOV files.`
                    );
                }

                // ------------------------------------------------------
                // Validate file size
                // ------------------------------------------------------
                if (
                    isPhoto &&
                    file.size > MAX_PHOTO_SIZE
                ) {
                    throw new Error(
                        `"${file.name}" is larger than the 25 MB photo limit.`
                    );
                }

                if (
                    isVideo &&
                    file.size > MAX_VIDEO_SIZE
                ) {
                    throw new Error(
                        `"${file.name}" is larger than the 250 MB video limit.`
                    );
                }

                // ------------------------------------------------------
                // Create unique storage path
                // ------------------------------------------------------
                const safeFileName =
                    sanitiseFileName(file.name);

                const uniqueId =
                    typeof crypto !== "undefined" &&
                        crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random()
                            .toString(36)
                            .substring(2)}`;

                const storagePath = [
                    photographerId,
                    gallery.gallery_id,
                    `${uniqueId}-${safeFileName}`,
                ].join("/");

                console.log("UPLOAD DEBUG:", {
                    photographerId,
                    galleryId: gallery.gallery_id,
                    storagePath,
                    currentUserId: user?.id,
                });

                // ------------------------------------------------------
                // Upload to private Supabase Storage bucket
                // ------------------------------------------------------
                const {
                    error: storageError,
                } = await supabase.storage
                    .from("client-media")
                    .upload(storagePath, file, {
                        cacheControl: "3600",
                        upsert: false,
                        contentType: file.type,
                    });

                if (storageError) {
                    throw storageError;
                }

                // ------------------------------------------------------
                // Create media database record
                // ------------------------------------------------------
                const {
                    data: mediaRecord,
                    error: mediaInsertError,
                } = await supabase
                    .from("media")
                    .insert({
                        gallery_id: gallery.gallery_id,
                        photographer_id: photographerId,
                        file_name: file.name,
                        storage_path: storagePath,
                        media_type: isVideo
                            ? "video"
                            : "image",
                        mime_type: file.type,
                        file_size: file.size,
                        is_downloadable: true,
                    })
                    .select()
                    .single();

                if (mediaInsertError) {
                    // Attempt to remove the uploaded file if
                    // the database insert fails.
                    await supabase.storage
                        .from("client-media")
                        .remove([storagePath]);

                    throw mediaInsertError;
                }

                // ------------------------------------------------------
                // Generate signed URL for immediate display
                // ------------------------------------------------------
                let signedUrl = null;

                const {
                    data: signedUrlData,
                } = await supabase.storage
                    .from("client-media")
                    .createSignedUrl(
                        storagePath,
                        60 * 60
                    );

                if (signedUrlData?.signedUrl) {
                    signedUrl =
                        signedUrlData.signedUrl;
                }

                setMedia((currentMedia) => [
                    {
                        ...mediaRecord,
                        signedUrl,
                    },
                    ...currentMedia,
                ]);
            }

            setUploadProgress("");

            setSuccess(
                totalFiles === 1
                    ? "Media uploaded successfully."
                    : `${totalFiles} media files uploaded successfully.`
            );

            setTimeout(() => {
                setSuccess("");
            }, 4000);
        } catch (err) {
            console.error(
                "Error uploading media:",
                err
            );

            setUploadProgress("");

            setError(
                err?.message ||
                "Unable to upload media. Please try again."
            );
        } finally {
            setUploading(false);
        }
    };

    // ------------------------------------------------------------
    // Delete media
    // ------------------------------------------------------------
    const handleDeleteMedia = async (
        mediaItem
    ) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${mediaItem.file_name}"? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeletingMediaId(
                mediaItem.media_id
            );
            setError("");
            setSuccess("");

            // --------------------------------------------------------
            // Remove storage file first.
            // If this fails, keep the database record so the
            // photographer can retry rather than losing the reference.
            // --------------------------------------------------------
            if (mediaItem.storage_path) {
                const {
                    error: storageError,
                } = await supabase.storage
                    .from("client-media")
                    .remove([
                        mediaItem.storage_path,
                    ]);

                if (storageError) {
                    throw storageError;
                }
            }

            // --------------------------------------------------------
            // Remove media database record.
            // --------------------------------------------------------
            const {
                error: mediaError,
            } = await supabase
                .from("media")
                .delete()
                .eq(
                    "media_id",
                    mediaItem.media_id
                )
                .eq(
                    "gallery_id",
                    gallery_id
                )
                .eq(
                    "photographer_id",
                    photographerId
                );

            if (mediaError) {
                throw mediaError;
            }

            setMedia((currentMedia) =>
                currentMedia.filter(
                    (item) =>
                        item.media_id !==
                        mediaItem.media_id
                )
            );

            setSuccess(
                "Media item deleted successfully."
            );

            setTimeout(() => {
                setSuccess("");
            }, 3000);
        } catch (err) {
            console.error(
                "Error deleting media:",
                err
            );

            setError(
                err?.message ||
                "Unable to delete the media item."
            );
        } finally {
            setDeletingMediaId(null);
        }
    };

    // ------------------------------------------------------------
    // Delete entire gallery
    // ------------------------------------------------------------
    const handleDeleteGallery = async () => {
        if (!gallery || !photographerId) {
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to permanently delete the gallery "${gallery.name}"?\n\nAll media associated with this gallery will also be deleted.\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeletingGallery(true);
            setError("");
            setSuccess("");

            // --------------------------------------------------------
            // 1. Get all media belonging to this gallery.
            // --------------------------------------------------------
            const {
                data: galleryMedia,
                error: mediaLookupError,
            } = await supabase
                .from("media")
                .select(
                    "media_id, storage_path"
                )
                .eq(
                    "gallery_id",
                    gallery.gallery_id
                )
                .eq(
                    "photographer_id",
                    photographerId
                );

            if (mediaLookupError) {
                throw mediaLookupError;
            }

            // --------------------------------------------------------
            // 2. Remove files from Supabase Storage.
            // --------------------------------------------------------
            const storagePaths =
                (galleryMedia || [])
                    .map(
                        (item) =>
                            item.storage_path
                    )
                    .filter(Boolean);

            if (storagePaths.length > 0) {
                const {
                    error: storageError,
                } = await supabase.storage
                    .from("client-media")
                    .remove(storagePaths);

                if (storageError) {
                    throw storageError;
                }
            }

            // --------------------------------------------------------
            // 3. Delete media database records.
            // --------------------------------------------------------
            const {
                error: mediaDeleteError,
            } = await supabase
                .from("media")
                .delete()
                .eq(
                    "gallery_id",
                    gallery.gallery_id
                )
                .eq(
                    "photographer_id",
                    photographerId
                );

            if (mediaDeleteError) {
                throw mediaDeleteError;
            }

            // --------------------------------------------------------
            // 4. Delete the gallery itself.
            // --------------------------------------------------------
            const {
                error: galleryDeleteError,
            } = await supabase
                .from("galleries")
                .delete()
                .eq(
                    "gallery_id",
                    gallery.gallery_id
                )
                .eq(
                    "photographer_id",
                    photographerId
                );

            if (galleryDeleteError) {
                throw galleryDeleteError;
            }

            // --------------------------------------------------------
            // 5. Return to Galleries page.
            // --------------------------------------------------------
            navigate(
                "/photographer/galleries"
            );
        } catch (err) {
            console.error(
                "Error deleting gallery:",
                err
            );

            setError(
                err?.message ||
                "Unable to delete the gallery. Please try again."
            );

            setDeletingGallery(false);
        }
    };

    // ------------------------------------------------------------
    // Media statistics
    // ------------------------------------------------------------
    const photoCount = media.filter(
        (item) =>
            getMediaType(item) === "image"
    ).length;

    const videoCount = media.filter(
        (item) =>
            getMediaType(item) === "video"
    ).length;

    // ------------------------------------------------------------
    // Loading state
    // ------------------------------------------------------------
    if (loading) {
        return (
            <div className="gallery-details-page">
                <div className="gallery-details-loading">
                    <div className="gallery-details-spinner"></div>
                    <p>Loading gallery...</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------
    // Error / gallery not found
    // ------------------------------------------------------------
    if (error && !gallery) {
        return (
            <div className="gallery-details-page">
                <div className="gallery-details-error">
                    <div className="gallery-details-error-icon">
                        !
                    </div>

                    <h2>Unable to load gallery</h2>

                    <p>{error}</p>

                    <button
                        className="gallery-details-button primary"
                        onClick={() =>
                            navigate(
                                "/photographer/galleries"
                            )
                        }
                    >
                        Back to Galleries
                    </button>
                </div>
            </div>
        );
    }

    if (!gallery) {
        return null;
    }

    const clientName =
        getClientName(client);

    const bookingDate =
        getBookingDate(booking);

    const bookingTime =
        getBookingTime(booking);

    return (
        <div className="gallery-details-page">
            <div className="gallery-details-container">

                {/* ======================================================
            PAGE HEADER
        ====================================================== */}
                <div className="gallery-details-header">

                    <div className="gallery-details-header-left">

                        <button
                            className="gallery-details-back"
                            onClick={() =>
                                navigate(
                                    "/photographer/galleries"
                                )
                            }
                        >
                            <span>←</span>
                            Back to Galleries
                        </button>

                        <div className="gallery-details-title-row">

                            <div>
                                <div className="gallery-details-title-line">

                                    <h1>{gallery.name}</h1>

                                    <span
                                        className={`gallery-details-status ${gallery.is_published
                                                ? "published"
                                                : "unpublished"
                                            }`}
                                    >
                                        <span className="gallery-details-status-dot"></span>

                                        {gallery.is_published
                                            ? "Published"
                                            : "Unpublished"}
                                    </span>

                                </div>

                                <p className="gallery-details-subtitle">
                                    {gallery.description ||
                                        "Manage this client gallery and its media."}
                                </p>
                            </div>

                        </div>

                    </div>

                    <div className="gallery-details-header-actions">

                        <button
                            className="gallery-details-button secondary"
                            onClick={() =>
                                navigate(
                                    `/photographer/galleries/${gallery.gallery_id}/edit`
                                )
                            }
                            disabled={deletingGallery}
                        >
                            Edit Gallery
                        </button>

                        <button
                            className="gallery-details-button danger"
                            onClick={
                                handleDeleteGallery
                            }
                            disabled={deletingGallery}
                        >
                            {deletingGallery
                                ? "Deleting..."
                                : "Delete Gallery"}
                        </button>

                    </div>

                </div>

                {/* ======================================================
            ALERTS
        ====================================================== */}
                {error && (
                    <div className="gallery-details-alert error">
                        <span className="gallery-details-alert-icon">
                            !
                        </span>

                        <span>{error}</span>

                        <button
                            onClick={() =>
                                setError("")
                            }
                            aria-label="Dismiss error"
                        >
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div className="gallery-details-alert success">
                        <span className="gallery-details-alert-icon">
                            ✓
                        </span>

                        <span>{success}</span>
                    </div>
                )}

                {/* ======================================================
            SUMMARY CARDS
        ====================================================== */}
                <div className="gallery-details-summary">

                    <div className="gallery-details-summary-card">
                        <div className="gallery-details-summary-icon">
                            ◉
                        </div>

                        <div>
                            <span className="gallery-details-summary-label">
                                Client
                            </span>

                            <strong>
                                {clientName}
                            </strong>
                        </div>
                    </div>

                    <div className="gallery-details-summary-card">
                        <div className="gallery-details-summary-icon">
                            ▣
                        </div>

                        <div>
                            <span className="gallery-details-summary-label">
                                Booking
                            </span>

                            <strong>
                                {bookingDate
                                    ? formatDate(
                                        bookingDate
                                    )
                                    : "No booking date"}
                            </strong>
                        </div>
                    </div>

                    <div className="gallery-details-summary-card">
                        <div className="gallery-details-summary-icon">
                            ▧
                        </div>

                        <div>
                            <span className="gallery-details-summary-label">
                                Photos
                            </span>

                            <strong>
                                {photoCount}
                            </strong>
                        </div>
                    </div>

                    <div className="gallery-details-summary-card">
                        <div className="gallery-details-summary-icon">
                            ▶
                        </div>

                        <div>
                            <span className="gallery-details-summary-label">
                                Videos
                            </span>

                            <strong>
                                {videoCount}
                            </strong>
                        </div>
                    </div>

                </div>

                {/* ======================================================
            MAIN CONTENT
        ====================================================== */}
                <div className="gallery-details-grid">

                    {/* ====================================================
              LEFT COLUMN
          ==================================================== */}
                    <div className="gallery-details-main">

                        {/* --------------------------------------------------
                MEDIA SECTION
            -------------------------------------------------- */}
                        <section className="gallery-details-card">

                            <div className="gallery-details-card-header">

                                <div>
                                    <h2>Gallery Media</h2>

                                    <p>
                                        Photos and videos uploaded to this client
                                        gallery.
                                    </p>
                                </div>

                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={[
                                            ...ALLOWED_PHOTO_TYPES,
                                            ...ALLOWED_VIDEO_TYPES,
                                        ].join(",")}
                                        multiple
                                        onChange={
                                            handleMediaUpload
                                        }
                                        disabled={uploading}
                                        style={{
                                            display: "none",
                                        }}
                                    />

                                    <button
                                        className="gallery-details-button primary"
                                        onClick={
                                            openFilePicker
                                        }
                                        disabled={uploading}
                                    >
                                        {uploading
                                            ? "Uploading..."
                                            : "+ Upload Media"}
                                    </button>
                                </div>

                            </div>

                            {/* Upload status */}
                            {uploading && (
                                <div className="gallery-upload-status">
                                    <div className="gallery-upload-spinner"></div>

                                    <div>
                                        <strong>
                                            Uploading media
                                        </strong>

                                        <span>
                                            {uploadProgress ||
                                                "Please wait..."}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {media.length === 0 ? (
                                <div className="gallery-details-empty">

                                    <div className="gallery-details-empty-icon">
                                        ◫
                                    </div>

                                    <h3>
                                        No media uploaded yet
                                    </h3>

                                    <p>
                                        Upload photos and videos to start building
                                        this client gallery.
                                    </p>

                                    <button
                                        className="gallery-details-button primary"
                                        onClick={
                                            openFilePicker
                                        }
                                        disabled={uploading}
                                    >
                                        Upload First Media
                                    </button>

                                </div>
                            ) : (
                                <div className="gallery-media-grid">

                                    {media.map(
                                        (mediaItem) => {
                                            const mediaType =
                                                getMediaType(
                                                    mediaItem
                                                );

                                            const mediaUrl =
                                                mediaItem.signedUrl;

                                            return (
                                                <div
                                                    className="gallery-media-item"
                                                    key={
                                                        mediaItem.media_id
                                                    }
                                                >

                                                    <div className="gallery-media-preview">

                                                        {mediaType ===
                                                            "image" &&
                                                            mediaUrl ? (
                                                            <img
                                                                src={
                                                                    mediaUrl
                                                                }
                                                                alt={
                                                                    mediaItem.file_name
                                                                }
                                                            />
                                                        ) : mediaType ===
                                                            "video" &&
                                                            mediaUrl ? (
                                                            <video
                                                                src={
                                                                    mediaUrl
                                                                }
                                                                controls
                                                                preload="metadata"
                                                            />
                                                        ) : (
                                                            <div className="gallery-media-placeholder">
                                                                {mediaType ===
                                                                    "video"
                                                                    ? "▶"
                                                                    : "▧"}
                                                            </div>
                                                        )}

                                                        <span className="gallery-media-type">
                                                            {mediaType ===
                                                                "video"
                                                                ? "VIDEO"
                                                                : "image"}
                                                        </span>

                                                    </div>

                                                    <div className="gallery-media-info">

                                                        <div className="gallery-media-name">
                                                            {
                                                                mediaItem.file_name
                                                            }
                                                        </div>

                                                        <div className="gallery-media-meta">

                                                            <span>
                                                                {formatFileSize(
                                                                    mediaItem.file_size
                                                                )}
                                                            </span>

                                                            <span>
                                                                {formatDate(
                                                                    mediaItem.uploaded_at
                                                                )}
                                                            </span>

                                                        </div>

                                                        <div className="gallery-media-actions">

                                                            {mediaUrl && (
                                                                <a
                                                                    href={
                                                                        mediaUrl
                                                                    }
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="gallery-media-view"
                                                                >
                                                                    View
                                                                </a>
                                                            )}

                                                            <button
                                                                className="gallery-media-delete"
                                                                onClick={() =>
                                                                    handleDeleteMedia(
                                                                        mediaItem
                                                                    )
                                                                }
                                                                disabled={
                                                                    deletingMediaId ===
                                                                    mediaItem.media_id
                                                                }
                                                            >
                                                                {deletingMediaId ===
                                                                    mediaItem.media_id
                                                                    ? "Deleting..."
                                                                    : "Delete"}
                                                            </button>

                                                        </div>

                                                    </div>

                                                </div>
                                            );
                                        }
                                    )}

                                </div>
                            )}

                        </section>

                        {/* --------------------------------------------------
                GALLERY INFORMATION
            -------------------------------------------------- */}
                        <section className="gallery-details-card">

                            <div className="gallery-details-card-header">
                                <div>
                                    <h2>
                                        Gallery Information
                                    </h2>

                                    <p>
                                        Details associated with this client
                                        gallery.
                                    </p>
                                </div>
                            </div>

                            <div className="gallery-details-information">

                                <div className="gallery-details-information-row">
                                    <span>
                                        Gallery Name
                                    </span>

                                    <strong>
                                        {gallery.name}
                                    </strong>
                                </div>

                                <div className="gallery-details-information-row">
                                    <span>
                                        Client
                                    </span>

                                    <strong>
                                        {clientName}
                                    </strong>
                                </div>

                                <div className="gallery-details-information-row">
                                    <span>
                                        Booking Date
                                    </span>

                                    <strong>
                                        {bookingDate
                                            ? formatDate(
                                                bookingDate
                                            )
                                            : "—"}
                                    </strong>
                                </div>

                                <div className="gallery-details-information-row">
                                    <span>
                                        Booking Time
                                    </span>

                                    <strong>
                                        {bookingTime ||
                                            "—"}
                                    </strong>
                                </div>

                                <div className="gallery-details-information-row">
                                    <span>
                                        Created
                                    </span>

                                    <strong>
                                        {formatDateTime(
                                            gallery.created_at
                                        )}
                                    </strong>
                                </div>

                                <div className="gallery-details-information-row">
                                    <span>
                                        Last Updated
                                    </span>

                                    <strong>
                                        {formatDateTime(
                                            gallery.updated_at
                                        )}
                                    </strong>
                                </div>

                            </div>

                            {gallery.description && (
                                <div className="gallery-details-description">

                                    <span>
                                        Description
                                    </span>

                                    <p>
                                        {gallery.description}
                                    </p>

                                </div>
                            )}

                        </section>

                    </div>

                    {/* ====================================================
              RIGHT COLUMN
          ==================================================== */}
                    <aside className="gallery-details-sidebar">

                        {/* --------------------------------------------------
                GALLERY SETTINGS
            -------------------------------------------------- */}
                        <section className="gallery-details-card">

                            <div className="gallery-details-card-header">

                                <div>
                                    <h2>
                                        Gallery Settings
                                    </h2>

                                    <p>
                                        Control how clients access this gallery.
                                    </p>
                                </div>

                            </div>

                            <div className="gallery-details-settings">

                                {/* Publish */}
                                <div
                                    className={`gallery-details-setting ${gallery.is_published
                                            ? "active"
                                            : ""
                                        }`}
                                >

                                    <div className="gallery-details-setting-icon">
                                        {gallery.is_published
                                            ? "✓"
                                            : "○"}
                                    </div>

                                    <div className="gallery-details-setting-content">

                                        <div className="gallery-details-setting-title">

                                            <strong>
                                                Publish Gallery
                                            </strong>

                                            <span
                                                className={
                                                    gallery.is_published
                                                        ? "enabled"
                                                        : "disabled"
                                                }
                                            >
                                                {gallery.is_published
                                                    ? "Published"
                                                    : "Unpublished"}
                                            </span>

                                        </div>

                                        <p>
                                            {gallery.is_published
                                                ? "The gallery is available to the client."
                                                : "The gallery is hidden from the client."}
                                        </p>

                                        <button
                                            className="gallery-details-setting-button"
                                            onClick={() =>
                                                updateGallerySetting(
                                                    "is_published",
                                                    !gallery.is_published
                                                )
                                            }
                                            disabled={
                                                saving ||
                                                deletingGallery
                                            }
                                        >
                                            {gallery.is_published
                                                ? "Unpublish Gallery"
                                                : "Publish Gallery"}
                                        </button>

                                    </div>

                                </div>

                                {/* Downloads */}
                                <div
                                    className={`gallery-details-setting ${gallery.allow_downloads
                                            ? "active"
                                            : ""
                                        }`}
                                >

                                    <div className="gallery-details-setting-icon">
                                        {gallery.allow_downloads
                                            ? "✓"
                                            : "○"}
                                    </div>

                                    <div className="gallery-details-setting-content">

                                        <div className="gallery-details-setting-title">

                                            <strong>
                                                Client Downloads
                                            </strong>

                                            <span
                                                className={
                                                    gallery.allow_downloads
                                                        ? "enabled"
                                                        : "disabled"
                                                }
                                            >
                                                {gallery.allow_downloads
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </span>

                                        </div>

                                        <p>
                                            {gallery.allow_downloads
                                                ? "Clients can download permitted media."
                                                : "Clients cannot download gallery media."}
                                        </p>

                                        <button
                                            className="gallery-details-setting-button"
                                            onClick={() =>
                                                updateGallerySetting(
                                                    "allow_downloads",
                                                    !gallery.allow_downloads
                                                )
                                            }
                                            disabled={
                                                saving ||
                                                deletingGallery
                                            }
                                        >
                                            {gallery.allow_downloads
                                                ? "Disable Downloads"
                                                : "Enable Downloads"}
                                        </button>

                                    </div>

                                </div>

                            </div>

                        </section>

                        {/* --------------------------------------------------
                CLIENT INFORMATION
            -------------------------------------------------- */}
                        <section className="gallery-details-card">

                            <div className="gallery-details-card-header">

                                <div>
                                    <h2>
                                        Client
                                    </h2>

                                    <p>
                                        Customer associated with this gallery.
                                    </p>
                                </div>

                            </div>

                            <div className="gallery-details-client">

                                <div className="gallery-details-client-avatar">
                                    {clientName
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div className="gallery-details-client-info">

                                    <strong>
                                        {clientName}
                                    </strong>

                                    {client?.profile
                                        ?.email && (
                                            <span>
                                                {
                                                    client
                                                        .profile
                                                        .email
                                                }
                                            </span>
                                        )}

                                    {client?.profile
                                        ?.phone && (
                                            <span>
                                                {
                                                    client
                                                        .profile
                                                        .phone
                                                }
                                            </span>
                                        )}

                                </div>

                            </div>

                            {gallery.client_id && (
                                <button
                                    className="gallery-details-full-button"
                                    onClick={() =>
                                        navigate(
                                            `/photographer/clients/${gallery.client_id}`
                                        )
                                    }
                                    disabled={
                                        deletingGallery
                                    }
                                >
                                    View Client
                                    <span>→</span>
                                </button>
                            )}

                        </section>

                        {/* --------------------------------------------------
                BOOKING INFORMATION
            -------------------------------------------------- */}
                        <section className="gallery-details-card">

                            <div className="gallery-details-card-header">

                                <div>
                                    <h2>
                                        Booking
                                    </h2>

                                    <p>
                                        Booking associated with this gallery.
                                    </p>
                                </div>

                            </div>

                            <div className="gallery-details-booking">

                                <div className="gallery-details-booking-row">
                                    <span>
                                        Date
                                    </span>

                                    <strong>
                                        {bookingDate
                                            ? formatDate(
                                                bookingDate
                                            )
                                            : "—"}
                                    </strong>
                                </div>

                                <div className="gallery-details-booking-row">
                                    <span>
                                        Time
                                    </span>

                                    <strong>
                                        {bookingTime ||
                                            "—"}
                                    </strong>
                                </div>

                                {booking?.status && (
                                    <div className="gallery-details-booking-row">
                                        <span>
                                            Status
                                        </span>

                                        <strong className="booking-status">
                                            {booking.status}
                                        </strong>
                                    </div>
                                )}

                            </div>

                            {gallery.booking_id && (
                                <button
                                    className="gallery-details-full-button"
                                    onClick={() =>
                                        navigate(
                                            `/photographer/bookings/${gallery.booking_id}`
                                        )
                                    }
                                    disabled={
                                        deletingGallery
                                    }
                                >
                                    View Booking
                                    <span>→</span>
                                </button>
                            )}

                        </section>

                    </aside>

                </div>

            </div>
        </div>
    );
}