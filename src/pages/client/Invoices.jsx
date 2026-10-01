import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    BiReceipt as Receipt,
    BiSearch as Search,
} from "react-icons/bi";
import InvoiceDocument, {
    formatInvoiceCurrency,
    formatInvoiceDate,
} from "../../components/invoices/InvoiceDocument";
import { downloadInvoicePdf } from "../../utils/invoicePdf";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
    getClient,
    localToday,
} from "./bookingHelpers";
import "./Invoices.css";

const FILTERS = [
    "all",
    "sent",
    "overdue",
    "paid",
    "cancelled",
];

function displayStatus(invoice, today) {
    return invoice.status === "sent" &&
        invoice.due_date &&
        invoice.due_date < today
        ? "overdue"
        : invoice.status;
}

function InvoiceCard({ invoice, onView }) {
    return (
        <article className="client-invoice-card">
            <div className="client-invoice-card-heading">
                <div>
                    <span className="client-invoice-card-number">
                        {invoice.invoice_number}
                    </span>
                    <span
                        className="client-invoice-status"
                        data-status={invoice.displayStatus}
                    >
                        {invoice.displayStatus}
                    </span>
                </div>

                <strong className="client-invoice-card-total">
                    {formatInvoiceCurrency(
                        invoice.total_amount
                    )}
                </strong>
            </div>

            <div className="client-invoice-card-service">
                <span>Photography Service</span>
                <h3>
                    {invoice.bookings?.services?.name ||
                        "Photography session"}
                </h3>
            </div>

            <dl className="client-invoice-card-details">
                <div>
                    <dt>Booking</dt>
                    <dd>
                        {invoice.bookings?.booking_date
                            ? formatInvoiceDate(
                                  invoice.bookings
                                      .booking_date
                              )
                            : "No booking"}
                    </dd>
                </div>

                <div>
                    <dt>Issued</dt>
                    <dd>
                        {formatInvoiceDate(
                            invoice.issue_date
                        )}
                    </dd>
                </div>

                <div>
                    <dt>Due</dt>
                    <dd
                        className={
                            invoice.displayStatus ===
                            "overdue"
                                ? "client-invoice-overdue"
                                : ""
                        }
                    >
                        {invoice.due_date
                            ? formatInvoiceDate(
                                  invoice.due_date
                              )
                            : "No due date"}
                    </dd>
                </div>

                <div>
                    <dt>Subtotal</dt>
                    <dd>
                        {formatInvoiceCurrency(
                            invoice.subtotal
                        )}
                    </dd>
                </div>
            </dl>

            {invoice.notes && (
                <div className="client-invoice-card-note">
                    <span>Note</span>
                    <p>{invoice.notes}</p>
                </div>
            )}

            <div className="client-invoice-card-actions">
                <button
                    type="button"
                    onClick={() =>
                        onView(invoice.invoice_id)
                    }
                >
                    View Invoice
                </button>
            </div>
        </article>
    );
}

