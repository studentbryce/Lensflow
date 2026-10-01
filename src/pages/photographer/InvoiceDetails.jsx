import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import InvoiceDocument, {
    formatInvoiceCurrency,
    formatInvoiceStatus,
} from "../../components/invoices/InvoiceDocument";
import { downloadInvoicePdf } from "../../utils/invoicePdf";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./InvoiceDetails.css";

export default function InvoiceDetails() {
    const { invoice_id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [clientProfile, setClientProfile] = useState(null);
    const [booking, setBooking] = useState(null);
    const [service, setService] = useState(null);
    const [photographerProfile, setPhotographerProfile] =
        useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

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

            const { data: invoiceData, error: invoiceError } =
                await supabase
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
                        tax_number,
                        bank_account_name,
                        bank_name,
                        bank_account_number,
                        bank_payment_instructions,
                        tax_amount,
                        total_amount,
                        status,
                        notes,
                        created_at,
                        updated_at
                    `)
                    .eq("invoice_id", invoice_id)
                    .single();

            if (invoiceError) throw invoiceError;
            if (!invoiceData) {
                throw new Error("Invoice could not be found.");
            }

            setInvoice(invoiceData);

            const {
                data: photographerData,
                error: photographerError,
            } = await supabase
                .from("photographer_profiles")
                .select("photographer_id, business_name")
                .eq(
                    "photographer_id",
                    invoiceData.photographer_id
                )
                .maybeSingle();

            if (photographerError) throw photographerError;
            setPhotographerProfile(photographerData || null);

            const { data: itemData, error: itemError } =
                await supabase
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

            if (itemError) throw itemError;
            setItems(itemData || []);

            if (invoiceData.client_id) {
                const { data: clientData, error: clientError } =
                    await supabase
                        .from("clients")
                        .select(`
                            client_id,
                            user_id,
                            photographer_id,
                            created_at
                        `)
                        .eq(
                            "client_id",
                            invoiceData.client_id
                        )
                        .single();

                if (clientError) throw clientError;

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

                    if (
                        profileError &&
                        profileError.code !== "PGRST116"
                    ) {
                        throw profileError;
                    }

                    setClientProfile(profileData || null);
                }
            }

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
                    .eq(
                        "booking_id",
                        invoiceData.booking_id
                    )
                    .single();

                if (bookingError) throw bookingError;
                setBooking(bookingData);

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
                        .eq(
                            "service_id",
                            bookingData.service_id
                        )
                        .single();

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

    async function handleMarkAsSent() {
        if (!invoice) return;

        try {
            setActionLoading(true);
            setError("");

            const { data, error: updateError } =
                await supabase
                    .from("invoices")
                    .update({
                        status: "sent",
                        updated_at: new Date().toISOString(),
                    })
                    .eq(
                        "invoice_id",
                        invoice.invoice_id
                    )
                    .select()
                    .single();

            if (updateError) throw updateError;
            setInvoice(data);
        } catch (err) {
            console.error(
                "Error marking invoice as sent:",
                err
            );
            setError(
                err.message ||
                    "Unable to update the invoice status."
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleMarkAsPaid() {
        if (!invoice) return;

        const confirmed = window.confirm(
            "Are you sure you want to mark this invoice as paid?"
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");

            const { data, error: updateError } =
                await supabase
                    .from("invoices")
                    .update({
                        status: "paid",
                        updated_at: new Date().toISOString(),
                    })
                    .eq(
                        "invoice_id",
                        invoice.invoice_id
                    )
                    .select()
                    .single();

            if (updateError) throw updateError;
            setInvoice(data);
        } catch (err) {
            console.error(
                "Error marking invoice as paid:",
                err
            );
            setError(
                err.message ||
                    "Unable to update the invoice status."
            );
        } finally {
            setActionLoading(false);
        }
    }

    function handleDownloadPdf() {
        if (!invoice) return;

        try {
            setPdfLoading(true);
            setError("");

            downloadInvoicePdf({
                invoice,
                items,
                clientProfile,
                booking,
                service,
                photographerProfile,
            });
        } catch (err) {
            console.error(
                "Error generating invoice PDF:",
                err
            );
            setError(
                err.message ||
                    "Unable to generate the invoice PDF."
            );
        } finally {
            setPdfLoading(false);
        }
    }

    async function handleDelete() {
        if (!invoice) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");

            const { error: itemsError } = await supabase
                .from("invoice_items")
                .delete()
                .eq("invoice_id", invoice.invoice_id);

            if (itemsError) throw itemsError;

            const { error: invoiceError } = await supabase
                .from("invoices")
                .delete()
                .eq("invoice_id", invoice.invoice_id);

            if (invoiceError) throw invoiceError;

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

    if (loading) {
        return (
            <main className="invoice-details-page">
                <div className="invoice-details-loading">
                    <div className="invoice-loading-spinner" />
                    <h2>Loading invoice...</h2>
                    <p>Retrieving your invoice information.</p>
                </div>
            </main>
        );
    }

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

    if (!invoice) return null;

    const displayTaxRate = (
        Number(invoice.tax_rate) || 0
    ).toFixed(2);

    return (
        <main className="invoice-details-page">
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
                            <h1>{invoice.invoice_number}</h1>
                        </div>

                        <span
                            className={`invoice-status-badge status-${invoice.status}`}
                        >
                            {formatInvoiceStatus(
                                invoice.status
                            )}
                        </span>
                    </div>
                </div>

                <div className="invoice-header-actions">
                    <button
                        type="button"
                        className="invoice-secondary-button"
                        onClick={handleDownloadPdf}
                        disabled={pdfLoading}
                    >
                        {pdfLoading
                            ? "Generating..."
                            : "Download PDF"}
                    </button>

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

            <div className="invoice-details-layout">
                <InvoiceDocument
                    invoice={invoice}
                    items={items}
                    clientProfile={clientProfile}
                    booking={booking}
                    service={service}
                    photographerProfile={
                        photographerProfile
                    }
                    bookingLink={
                        booking?.booking_id
                            ? `/photographer/bookings/${booking.booking_id}`
                            : ""
                    }
                />

                <aside className="invoice-sidebar">
                    <section className="invoice-sidebar-card">
                        <span className="invoice-sidebar-label">
                            Invoice Status
                        </span>

                        <div className="invoice-sidebar-status">
                            <span
                                className={`invoice-status-dot status-${invoice.status}`}
                            />
                            <strong>
                                {formatInvoiceStatus(
                                    invoice.status
                                )}
                            </strong>
                        </div>

                        <p>
                            {invoice.status === "draft" &&
                                "This invoice is currently a draft and has not been sent to the client."}
                            {invoice.status === "sent" &&
                                "This invoice has been marked as sent and is awaiting payment."}
                            {invoice.status === "paid" &&
                                "This invoice has been marked as paid."}
                            {invoice.status === "overdue" &&
                                "This invoice is overdue and requires payment."}
                            {invoice.status === "cancelled" &&
                                "This invoice has been cancelled."}
                        </p>
                    </section>

                    <section className="invoice-sidebar-card">
                        <span className="invoice-sidebar-label">
                            Invoice Summary
                        </span>

                        <div className="invoice-summary-row">
                            <span>Items</span>
                            <strong>{items.length}</strong>
                        </div>

                        <div className="invoice-summary-row">
                            <span>GST Rate</span>
                            <strong>
                                {displayTaxRate}%
                            </strong>
                        </div>

                        <div className="invoice-summary-row">
                            <span>GST Treatment</span>
                            <strong>
                                {invoice.tax_included
                                    ? "Included"
                                    : "Added"}
                            </strong>
                        </div>

                        <div className="invoice-summary-row invoice-summary-total">
                            <span>Total</span>
                            <strong>
                                {formatInvoiceCurrency(
                                    invoice.total_amount
                                )}
                            </strong>
                        </div>
                    </section>

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
                            removes the invoice and its line
                            items.
                        </p>
                    </section>
                </aside>
            </div>
        </main>
    );
}
