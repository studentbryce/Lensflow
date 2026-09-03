import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./InvoiceDetails.css";

function formatCurrency(value) {
    return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: "NZD",
    }).format(Number(value) || 0);
}

function formatDate(date) {
    if (!date) return "—";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-NZ", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function formatTime(time) {
    if (!time) return "—";

    return new Date(`1970-01-01T${time}`).toLocaleTimeString("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatStatus(status) {
    if (!status) return "Unknown";

    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getClientName(profile) {
    if (!profile) {
        return "Unknown Client";
    }

    const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.email || "Unknown Client";
}

export default function InvoiceDetails() {
    const { invoice_id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [client, setClient] = useState(null);
    const [clientProfile, setClientProfile] = useState(null);
    const [booking, setBooking] = useState(null);
    const [service, setService] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (!invoice_id) {
            setError(
                "No invoice ID was provided. Please return to the invoices page and try again."
            );
            setLoading(false);
            return;
        }

        loadInvoice();
    }, [user, invoice_id]);

    async function loadInvoice() {
        try {
            setLoading(true);
            setError("");

            /*
             * =========================================
             * LOAD INVOICE
             * =========================================
             */

            const {
                data: invoiceData,
                error: invoiceError,
            } = await supabase
                .from("invoices")
                .select(`
                    invoice_id,
                    photographer_id,
                    client_id,
                    booking_id,
                    invoice_number,
                    issue_date,
                    due_date,
                    subtotal,
                    tax_rate,
                    tax_included,
                    tax_amount,
                    total_amount,
                    status,
                    notes,
                    created_at,
                    updated_at
                `)
                .eq("invoice_id", invoice_id)
                .single();

            if (invoiceError) {
                throw invoiceError;
            }

            if (!invoiceData) {
                throw new Error("Invoice could not be found.");
            }

            setInvoice(invoiceData);

            /*
             * =========================================
             * LOAD INVOICE ITEMS
             * =========================================
             */

            const {
                data: itemData,
                error: itemError,
            } = await supabase
                .from("invoice_items")
                .select(`
                    invoice_item_id,
                    invoice_id,
                    photographer_id,
                    service_id,
                    description,
                    quantity,
                    unit_price,
                    subtotal
                `)
                .eq("invoice_id", invoice_id)
                .order("invoice_item_id", {
                    ascending: true,
                });

            if (itemError) {
                throw itemError;
            }

            setItems(itemData || []);

            /*
             * =========================================
             * LOAD CLIENT
             * =========================================
             */

            if (invoiceData.client_id) {
                const {
                    data: clientData,
                    error: clientError,
                } = await supabase
                    .from("clients")
                    .select(`
                        client_id,
                        user_id,
                        photographer_id,
                        created_at
                    `)
                    .eq("client_id", invoiceData.client_id)
                    .single();

                if (clientError) {
                    throw clientError;
                }

                setClient(clientData);

                /*
                 * Load the client's profile separately.
                 *
                 * Profile RLS is handled independently.
                 */
                if (clientData?.user_id) {
                    const {
                        data: profileData,
                        error: profileError,
                    } = await supabase
                        .from("profiles")
                        .select(`
                            user_id,
                            first_name,
                            last_name,
                            email,
                            phone
                        `)
                        .eq("user_id", clientData.user_id)
                        .single();

                    /*
                     * PGRST116 means no profile was found.
                     * We can still display the invoice.
                     */
                    if (
                        profileError &&
                        profileError.code !== "PGRST116"
                    ) {
                        throw profileError;
                    }

                    setClientProfile(profileData || null);
                }
            }

            /*
             * =========================================
             * LOAD BOOKING
             * =========================================
             */

            if (invoiceData.booking_id) {
                const {
                    data: bookingData,
                    error: bookingError,
                } = await supabase
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
                    .eq("booking_id", invoiceData.booking_id)
                    .single();

                if (bookingError) {
                    throw bookingError;
                }

                setBooking(bookingData);

                /*
                 * =========================================
                 * LOAD BOOKING SERVICE
                 * =========================================
                 */

                if (bookingData?.service_id) {
                    const {
                        data: serviceData,
                        error: serviceError,
                    } = await supabase
                        .from("services")
                        .select(`
                            service_id,
                            name,
                            description,
                            price,
                            duration_minutes
                        `)
                        .eq("service_id", bookingData.service_id)
                        .single();

                    /*
                     * A deleted/inaccessible service should not
                     * prevent the invoice itself from loading.
                     */
                    if (
                        serviceError &&
                        serviceError.code !== "PGRST116"
                    ) {
                        throw serviceError;
                    }

                    setService(serviceData || null);
                }
            }
        } catch (err) {
            console.error("Error loading invoice:", err);

            setError(
                err.message ||
                    "Unable to load this invoice. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    /*
     * =========================================
     * DISPLAY VALUES
     * =========================================
     */

    const clientName = useMemo(() => {
        return getClientName(clientProfile);
    }, [clientProfile]);

    const displayTaxRate = useMemo(() => {
        const rate = Number(invoice?.tax_rate);

        if (!Number.isFinite(rate)) {
            return "0.00";
        }

        return rate.toFixed(2);
    }, [invoice]);

    const taxDescription = useMemo(() => {
        if (!invoice) return "";

        if (invoice.tax_included) {
            return `GST included at ${displayTaxRate}%`;
        }

        return `GST added at ${displayTaxRate}%`;
    }, [invoice, displayTaxRate]);

    /*
     * =========================================
     * MARK AS SENT
     * =========================================
     */

    async function handleMarkAsSent() {
        if (!invoice) return;

        try {
            setActionLoading(true);
            setError("");

            const {
                data,
                error: updateError,
            } = await supabase
                .from("invoices")
                .update({
                    status: "sent",
                    updated_at: new Date().toISOString(),
                })
                .eq("invoice_id", invoice.invoice_id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            setInvoice(data);
        } catch (err) {
            console.error("Error marking invoice as sent:", err);

            setError(
                err.message ||
                    "Unable to update the invoice status."
            );
        } finally {
            setActionLoading(false);
        }
    }

    /*
     * =========================================
     * MARK AS PAID
     * =========================================
     */

    async function handleMarkAsPaid() {
        if (!invoice) return;

        const confirmed = window.confirm(
            "Are you sure you want to mark this invoice as paid?"
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");

            const {
                data,
                error: updateError,
            } = await supabase
                .from("invoices")
                .update({
                    status: "paid",
                    updated_at: new Date().toISOString(),
                })
                .eq("invoice_id", invoice.invoice_id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            setInvoice(data);
        } catch (err) {
            console.error("Error marking invoice as paid:", err);

            setError(
                err.message ||
                    "Unable to update the invoice status."
            );
        } finally {
            setActionLoading(false);
        }
    }

    /*
     * =========================================
     * DELETE INVOICE
     * =========================================
     */

    async function handleDelete() {
        if (!invoice) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");

            /*
             * Delete invoice items first.
             */
            const {
                error: itemsError,
            } = await supabase
                .from("invoice_items")
                .delete()
                .eq("invoice_id", invoice.invoice_id);

            if (itemsError) {
                throw itemsError;
            }

            /*
             * Delete invoice.
             */
            const {
                error: invoiceError,
            } = await supabase
                .from("invoices")
                .delete()
                .eq("invoice_id", invoice.invoice_id);

            if (invoiceError) {
                throw invoiceError;
            }

            navigate("/photographer/invoices");
        } catch (err) {
            console.error("Error deleting invoice:", err);

            setError(
                err.message ||
                    "Unable to delete the invoice."
            );
        } finally {
            setActionLoading(false);
        }
    }

    /*
     * =========================================
     * LOADING
     * =========================================
     */

    if (loading) {
        return (
            <main className="invoice-details-page">
                <div className="invoice-details-loading">
                    <div className="invoice-loading-spinner"></div>

                    <h2>Loading invoice...</h2>

                    <p>
                        Retrieving your invoice information.
                    </p>
                </div>
            </main>
        );
    }

    /*
     * =========================================
     * ERROR / NOT FOUND
     * =========================================
     */

    if (error && !invoice) {
        return (
            <main className="invoice-details-page">
                <div className="invoice-details-header">
                    <div>
                        <Link
                            to="/photographer/invoices"
                            className="invoice-back-link"
                        >
                            ← Back to invoices
                        </Link>

                        <span className="invoice-page-eyebrow">
                            Invoice
                        </span>

                        <h1>Invoice unavailable</h1>
                    </div>
                </div>

                <div className="invoice-details-error">
                    <strong>
                        Unable to load this invoice
                    </strong>

                    <p>{error}</p>

                    <button
                        type="button"
                        className="invoice-secondary-button"
                        onClick={loadInvoice}
                    >
                        Try Again
                    </button>
                </div>
            </main>
        );
    }

    if (!invoice) {
        return null;
    }

    return (
        <main className="invoice-details-page">
            {/* =========================================
                PAGE HEADER
            ========================================= */}

            <header className="invoice-details-header">
                <div>
                    <Link
                        to="/photographer/invoices"
                        className="invoice-back-link"
                    >
                        ← Back to invoices
                    </Link>

                    <div className="invoice-title-row">
                        <div>
                            <span className="invoice-page-eyebrow">
                                Invoice
                            </span>

                            <h1>
                                {invoice.invoice_number}
                            </h1>
                        </div>

                        <span
                            className={`invoice-status-badge status-${invoice.status}`}
                        >
                            {formatStatus(invoice.status)}
                        </span>
                    </div>
                </div>

                <div className="invoice-header-actions">
                    {invoice.status === "draft" && (
                        <button
                            type="button"
                            className="invoice-secondary-button"
                            onClick={handleMarkAsSent}
                            disabled={actionLoading}
                        >
                            {actionLoading
                                ? "Updating..."
                                : "Mark as Sent"}
                        </button>
                    )}

                    {invoice.status !== "paid" &&
                        invoice.status !== "cancelled" && (
                            <button
                                type="button"
                                className="invoice-primary-button"
                                onClick={handleMarkAsPaid}
                                disabled={actionLoading}
                            >
                                {actionLoading
                                    ? "Updating..."
                                    : "Mark as Paid"}
                            </button>
                        )}

                    <Link
                        to={`/photographer/invoices/${invoice.invoice_id}/edit`}
                        className="invoice-edit-button"
                    >
                        Edit Invoice
                    </Link>
                </div>
            </header>

            {error && (
                <div className="invoice-inline-error">
                    {error}
                </div>
            )}

            {/* =========================================
                CONTENT
            ========================================= */}

            <div className="invoice-details-layout">
                {/* =====================================
                    MAIN INVOICE
                ===================================== */}

                <div className="invoice-main-card">
                    {/* Document Header */}

                    <div className="invoice-document-header">
                        <div>
                            <span className="invoice-document-label">
                                Invoice
                            </span>

                            <h2>
                                {invoice.invoice_number}
                            </h2>
                        </div>

                        <div className="invoice-document-meta">
                            <div>
                                <span>Issue Date</span>

                                <strong>
                                    {formatDate(
                                        invoice.issue_date
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Due Date</span>

                                <strong>
                                    {invoice.due_date
                                        ? formatDate(
                                              invoice.due_date
                                          )
                                        : "No due date"}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Client + Booking */}

                    <div className="invoice-information-grid">
                        <section className="invoice-info-block">
                            <span className="invoice-info-label">
                                Billed To
                            </span>

                            <h3>{clientName}</h3>

                            {clientProfile?.email && (
                                <p>
                                    {clientProfile.email}
                                </p>
                            )}

                            {clientProfile?.phone && (
                                <p>
                                    {clientProfile.phone}
                                </p>
                            )}
                        </section>

                        <section className="invoice-info-block">
                            <span className="invoice-info-label">
                                Booking
                            </span>

                            {booking ? (
                                <>
                                    <h3>
                                        {service?.name ||
                                            "Photography Booking"}
                                    </h3>

                                    <p>
                                        {formatDate(
                                            booking.booking_date
                                        )}
                                    </p>

                                    {booking.start_time && (
                                        <p>
                                            {formatTime(
                                                booking.start_time
                                            )}

                                            {booking.end_time &&
                                                ` – ${formatTime(
                                                    booking.end_time
                                                )}`}
                                        </p>
                                    )}

                                    {booking.location && (
                                        <p>
                                            {booking.location}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <h3>
                                    No booking information
                                </h3>
                            )}
                        </section>
                    </div>

                    {/* Invoice Items */}

                    <section className="invoice-items-section">
                        <div className="invoice-section-title">
                            <div>
                                <span>
                                    Invoice Items
                                </span>

                                <h3>
                                    Services & Charges
                                </h3>
                            </div>
                        </div>

                        {items.length > 0 ? (
                            <div className="invoice-items-table-wrapper">
                                <table className="invoice-items-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                Description
                                            </th>

                                            <th>
                                                Qty
                                            </th>

                                            <th>
                                                Unit Price
                                            </th>

                                            <th>
                                                Amount
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {items.map(
                                            (item) => (
                                                <tr
                                                    key={
                                                        item.invoice_item_id
                                                    }
                                                >
                                                    <td>
                                                        <div className="invoice-item-description">
                                                            <strong>
                                                                {
                                                                    item.description
                                                                }
                                                            </strong>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        {Number(
                                                            item.quantity
                                                        ) || 0}
                                                    </td>

                                                    <td>
                                                        {formatCurrency(
                                                            item.unit_price
                                                        )}
                                                    </td>

                                                    <td className="invoice-item-amount">
                                                        {formatCurrency(
                                                            item.subtotal
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="invoice-empty-items">
                                <p>
                                    No invoice items found.
                                </p>
                            </div>
                        )}
                    </section>

                    {/* GST + Totals */}

                    <div className="invoice-bottom-section">
                        <div className="invoice-tax-information">
                            <span className="invoice-info-label">
                                GST Treatment
                            </span>

                            <strong>
                                {taxDescription}
                            </strong>

                            <p>
                                {invoice.tax_included
                                    ? "Service prices already include GST. The GST component is shown separately below."
                                    : "GST is calculated on top of the service prices."}
                            </p>
                        </div>

                        <div className="invoice-totals">
                            <div className="invoice-total-row">
                                <span>
                                    Subtotal
                                </span>

                                <strong>
                                    {formatCurrency(
                                        invoice.subtotal
                                    )}
                                </strong>
                            </div>

                            <div className="invoice-total-row">
                                <span>
                                    GST ({displayTaxRate}%)
                                    {invoice.tax_included &&
                                        " included"}
                                </span>

                                <strong>
                                    {formatCurrency(
                                        invoice.tax_amount
                                    )}
                                </strong>
                            </div>

                            <div className="invoice-total-divider"></div>

                            <div className="invoice-total-row invoice-grand-total">
                                <span>Total</span>

                                <strong>
                                    {formatCurrency(
                                        invoice.total_amount
                                    )}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}

                    {invoice.notes && (
                        <section className="invoice-notes-section">
                            <span className="invoice-info-label">
                                Notes
                            </span>

                            <p>
                                {invoice.notes}
                            </p>
                        </section>
                    )}
                </div>

                {/* =====================================
                    SIDEBAR
                ===================================== */}

                <aside className="invoice-sidebar">
                    {/* Status */}

                    <section className="invoice-sidebar-card">
                        <span className="invoice-sidebar-label">
                            Invoice Status
                        </span>

                        <div className="invoice-sidebar-status">
                            <span
                                className={`invoice-status-dot status-${invoice.status}`}
                            ></span>

                            <strong>
                                {formatStatus(
                                    invoice.status
                                )}
                            </strong>
                        </div>

                        <p>
                            {invoice.status ===
                                "draft" &&
                                "This invoice is currently a draft and has not been sent to the client."}

                            {invoice.status ===
                                "sent" &&
                                "This invoice has been marked as sent and is awaiting payment."}

                            {invoice.status ===
                                "paid" &&
                                "This invoice has been marked as paid."}

                            {invoice.status ===
                                "overdue" &&
                                "This invoice is overdue and requires payment."}

                            {invoice.status ===
                                "cancelled" &&
                                "This invoice has been cancelled."}
                        </p>
                    </section>

                    {/* Summary */}

                    <section className="invoice-sidebar-card">
                        <span className="invoice-sidebar-label">
                            Invoice Summary
                        </span>

                        <div className="invoice-summary-row">
                            <span>Items</span>

                            <strong>
                                {items.length}
                            </strong>
                        </div>

                        <div className="invoice-summary-row">
                            <span>GST Rate</span>

                            <strong>
                                {displayTaxRate}%
                            </strong>
                        </div>

                        <div className="invoice-summary-row">
                            <span>
                                GST Treatment
                            </span>

                            <strong>
                                {invoice.tax_included
                                    ? "Included"
                                    : "Added"}
                            </strong>
                        </div>

                        <div className="invoice-summary-row invoice-summary-total">
                            <span>Total</span>

                            <strong>
                                {formatCurrency(
                                    invoice.total_amount
                                )}
                            </strong>
                        </div>
                    </section>

                    {/* Delete */}

                    <section className="invoice-sidebar-card invoice-danger-card">
                        <span className="invoice-sidebar-label">
                            Invoice Actions
                        </span>

                        <button
                            type="button"
                            className="invoice-delete-button"
                            onClick={handleDelete}
                            disabled={actionLoading}
                        >
                            {actionLoading
                                ? "Processing..."
                                : "Delete Invoice"}
                        </button>

                        <p>
                            Deleting an invoice permanently
                            removes the invoice and its
                            line items.
                        </p>
                    </section>
                </aside>
            </div>
        </main>
    );
}