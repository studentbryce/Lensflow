import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BiReceipt as Receipt, BiSearch as Search } from "react-icons/bi";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { getClient, formatCurrency, formatDate, formatTime, localToday } from "./bookingHelpers";
import "./Invoices.css";

const FILTERS = ["all", "sent", "overdue", "paid", "cancelled"];

function displayStatus(invoice, today) {
  return invoice.status === "sent" && invoice.due_date && invoice.due_date < today
    ? "overdue" : invoice.status;
}

function InvoiceDocument({ invoice, clientProfile }) {
  const taxRate = Number(invoice.tax_rate) || 0;
  const clientName = [clientProfile?.first_name, clientProfile?.last_name]
    .filter(Boolean)
    .join(" ") || clientProfile?.email || "Client";

  return (
    <article className="client-invoice-document">
      <header className="client-invoice-document-header">
        <div>
          <span className="client-invoice-document-label">Invoice</span>
          <h2>{invoice.invoice_number}</h2>
          <span className="client-invoice-status client-invoice-document-status" data-status={invoice.displayStatus}>{invoice.displayStatus}</span>
        </div>

        <div className="client-invoice-document-meta">
          <div><span>Issue Date</span><strong>{formatDate(invoice.issue_date)}</strong></div>
          <div><span>Due Date</span><strong className={invoice.displayStatus === "overdue" ? "client-invoice-overdue" : ""}>{invoice.due_date ? formatDate(invoice.due_date) : "No due date"}</strong></div>
          {invoice.tax_number && <div><span>GST / Tax Number</span><strong>{invoice.tax_number}</strong></div>}
        </div>
      </header>

      <div className="client-invoice-information-grid">
        <section className="client-invoice-info-block">
          <span className="client-invoice-info-label">Billed To</span>
          <h3>{clientName}</h3>
          {clientProfile?.email && <p>{clientProfile.email}</p>}
          {clientProfile?.phone && <p>{clientProfile.phone}</p>}
        </section>
        <section className="client-invoice-info-block">
          <span className="client-invoice-info-label">Booking</span>
          {invoice.bookings ? (
            <>
              <h3>{invoice.bookings.services?.name || "Photography Booking"}</h3>
              <p>{formatDate(invoice.bookings.booking_date)}</p>
              {invoice.bookings.start_time && <p>{formatTime(invoice.bookings.start_time)}{invoice.bookings.end_time && ` – ${formatTime(invoice.bookings.end_time)}`}</p>}
              {invoice.bookings.location && <p>{invoice.bookings.location}</p>}
              <Link to={`/client/bookings/${invoice.booking_id}`}>View booking →</Link>
            </>
          ) : <h3>No booking information</h3>}
        </section>
      </div>

      <section className="client-invoice-items-section">
        <div className="client-invoice-section-heading">
          <div><span className="client-invoice-info-label">Charges</span><h3>Invoice Items</h3></div>
          <span>{invoice.invoice_items.length} {invoice.invoice_items.length === 1 ? "item" : "items"}</span>
        </div>
        <div className="client-invoice-table-scroll" tabIndex={0} role="region" aria-label={`Items for invoice ${invoice.invoice_number}`}>
          <table className="client-invoice-items-table">
            <thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
            <tbody>
              {invoice.invoice_items.length ? invoice.invoice_items.map((item) => (
                <tr key={item.invoice_item_id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatCurrency(item.unit_price)}</td><td>{formatCurrency(item.subtotal)}</td></tr>
              )) : <tr><td colSpan={4}>No itemised charges available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="client-invoice-bottom-section">
        <div className="client-invoice-tax-information">
          <span className="client-invoice-info-label">GST Treatment</span>
          <strong>{taxRate}% GST {invoice.tax_included ? "included" : "added"}</strong>
          <p>{invoice.tax_included ? "Service prices already include GST. The GST component is shown separately." : "GST is calculated on top of the service prices."}</p>
        </div>
        <dl className="client-invoice-totals">
          <div><dt>Subtotal</dt><dd>{formatCurrency(invoice.subtotal)}</dd></div>
          <div><dt>GST ({taxRate}%){invoice.tax_included ? " included" : ""}</dt><dd>{formatCurrency(invoice.tax_amount)}</dd></div>
          <div className="client-invoice-grand-total"><dt>Total (NZD)</dt><dd>{formatCurrency(invoice.total_amount)}</dd></div>
        </dl>
      </div>

      {invoice.bank_account_name && invoice.bank_account_number && (
        <section className="client-invoice-payment-section">
          <span className="client-invoice-info-label">Bank Transfer Details</span>
          <div className="client-invoice-payment-details">
            <div><span>Account Name</span><strong>{invoice.bank_account_name}</strong></div>
            {invoice.bank_name && <div><span>Bank</span><strong>{invoice.bank_name}</strong></div>}
            <div><span>Account Number</span><strong>{invoice.bank_account_number}</strong></div>
          </div>
          {invoice.bank_payment_instructions && <p>{invoice.bank_payment_instructions}</p>}
        </section>
      )}

      {invoice.notes && <section className="client-invoice-notes-section"><span className="client-invoice-info-label">Notes</span><p>{invoice.notes}</p></section>}
      {["sent", "overdue"].includes(invoice.displayStatus) && <p className="client-invoice-payment-help">Please contact your photographer if you have questions about this invoice or its payment instructions.</p>}
    </article>
  );
}

function InvoiceCard({ invoice, onView }) {
  return (
    <article className="client-invoice-card">
      <div className="client-invoice-card-heading">
        <div>
          <span className="client-invoice-card-number">{invoice.invoice_number}</span>
          <span className="client-invoice-status" data-status={invoice.displayStatus}>{invoice.displayStatus}</span>
        </div>
        <strong className="client-invoice-card-total">{formatCurrency(invoice.total_amount)}</strong>
      </div>

      <div className="client-invoice-card-service">
        <span>Photography Service</span>
        <h3>{invoice.bookings?.services?.name || "Photography session"}</h3>
      </div>

      <dl className="client-invoice-card-details">
        <div><dt>Booking</dt><dd>{invoice.bookings?.booking_date ? formatDate(invoice.bookings.booking_date) : "No booking"}</dd></div>
        <div><dt>Issued</dt><dd>{formatDate(invoice.issue_date)}</dd></div>
        <div><dt>Due</dt><dd className={invoice.displayStatus === "overdue" ? "client-invoice-overdue" : ""}>{invoice.due_date ? formatDate(invoice.due_date) : "No due date"}</dd></div>
        <div><dt>Subtotal</dt><dd>{formatCurrency(invoice.subtotal)}</dd></div>
      </dl>

      {invoice.notes && <div className="client-invoice-card-note"><span>Note</span><p>{invoice.notes}</p></div>}

      <div className="client-invoice-card-actions">
        <button type="button" onClick={() => onView(invoice.invoice_id)}>View Invoice</button>
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
  const [clientProfile, setClientProfile] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadInvoices() {
      setLoading(true);
      setError("");
      setInvoices([]);
      try {
        const client = await getClient(user?.id);
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, phone")
          .eq("user_id", user.id)
          .single();
        if (profileError) throw profileError;

        const { data, error: queryError } = await supabase.from("invoices")
          .select(`
            invoice_id, booking_id, invoice_number, issue_date, due_date,
            subtotal, tax_amount, tax_rate, tax_included, tax_number, total_amount, status, notes,
            bank_account_name, bank_name, bank_account_number, bank_payment_instructions,
            bookings(booking_date, start_time, end_time, location, services(name)),
            invoice_items(invoice_item_id, description, quantity, unit_price, subtotal)
          `)
          .eq("client_id", client.client_id)
          .neq("status", "draft")
          .order("issue_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (active) {
          setClientProfile(profileData);
          setInvoices(data || []);
        }
      } catch (err) {
        console.error("Unable to load client invoices:", err);
        if (active) setError("We couldn't load your invoices. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadInvoices();
    return () => { active = false; };
  }, [user?.id, retry]);

  const today = localToday();
  const records = invoices.map((invoice) => ({
    ...invoice,
    invoice_items: invoice.invoice_items || [],
    displayStatus: displayStatus(invoice, today),
  }));
  const visible = records.filter((invoice) =>
    (filter === "all" || invoice.displayStatus === filter) &&
    [invoice.invoice_number, invoice.bookings?.services?.name, invoice.notes]
      .filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase())
  );
  const unpaid = records.filter((invoice) => ["sent", "overdue"].includes(invoice.displayStatus));
  const summaries = [
    ["Your invoices", records.length],
    ["Unpaid invoice total", formatCurrency(unpaid.reduce((total, invoice) => total + Number(invoice.total_amount), 0))],
    ["Overdue invoices", records.filter((invoice) => invoice.displayStatus === "overdue").length],
    ["Paid invoices", records.filter((invoice) => invoice.displayStatus === "paid").length],
  ];

  if (invoice_id) {
    const selectedInvoice = records.find((invoice) => invoice.invoice_id === invoice_id);

    return (
      <div className="client-invoices-page client-invoice-detail-page">
        <button type="button" className="client-invoice-back-button" onClick={() => navigate("/client/invoices")}>← Back to Invoices</button>
        {loading ? <div className="client-invoices-state" role="status">Loading your invoice…</div> :
          error ? <div className="client-invoices-state" role="alert"><h2>Unable to load invoice</h2><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> :
            selectedInvoice ? <InvoiceDocument invoice={selectedInvoice} clientProfile={clientProfile} /> : <div className="client-invoices-state" role="alert"><h2>Invoice not found</h2><p>This invoice is unavailable or you do not have permission to view it.</p></div>}
      </div>
    );
  }

  return (
    <div className="client-invoices-page">
      <header className="client-invoices-header">
        <p className="client-invoices-eyebrow">Your photography</p>
        <h1>My Invoices</h1>
        <p>View your invoices, check due dates and review your photography charges.</p>
      </header>
      {loading ? <div className="client-invoices-state" role="status">Loading your invoices…</div> :
        error ? <div className="client-invoices-state" role="alert"><h2>Unable to load invoices</h2><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : (
          <>
            <section className="client-invoices-summary" aria-label="Invoice summary">
              {summaries.map(([label, value]) => <div className="client-invoices-stat" key={label}><Receipt size={23} aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div>)}
            </section>
            <p className="client-invoices-summary-note">Unpaid invoice totals show the full value of sent and overdue invoices, before any partial payments.</p>
            <div className="client-invoices-toolbar">
              <label className="client-invoices-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search invoices" placeholder="Search invoice number, service or notes…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <div className="client-invoices-filters" role="group" aria-label="Filter invoices by status">
                {FILTERS.map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value} <span>{value === "all" ? records.length : records.filter((invoice) => invoice.displayStatus === value).length}</span></button>)}
              </div>
            </div>
            <p className="client-invoices-result-count" role="status">Showing {visible.length} of {records.length} invoices</p>
            {visible.length ? <div className="client-invoices-grid">{visible.map((invoice) => <InvoiceCard key={invoice.invoice_id} invoice={invoice} onView={(invoiceId) => navigate(`/client/invoices/${invoiceId}`)} />)}</div> :
              <div className="client-invoices-state"><Receipt size={32} aria-hidden="true" /><h2>{records.length ? "No matching invoices" : "No invoices yet"}</h2><p>{records.length ? "Try a different search or status filter." : "Invoices will appear here when your photographer sends them."}</p>{records.length > 0 && <button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>}</div>}
          </>
        )}
    </div>
  );
}