export default function Invoices() {
    const navigate = useNavigate();
    const { invoice_id } = useParams();
    const { user } = useAuth();

    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [clientProfile, setClientProfile] =
        useState(null);
    const [
        photographerProfile,
        setPhotographerProfile,
    ] = useState(null);
    const [pdfLoading, setPdfLoading] =
        useState(false);
    const [pdfError, setPdfError] = useState("");

    useEffect(() => {
        let active = true;

        async function loadInvoices() {
            setLoading(true);
            setError("");
            setInvoices([]);

            try {
                const client = await getClient(user?.id);

                const {
                    data: profileData,
                    error: profileError,
                } = await supabase
                    .from("profiles")
                    .select(
                        "first_name, last_name, email, phone"
                    )
                    .eq("user_id", user.id)
                    .single();

                if (profileError) throw profileError;

                let photographerData = null;

                if (client?.photographer_id) {
                    const {
                        data,
                        error: photographerError,
                    } = await supabase
                        .from("photographer_profiles")
                        .select(
                            "photographer_id, business_name"
                        )
                        .eq(
                            "photographer_id",
                            client.photographer_id
                        )
                        .maybeSingle();

                    if (
                        photographerError &&
                        photographerError.code !==
                            "PGRST116"
                    ) {
                        throw photographerError;
                    }

                    photographerData = data || null;
                }

                const {
                    data,
                    error: queryError,
                } = await supabase
                    .from("invoices")
                    .select(`
                        invoice_id,
                        photographer_id,
                        booking_id,
                        invoice_number,
                        issue_date,
                        due_date,
                        subtotal,
                        tax_amount,
                        tax_rate,
                        tax_included,
                        tax_number,
                        total_amount,
                        status,
                        notes,
                        bank_account_name,
                        bank_name,
                        bank_account_number,
                        bank_payment_instructions,
                        created_at,
                        bookings(
                            booking_id,
                            booking_date,
                            start_time,
                            end_time,
                            location,
                            services(
                                service_id,
                                name
                            )
                        ),
                        invoice_items(
                            invoice_item_id,
                            description,
                            quantity,
                            unit_price,
                            subtotal
                        )
                    `)
                    .eq(
                        "client_id",
                        client.client_id
                    )
                    .neq("status", "draft")
                    .order("issue_date", {
                        ascending: false,
                    })
                    .order("created_at", {
                        ascending: false,
                    });

                if (queryError) throw queryError;

                if (active) {
                    setClientProfile(profileData);
                    setPhotographerProfile(
                        photographerData
                    );
                    setInvoices(data || []);
                }
            } catch (err) {
                console.error(
                    "Unable to load client invoices:",
                    err
                );

                if (active) {
                    setError(
                        "We couldn't load your invoices. Please try again."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        if (user?.id) {
            loadInvoices();
        } else {
            setLoading(false);
        }

        return () => {
            active = false;
        };
    }, [user?.id, retry]);

    const today = localToday();

    const records = invoices.map((invoice) => ({
        ...invoice,
        invoice_items:
            invoice.invoice_items || [],
        displayStatus: displayStatus(
            invoice,
            today
        ),
    }));

    const visible = records.filter(
        (invoice) =>
            (filter === "all" ||
                invoice.displayStatus === filter) &&
            [
                invoice.invoice_number,
                invoice.bookings?.services?.name,
                invoice.notes,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(
                    search.trim().toLowerCase()
                )
    );

    const unpaid = records.filter((invoice) =>
        ["sent", "overdue"].includes(
            invoice.displayStatus
        )
    );

    const summaries = [
        ["Your invoices", records.length],
        [
            "Unpaid invoice total",
            formatInvoiceCurrency(
                unpaid.reduce(
                    (total, invoice) =>
                        total +
                        Number(
                            invoice.total_amount
                        ),
                    0
                )
            ),
        ],
        [
            "Overdue invoices",
            records.filter(
                (invoice) =>
                    invoice.displayStatus ===
                    "overdue"
            ).length,
        ],
        [
            "Paid invoices",
            records.filter(
                (invoice) =>
                    invoice.displayStatus ===
                    "paid"
            ).length,
        ],
    ];

    function handleDownloadPdf(invoice) {
        try {
            setPdfLoading(true);
            setPdfError("");

            downloadInvoicePdf({
                invoice,
                items:
                    invoice.invoice_items || [],
                clientProfile,
                booking:
                    invoice.bookings || null,
                service:
                    invoice.bookings?.services ||
                    null,
                photographerProfile,
            });
        } catch (err) {
            console.error(
                "Unable to generate invoice PDF:",
                err
            );
            setPdfError(
                "We couldn't generate this invoice PDF. Please try again."
            );
        } finally {
            setPdfLoading(false);
        }
    }

    if (invoice_id) {
        const selectedInvoice = records.find(
            (invoice) =>
                invoice.invoice_id === invoice_id
        );

        return (
            <div className="client-invoices-page client-invoice-detail-page">
                <div className="client-invoice-detail-toolbar">
                    <button
                        type="button"
                        className="client-invoice-back-button"
                        onClick={() =>
                            navigate(
                                "/client/invoices"
                            )
                        }
                    >
                        ← Back to Invoices
                    </button>

                    {selectedInvoice && (
                        <button
                            type="button"
                            className="client-invoice-download-button"
                            onClick={() =>
                                handleDownloadPdf(
                                    selectedInvoice
                                )
                            }
                            disabled={pdfLoading}
                        >
                            {pdfLoading
                                ? "Generating..."
                                : "Download PDF"}
                        </button>
                    )}
                </div>

                {pdfError && (
                    <div
                        className="client-invoices-state client-invoice-pdf-error"
                        role="alert"
                    >
                        <p>{pdfError}</p>
                    </div>
                )}

                {loading ? (
                    <div
                        className="client-invoices-state"
                        role="status"
                    >
                        Loading your invoice…
                    </div>
                ) : error ? (
                    <div
                        className="client-invoices-state"
                        role="alert"
                    >
                        <h2>Unable to load invoice</h2>
                        <p>{error}</p>
                        <button
                            type="button"
                            onClick={() =>
                                setRetry(
                                    (value) =>
                                        value + 1
                                )
                            }
                        >
                            Try again
                        </button>
                    </div>
                ) : selectedInvoice ? (
                    <InvoiceDocument
                        invoice={selectedInvoice}
                        items={
                            selectedInvoice.invoice_items
                        }
                        clientProfile={clientProfile}
                        booking={
                            selectedInvoice.bookings
                        }
                        service={
                            selectedInvoice.bookings
                                ?.services
                        }
                        photographerProfile={
                            photographerProfile
                        }
                        bookingLink={
                            selectedInvoice.booking_id
                                ? `/client/bookings/${selectedInvoice.booking_id}`
                                : ""
                        }
                    />
                ) : (
                    <div
                        className="client-invoices-state"
                        role="alert"
                    >
                        <h2>Invoice not found</h2>
                        <p>
                            This invoice is unavailable or
                            you do not have permission to
                            view it.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="client-invoices-page">
            <header className="client-invoices-header">
                <p className="client-invoices-eyebrow">
                    Your photography
                </p>
                <h1>My Invoices</h1>
                <p>
                    View your invoices, check due dates and
                    review your photography charges.
                </p>
            </header>

            {loading ? (
                <div
                    className="client-invoices-state"
                    role="status"
                >
                    Loading your invoices…
                </div>
            ) : error ? (
                <div
                    className="client-invoices-state"
                    role="alert"
                >
                    <h2>Unable to load invoices</h2>
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() =>
                            setRetry(
                                (value) => value + 1
                            )
                        }
                    >
                        Try again
                    </button>
                </div>
            ) : (
                <>
                    <section
                        className="client-invoices-summary"
                        aria-label="Invoice summary"
                    >
                        {summaries.map(
                            ([label, value]) => (
                                <div
                                    className="client-invoices-stat"
                                    key={label}
                                >
                                    <Receipt
                                        size={23}
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <span>
                                            {label}
                                        </span>
                                        <strong>
                                            {value}
                                        </strong>
                                    </div>
                                </div>
                            )
                        )}
                    </section>

                    <p className="client-invoices-summary-note">
                        Unpaid invoice totals show the full
                        value of sent and overdue invoices,
                        before any partial payments.
                    </p>

                    <div className="client-invoices-toolbar">
                        <label className="client-invoices-search">
                            <Search
                                size={18}
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                aria-label="Search invoices"
                                placeholder="Search invoice number, service or notes…"
                                value={search}
                                onChange={(event) =>
                                    setSearch(
                                        event.target.value
                                    )
                                }
                            />
                        </label>

                        <div
                            className="client-invoices-filters"
                            role="group"
                            aria-label="Filter invoices by status"
                        >
                            {FILTERS.map((value) => (
                                <button
                                    type="button"
                                    key={value}
                                    aria-pressed={
                                        filter === value
                                    }
                                    onClick={() =>
                                        setFilter(value)
                                    }
                                >
                                    {value}{" "}
                                    <span>
                                        {value === "all"
                                            ? records.length
                                            : records.filter(
                                                  (
                                                      invoice
                                                  ) =>
                                                      invoice.displayStatus ===
                                                      value
                                              ).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <p
                        className="client-invoices-result-count"
                        role="status"
                    >
                        Showing {visible.length} of{" "}
                        {records.length} invoices
                    </p>

                    {visible.length ? (
                        <div className="client-invoices-grid">
                            {visible.map((invoice) => (
                                <InvoiceCard
                                    key={
                                        invoice.invoice_id
                                    }
                                    invoice={invoice}
                                    onView={(
                                        invoiceId
                                    ) =>
                                        navigate(
                                            `/client/invoices/${invoiceId}`
                                        )
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="client-invoices-state">
                            <Receipt
                                size={32}
                                aria-hidden="true"
                            />
                            <h2>
                                {records.length
                                    ? "No matching invoices"
                                    : "No invoices yet"}
                            </h2>
                            <p>
                                {records.length
                                    ? "Try a different search or status filter."
                                    : "Invoices will appear here when your photographer sends them."}
                            </p>

                            {records.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        setFilter("all");
                                    }}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
