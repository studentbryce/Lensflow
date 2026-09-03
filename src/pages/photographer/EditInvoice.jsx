import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import "./NewEditInvoice.css";

const EMPTY_ITEM = {
    service_id: "",
    description: "",
    quantity: 1,
    unit_price: "",
};

function formatCurrency(value) {
    return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: "NZD",
    }).format(Number(value || 0));
}

function getClientName(profile) {
    if (!profile) return "Unknown Client";

    const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.email || "Unknown Client";
}

function formatDate(date) {
    if (!date) return "—";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function EditInvoice() {
    const navigate = useNavigate();
    const { invoice_id } = useParams();
    const { user } = useAuth();

    const [clients, setClients] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [services, setServices] = useState([]);

    const [formData, setFormData] = useState({
        client_id: "",
        booking_id: "",
        invoice_number: "",
        issue_date: "",
        due_date: "",
        status: "draft",
        tax_rate: 15,
        tax_included: false,
        notes: "",
    });

    const [items, setItems] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    /*
     * Load the invoice and all supporting data.
     */
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

        loadInvoiceData();
    }, [user, invoice_id]);

    async function loadInvoiceData() {
        try {
            setLoading(true);
            setError("");

            /*
             * Get the current photographer ID.
             *
             * RLS remains the actual ownership/security boundary.
             */
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
                throw new Error(
                    "A photographer profile could not be found for this account."
                );
            }

            /*
             * Load the invoice.
             *
             * We do not add a photographer_id filter here because
             * Supabase RLS is responsible for ownership enforcement.
             */
            const { data: invoice, error: invoiceError } =
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

            if (!invoice) {
                throw new Error("Invoice could not be found.");
            }

            /*
             * Load invoice items.
             */
            const { data: invoiceItems, error: invoiceItemsError } =
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

            if (invoiceItemsError) {
                throw invoiceItemsError;
            }

            /*
             * Load clients.
             */
            const { data: clientData, error: clientError } =
                await supabase
                    .from("clients")
                    .select(`
                        client_id,
                        user_id
                    `)
                    .order("created_at", {
                        ascending: false,
                    });

            if (clientError) {
                throw clientError;
            }

            /*
             * Load client profiles separately because profiles
             * has its own RLS policy.
             */
            const clientUserIds = [
                ...new Set(
                    (clientData || [])
                        .map((client) => client.user_id)
                        .filter(Boolean)
                ),
            ];

            let profileData = [];

            if (clientUserIds.length > 0) {
                const { data: profiles, error: profileError } =
                    await supabase
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

                profileData = profiles || [];
            }

            const profileMap = new Map(
                profileData.map((profile) => [
                    profile.user_id,
                    profile,
                ])
            );

            const formattedClients = (clientData || []).map(
                (client) => ({
                    ...client,
                    profile:
                        profileMap.get(client.user_id) || null,
                })
            );

            /*
             * Load bookings.
             */
            const { data: bookingData, error: bookingError } =
                await supabase
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
                    .order("booking_date", {
                        ascending: false,
                    });

            if (bookingError) {
                throw bookingError;
            }

            /*
             * Load active services.
             */
            const { data: serviceData, error: serviceError } =
                await supabase
                    .from("services")
                    .select(`
                        service_id,
                        name,
                        description,
                        price,
                        duration_minutes,
                        deposit_amount,
                        is_active
                    `)
                    .eq("is_active", true)
                    .order("name", {
                        ascending: true,
                    });

            if (serviceError) {
                throw serviceError;
            }

            /*
             * Convert database invoice items into the same
             * editable structure used by NewInvoice.jsx.
             */
            const formattedItems = (invoiceItems || []).map(
                (item) => ({
                    invoice_item_id:
                        item.invoice_item_id,
                    service_id:
                        item.service_id || "",
                    description:
                        item.description || "",
                    quantity:
                        item.quantity ?? 1,
                    unit_price:
                        item.unit_price ?? "",
                })
            );

            /*
             * An invoice should contain at least one item.
             * This also prevents the edit form from displaying
             * an empty invoice unexpectedly.
             */
            if (formattedItems.length === 0) {
                formattedItems.push({
                    ...EMPTY_ITEM,
                });
            }

            setClients(formattedClients);
            setBookings(bookingData || []);
            setServices(serviceData || []);

            setFormData({
                client_id: invoice.client_id || "",
                booking_id: invoice.booking_id || "",
                invoice_number:
                    invoice.invoice_number || "",
                issue_date:
                    invoice.issue_date || "",
                due_date:
                    invoice.due_date || "",
                status:
                    invoice.status || "draft",
                tax_rate:
                    invoice.tax_rate ?? 15,
                tax_included:
                    Boolean(invoice.tax_included),
                notes:
                    invoice.notes || "",
            });

            setItems(formattedItems);
        } catch (err) {
            console.error(
                "Error loading invoice:",
                err
            );

            setError(
                err.message ||
                    "Unable to load the invoice."
            );
        } finally {
            setLoading(false);
        }
    }

    /*
     * Only show bookings belonging to the selected client.
     */
    const selectedClientBookings = useMemo(() => {
        if (!formData.client_id) return [];

        return bookings.filter(
            (booking) =>
                booking.client_id ===
                formData.client_id
        );
    }, [bookings, formData.client_id]);

    /*
     * Calculate invoice subtotal from line items.
     */
    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => {
            const quantity =
                Number(item.quantity) || 0;

            const unitPrice =
                Number(item.unit_price) || 0;

            return (
                sum +
                quantity * unitPrice
            );
        }, 0);
    }, [items]);

    /*
     * GST calculation.
     *
     * GST excluded:
     * $1,000 + 15% GST = $1,150.
     *
     * GST included:
     * $1,000 total contains $130.43 GST.
     */
    const taxAmount = useMemo(() => {
        const rate =
            Number(formData.tax_rate) || 0;

        if (formData.tax_included) {
            if (rate === 0) return 0;

            return (
                subtotal *
                (rate / (100 + rate))
            );
        }

        return subtotal * (rate / 100);
    }, [
        subtotal,
        formData.tax_rate,
        formData.tax_included,
    ]);

    /*
     * Calculate final invoice total.
     */
    const totalAmount = useMemo(() => {
        if (formData.tax_included) {
            return subtotal;
        }

        return subtotal + taxAmount;
    }, [
        subtotal,
        taxAmount,
        formData.tax_included,
    ]);

    function handleChange(event) {
        const { name, value } =
            event.target;

        setFormData((current) => ({
            ...current,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    }

    function handleClientChange(event) {
        const clientId =
            event.target.value;

        setFormData((current) => ({
            ...current,
            client_id: clientId,
            booking_id: "",
        }));

        setError("");
        setSuccess("");
    }

    function handleTaxIncludedChange(
        value
    ) {
        setFormData((current) => ({
            ...current,
            tax_included: value,
        }));

        setError("");
        setSuccess("");
    }

    function handleServiceChange(
        index,
        serviceId
    ) {
        const selectedService =
            services.find(
                (service) =>
                    service.service_id ===
                    serviceId
            );

        setItems((current) =>
            current.map(
                (item, itemIndex) => {
                    if (
                        itemIndex !==
                        index
                    ) {
                        return item;
                    }

                    if (!selectedService) {
                        return {
                            ...item,
                            service_id: "",
                        };
                    }

                    return {
                        ...item,
                        service_id:
                            selectedService.service_id,
                        description:
                            selectedService.description ||
                            selectedService.name ||
                            "",
                        unit_price:
                            selectedService.price ??
                            "",
                    };
                }
            )
        );

        setError("");
        setSuccess("");
    }

    function handleItemChange(
        index,
        field,
        value
    ) {
        setItems((current) =>
            current.map(
                (item, itemIndex) =>
                    itemIndex === index
                        ? {
                              ...item,
                              [field]:
                                  value,
                          }
                        : item
            )
        );

        setError("");
        setSuccess("");
    }

    function addItem() {
        setItems((current) => [
            ...current,
            {
                ...EMPTY_ITEM,
            },
        ]);

        setError("");
    }

    function removeItem(index) {
        if (items.length === 1) {
            setError(
                "An invoice must contain at least one invoice item."
            );
            return;
        }

        setItems((current) =>
            current.filter(
                (_, itemIndex) =>
                    itemIndex !== index
            )
        );

        setError("");
    }

    function validateForm() {
        if (!formData.client_id) {
            return "Please select a client.";
        }

        if (!formData.booking_id) {
            return "Please select a booking for this invoice.";
        }

        if (!formData.invoice_number.trim()) {
            return "Please enter an invoice number.";
        }

        if (!formData.issue_date) {
            return "Please enter an issue date.";
        }

        if (
            formData.due_date &&
            formData.due_date <
                formData.issue_date
        ) {
            return "The due date cannot be before the issue date.";
        }

        if (
            ![
                "draft",
                "sent",
                "paid",
                "overdue",
                "cancelled",
            ].includes(formData.status)
        ) {
            return "Please select a valid invoice status.";
        }

        const taxRate =
            Number(formData.tax_rate);

        if (
            Number.isNaN(taxRate) ||
            taxRate < 0 ||
            taxRate > 100
        ) {
            return "GST rate must be between 0% and 100%.";
        }

        if (items.length === 0) {
            return "Please add at least one invoice item.";
        }

        for (
            let index = 0;
            index < items.length;
            index += 1
        ) {
            const item = items[index];

            if (
                !item.description ||
                !item.description.trim()
            ) {
                return `Please enter a description for invoice item ${
                    index + 1
                }.`;
            }

            if (
                !Number.isInteger(
                    Number(item.quantity)
                ) ||
                Number(item.quantity) <= 0
            ) {
                return `Quantity for invoice item ${
                    index + 1
                } must be a positive whole number.`;
            }

            if (
                item.unit_price === "" ||
                Number(item.unit_price) < 0
            ) {
                return `Unit price for invoice item ${
                    index + 1
                } cannot be negative or empty.`;
            }
        }

        if (
            subtotal < 0 ||
            taxAmount < 0 ||
            totalAmount < 0
        ) {
            return "Invoice totals cannot be negative.";
        }

        return null;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const validationError =
            validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        if (!user) {
            setError(
                "You must be signed in to edit an invoice."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            /*
             * Get current photographer.
             */
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

            if (!photographer?.photographer_id) {
                throw new Error(
                    "A photographer profile could not be found."
                );
            }

            /*
             * Verify selected client is available to
             * this photographer.
             */
            const selectedClient =
                clients.find(
                    (client) =>
                        client.client_id ===
                        formData.client_id
                );

            if (!selectedClient) {
                throw new Error(
                    "The selected client could not be verified."
                );
            }

            /*
             * Verify selected booking belongs to
             * the selected client.
             */
            const selectedBooking =
                selectedClientBookings.find(
                    (booking) =>
                        booking.booking_id ===
                        formData.booking_id
                );

            if (!selectedBooking) {
                throw new Error(
                    "The selected booking does not belong to the selected client."
                );
            }

            /*
             * Update the invoice.
             */
            const {
                error: invoiceError,
            } = await supabase
                .from("invoices")
                .update({
                    client_id:
                        formData.client_id,
                    booking_id:
                        formData.booking_id,
                    invoice_number:
                        formData.invoice_number.trim(),
                    issue_date:
                        formData.issue_date,
                    due_date:
                        formData.due_date || null,
                    subtotal:
                        Number(
                            subtotal.toFixed(2)
                        ),
                    tax_rate:
                        Number(
                            Number(
                                formData.tax_rate
                            ).toFixed(2)
                        ),
                    tax_included:
                        Boolean(
                            formData.tax_included
                        ),
                    tax_amount:
                        Number(
                            taxAmount.toFixed(2)
                        ),
                    total_amount:
                        Number(
                            totalAmount.toFixed(2)
                        ),
                    status:
                        formData.status,
                    notes:
                        formData.notes.trim() ||
                        null,
                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "invoice_id",
                    invoice_id
                );

            if (invoiceError) {
                throw invoiceError;
            }

            /*
             * Replace the existing invoice items.
             *
             * The invoice_items table is treated as the
             * current snapshot of the invoice's line items.
             */
            const {
                error: deleteItemsError,
            } = await supabase
                .from("invoice_items")
                .delete()
                .eq(
                    "invoice_id",
                    invoice_id
                );

            if (deleteItemsError) {
                throw deleteItemsError;
            }

            /*
             * Build the updated invoice items.
             */
            const invoiceItems =
                items.map((item) => {
                    const quantity =
                        Number(
                            item.quantity
                        );

                    const unitPrice =
                        Number(
                            item.unit_price
                        );

                    const itemSubtotal =
                        quantity *
                        unitPrice;

                    return {
                        photographer_id:
                            photographer.photographer_id,
                        invoice_id:
                            invoice_id,
                        service_id:
                            item.service_id ||
                            null,
                        description:
                            item.description.trim(),
                        quantity,
                        unit_price:
                            Number(
                                unitPrice.toFixed(
                                    2
                                )
                            ),
                        subtotal:
                            Number(
                                itemSubtotal.toFixed(
                                    2
                                )
                            ),
                    };
                });

            /*
             * Insert the updated items.
             */
            const {
                error: insertItemsError,
            } = await supabase
                .from("invoice_items")
                .insert(
                    invoiceItems
                );

            if (insertItemsError) {
                throw insertItemsError;
            }

            setSuccess(
                "Invoice updated successfully."
            );

            /*
             * Give the user a short success message
             * before returning to the invoice.
             */
            setTimeout(() => {
                navigate(
                    `/photographer/invoices/${invoice_id}`
                );
            }, 700);
        } catch (err) {
            console.error(
                "Error updating invoice:",
                err
            );

            setError(
                err.message ||
                    "Unable to update the invoice. Please try again."
            );
        } finally {
            setSaving(false);
        }
    }

    /*
     * Loading state.
     */
    if (loading) {
        return (
            <main className="new-invoice-page">
                <div className="new-invoice-state">
                    <div className="new-invoice-spinner" />

                    <h2>
                        Loading invoice...
                    </h2>

                    <p>
                        Preparing the invoice for editing.
                    </p>
                </div>
            </main>
        );
    }

    /*
     * Error state if the invoice itself could not
     * be loaded.
     */
    if (error && !formData.invoice_number) {
        return (
            <main className="new-invoice-page">
                <header className="new-invoice-header">
                    <div>
                        <p className="new-invoice-eyebrow">
                            FINANCIAL MANAGEMENT
                        </p>

                        <h1>
                            Edit Invoice
                        </h1>

                        <p className="new-invoice-description">
                            Update the selected invoice.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="new-invoice-back-button"
                        onClick={() =>
                            navigate(
                                "/photographer/invoices"
                            )
                        }
                    >
                        ← Back to Invoices
                    </button>
                </header>

                <div className="new-invoice-message error-message">
                    <strong>
                        Unable to load invoice
                    </strong>

                    <span>{error}</span>
                </div>
            </main>
        );
    }

    return (
        <main className="new-invoice-page">
            <header className="new-invoice-header">
                <div>
                    <p className="new-invoice-eyebrow">
                        FINANCIAL MANAGEMENT
                    </p>

                    <h1>
                        Edit Invoice
                    </h1>

                    <p className="new-invoice-description">
                        Update the details, services,
                        GST and notes for this invoice.
                    </p>
                </div>

                <button
                    type="button"
                    className="new-invoice-back-button"
                    onClick={() =>
                        navigate(
                            `/photographer/invoices/${invoice_id}`
                        )
                    }
                    disabled={saving}
                >
                    ← Back to Invoice
                </button>
            </header>

            {error && (
                <div className="new-invoice-message error-message">
                    <strong>
                        Unable to update invoice
                    </strong>

                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="new-invoice-message success-message">
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* =========================
                    SECTION 01
                ========================= */}

                <section className="invoice-form-section">
                    <div className="invoice-section-heading">
                        <span>01</span>

                        <div>
                            <h2>
                                Client & Booking
                            </h2>

                            <p>
                                Select the client and
                                booking associated with
                                this invoice.
                            </p>
                        </div>
                    </div>

                    <div className="invoice-form-grid two-column">
                        <div className="invoice-field">
                            <label htmlFor="client_id">
                                Client{" "}
                                <span>*</span>
                            </label>

                            <select
                                id="client_id"
                                name="client_id"
                                value={
                                    formData.client_id
                                }
                                onChange={
                                    handleClientChange
                                }
                                required
                            >
                                <option value="">
                                    Select a client
                                </option>

                                {clients.map(
                                    (client) => (
                                        <option
                                            key={
                                                client.client_id
                                            }
                                            value={
                                                client.client_id
                                            }
                                        >
                                            {getClientName(
                                                client.profile
                                            )}
                                        </option>
                                    )
                                )}
                            </select>

                            {clients.length ===
                                0 && (
                                <small className="invoice-field-help">
                                    No clients are
                                    currently
                                    available.
                                </small>
                            )}
                        </div>

                        <div className="invoice-field">
                            <label htmlFor="booking_id">
                                Booking{" "}
                                <span>*</span>
                            </label>

                            <select
                                id="booking_id"
                                name="booking_id"
                                value={
                                    formData.booking_id
                                }
                                onChange={
                                    handleChange
                                }
                                disabled={
                                    !formData.client_id
                                }
                                required
                            >
                                <option value="">
                                    {formData.client_id
                                        ? "Select a booking"
                                        : "Select a client first"}
                                </option>

                                {selectedClientBookings.map(
                                    (
                                        booking
                                    ) => (
                                        <option
                                            key={
                                                booking.booking_id
                                            }
                                            value={
                                                booking.booking_id
                                            }
                                        >
                                            {formatDate(
                                                booking.booking_date
                                            )}{" "}
                                            —{" "}
                                            {
                                                booking.status
                                            }
                                        </option>
                                    )
                                )}
                            </select>

                            <small className="invoice-field-help">
                                Only bookings
                                belonging to the
                                selected client are
                                shown.
                            </small>
                        </div>
                    </div>
                </section>

                {/* =========================
                    SECTION 02
                ========================= */}

                <section className="invoice-form-section">
                    <div className="invoice-section-heading">
                        <span>02</span>

                        <div>
                            <h2>
                                Invoice Details
                            </h2>

                            <p>
                                Update the invoice
                                number, dates and
                                current status.
                            </p>
                        </div>
                    </div>

                    <div className="invoice-form-grid four-column">
                        <div className="invoice-field">
                            <label htmlFor="invoice_number">
                                Invoice Number{" "}
                                <span>*</span>
                            </label>

                            <input
                                id="invoice_number"
                                name="invoice_number"
                                type="text"
                                value={
                                    formData.invoice_number
                                }
                                onChange={
                                    handleChange
                                }
                                maxLength={50}
                                required
                            />
                        </div>

                        <div className="invoice-field">
                            <label htmlFor="issue_date">
                                Issue Date{" "}
                                <span>*</span>
                            </label>

                            <input
                                id="issue_date"
                                name="issue_date"
                                type="date"
                                value={
                                    formData.issue_date
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>

                        <div className="invoice-field">
                            <label htmlFor="due_date">
                                Due Date
                            </label>

                            <input
                                id="due_date"
                                name="due_date"
                                type="date"
                                value={
                                    formData.due_date
                                }
                                min={
                                    formData.issue_date
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>

                        <div className="invoice-field">
                            <label htmlFor="status">
                                Status
                            </label>

                            <select
                                id="status"
                                name="status"
                                value={
                                    formData.status
                                }
                                onChange={
                                    handleChange
                                }
                            >
                                <option value="draft">
                                    Draft
                                </option>

                                <option value="sent">
                                    Sent
                                </option>

                                <option value="paid">
                                    Paid
                                </option>

                                <option value="overdue">
                                    Overdue
                                </option>

                                <option value="cancelled">
                                    Cancelled
                                </option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* =========================
                    SECTION 03
                ========================= */}

                <section className="invoice-form-section">
                    <div className="invoice-section-heading">
                        <span>03</span>

                        <div>
                            <h2>
                                Invoice Items
                            </h2>

                            <p>
                                Update photography
                                services or custom
                                line items.
                            </p>
                        </div>
                    </div>

                    <div className="invoice-items">
                        <div className="invoice-item-header">
                            <span>
                                Service
                            </span>

                            <span>
                                Description
                            </span>

                            <span>
                                Qty
                            </span>

                            <span>
                                Unit Price
                            </span>

                            <span>
                                Subtotal
                            </span>

                            <span />
                        </div>

                        {items.map(
                            (item, index) => {
                                const itemSubtotal =
                                    (Number(
                                        item.quantity
                                    ) || 0) *
                                    (Number(
                                        item.unit_price
                                    ) || 0);

                                return (
                                    <div
                                        className="invoice-item-row"
                                        key={
                                            item.invoice_item_id ||
                                            index
                                        }
                                    >
                                        <div className="invoice-item-mobile-label">
                                            Service
                                        </div>

                                        <select
                                            value={
                                                item.service_id
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleServiceChange(
                                                    index,
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Custom item
                                            </option>

                                            {services.map(
                                                (
                                                    service
                                                ) => (
                                                    <option
                                                        key={
                                                            service.service_id
                                                        }
                                                        value={
                                                            service.service_id
                                                        }
                                                    >
                                                        {
                                                            service.name
                                                        }
                                                    </option>
                                                )
                                            )}
                                        </select>

                                        <div className="invoice-item-mobile-label">
                                            Description
                                        </div>

                                        <input
                                            type="text"
                                            value={
                                                item.description
                                            }
                                            placeholder="Photography service"
                                            maxLength={
                                                255
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleItemChange(
                                                    index,
                                                    "description",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        />

                                        <div className="invoice-item-mobile-label">
                                            Quantity
                                        </div>

                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={
                                                item.quantity
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                handleItemChange(
                                                    index,
                                                    "quantity",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        />

                                        <div className="invoice-item-mobile-label">
                                            Unit Price
                                        </div>

                                        <div className="invoice-price-input">
                                            <span>
                                                $
                                            </span>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    item.unit_price
                                                }
                                                placeholder="0.00"
                                                onChange={(
                                                    event
                                                ) =>
                                                    handleItemChange(
                                                        index,
                                                        "unit_price",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                            />
                                        </div>

                                        <div className="invoice-item-mobile-label">
                                            Subtotal
                                        </div>

                                        <strong className="invoice-item-subtotal">
                                            {formatCurrency(
                                                itemSubtotal
                                            )}
                                        </strong>

                                        <button
                                            type="button"
                                            className="remove-item-button"
                                            onClick={() =>
                                                removeItem(
                                                    index
                                                )
                                            }
                                            aria-label={`Remove invoice item ${
                                                index +
                                                1
                                            }`}
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            }
                        )}
                    </div>

                    <button
                        type="button"
                        className="add-item-button"
                        onClick={addItem}
                    >
                        + Add Invoice Item
                    </button>
                </section>

                {/* =========================
                    SECTION 04
                ========================= */}

                <section className="invoice-form-section invoice-totals-section">
                    <div className="invoice-section-heading">
                        <span>04</span>

                        <div>
                            <h2>
                                Totals
                            </h2>

                            <p>
                                Review the invoice
                                amount and GST
                                treatment.
                            </p>
                        </div>
                    </div>

                    <div className="invoice-totals-content">
                        <div className="invoice-tax-settings">
                            <div className="invoice-field">
                                <label htmlFor="tax_rate">
                                    GST Rate (%)
                                </label>

                                <input
                                    id="tax_rate"
                                    name="tax_rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={
                                        formData.tax_rate
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                                <span className="invoice-field-help">
                                    The GST rate
                                    applied to this
                                    invoice.
                                </span>
                            </div>

                            <div className="invoice-field">
                                <label>
                                    GST Pricing
                                </label>

                                <div className="tax-options">
                                    <label
                                        className={`tax-option ${
                                            !formData.tax_included
                                                ? "selected"
                                                : ""
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="tax_included"
                                            checked={
                                                !formData.tax_included
                                            }
                                            onChange={() =>
                                                handleTaxIncludedChange(
                                                    false
                                                )
                                            }
                                        />

                                        <div>
                                            <strong>
                                                GST
                                                added to
                                                prices
                                            </strong>

                                            <span>
                                                GST is
                                                calculated
                                                on top of
                                                the
                                                service
                                                prices.
                                            </span>
                                        </div>
                                    </label>

                                    <label
                                        className={`tax-option ${
                                            formData.tax_included
                                                ? "selected"
                                                : ""
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="tax_included"
                                            checked={
                                                formData.tax_included
                                            }
                                            onChange={() =>
                                                handleTaxIncludedChange(
                                                    true
                                                )
                                            }
                                        />

                                        <div>
                                            <strong>
                                                GST
                                                included
                                                in prices
                                            </strong>

                                            <span>
                                                Service
                                                prices
                                                already
                                                include
                                                GST.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="invoice-totals">
                            <div className="invoice-total-row">
                                <span>
                                    Subtotal
                                </span>

                                <strong>
                                    {formatCurrency(
                                        subtotal
                                    )}
                                </strong>
                            </div>

                            <div className="invoice-total-row">
                                <span>
                                    GST (
                                    {Number(
                                        formData.tax_rate
                                    ).toFixed(
                                        2
                                    )}
                                    %)
                                    {formData.tax_included
                                        ? " included"
                                        : ""}
                                </span>

                                <strong>
                                    {formatCurrency(
                                        taxAmount
                                    )}
                                </strong>
                            </div>

                            <div className="invoice-total-row grand-total">
                                <span>
                                    Total
                                </span>

                                <strong>
                                    {formatCurrency(
                                        totalAmount
                                    )}
                                </strong>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =========================
                    SECTION 05
                ========================= */}

                <section className="invoice-form-section">
                    <div className="invoice-section-heading">
                        <span>05</span>

                        <div>
                            <h2>
                                Notes
                            </h2>

                            <p>
                                Update any additional
                                information for this
                                invoice.
                            </p>
                        </div>
                    </div>

                    <div className="invoice-field">
                        <label htmlFor="notes">
                            Invoice Notes
                        </label>

                        <textarea
                            id="notes"
                            name="notes"
                            value={
                                formData.notes
                            }
                            onChange={
                                handleChange
                            }
                            rows="5"
                            placeholder="Add payment instructions, terms or other notes..."
                        />
                    </div>
                </section>

                {/* =========================
                    ACTIONS
                ========================= */}

                <div className="new-invoice-actions">
                    <button
                        type="button"
                        className="invoice-action secondary"
                        onClick={() =>
                            navigate(
                                `/photographer/invoices/${invoice_id}`
                            )
                        }
                        disabled={saving}
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="invoice-action primary"
                        disabled={saving}
                    >
                        {saving
                            ? "Saving Changes..."
                            : "Save Changes"}
                    </button>
                </div>
            </form>
        </main>
    );
}