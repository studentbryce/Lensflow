import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BiReceipt as Receipt, BiSearch as Search } from "react-icons/bi";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { getClient, formatCurrency, formatDate, localToday } from "./bookingHelpers";
import "./Invoices.css";

const FILTERS = ["all", "sent", "overdue", "paid", "cancelled"];

function displayStatus(invoice, today) {
  return invoice.status === "sent" && invoice.due_date && invoice.due_date < today
    ? "overdue" : invoice.status;
}

function InvoiceCard({ invoice }) {
  return (
    <article className="client-invoice-card">
      <div className="client-invoice-card-heading">
        <div>
          <p className="client-invoices-eyebrow">Invoice</p>
          <h2>{invoice.invoice_number}</h2>
        </div>
        <span className="client-invoice-status" data-status={invoice.displayStatus}>{invoice.displayStatus}</span>
      </div>
      <p className="client-invoice-service">{invoice.bookings?.services?.name || "Photography session"}</p>
      <strong className="client-invoice-amount">{formatCurrency(invoice.total_amount)}</strong>
      <dl className="client-invoice-dates">
        <div><dt>Issued</dt><dd>{formatDate(invoice.issue_date)}</dd></div>
        <div><dt>Due</dt><dd className={invoice.displayStatus === "overdue" ? "client-invoice-overdue" : ""}>{invoice.due_date ? formatDate(invoice.due_date) : "Not specified"}</dd></div>
      </dl>
      <details className="client-invoice-details">
        <summary>View invoice details</summary>
        <div className="client-invoice-table-scroll" tabIndex={0} role="region" aria-label={`Items for invoice ${invoice.invoice_number}`}>
          <table>
            <caption>Invoice items</caption>
            <thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
            <tbody>
              {invoice.invoice_items.length ? invoice.invoice_items.map((item) => (
                <tr key={item.invoice_item_id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatCurrency(item.unit_price)}</td><td>{formatCurrency(item.subtotal)}</td></tr>
              )) : <tr><td colSpan={4}>No itemised charges available.</td></tr>}
            </tbody>
          </table>
        </div>
        <dl className="client-invoice-totals">
          <div><dt>Subtotal</dt><dd>{formatCurrency(invoice.subtotal)}</dd></div>
          <div><dt>GST ({Number(invoice.tax_rate)}%){invoice.tax_included ? " included" : " added"}</dt><dd>{formatCurrency(invoice.tax_amount)}</dd></div>
          <div><dt>Total (NZD)</dt><dd>{formatCurrency(invoice.total_amount)}</dd></div>
        </dl>
        {invoice.notes && <div className="client-invoice-notes"><h3>Notes</h3><p>{invoice.notes}</p></div>}
        {invoice.bookings && <Link className="client-invoice-link" to={`/client/bookings/${invoice.booking_id}`}>View booking · {formatDate(invoice.bookings.booking_date)} →</Link>}
        {["sent", "overdue"].includes(invoice.displayStatus) && <p className="client-invoice-payment-help">Please contact your photographer for payment instructions or questions about this invoice.</p>}
      </details>
    </article>
  );
}

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let active = true;
    async function loadInvoices() {
      setLoading(true);
      setError("");
      setInvoices([]);
      try {
        const client = await getClient(user?.id);
        const { data, error: queryError } = await supabase.from("invoices")
          .select(`
            invoice_id, booking_id, invoice_number, issue_date, due_date,
            subtotal, tax_amount, tax_rate, tax_included, total_amount, status, notes,
            bookings(booking_date, services(name)),
            invoice_items(invoice_item_id, description, quantity, unit_price, subtotal)
          `)
          .eq("client_id", client.client_id)
          .neq("status", "draft")
          .order("issue_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (active) setInvoices(data || []);
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
            {visible.length ? <div className="client-invoices-grid">{visible.map((invoice) => <InvoiceCard key={invoice.invoice_id} invoice={invoice} />)}</div> :
              <div className="client-invoices-state"><Receipt size={32} aria-hidden="true" /><h2>{records.length ? "No matching invoices" : "No invoices yet"}</h2><p>{records.length ? "Try a different search or status filter." : "Invoices will appear here when your photographer sends them."}</p>{records.length > 0 && <button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>}</div>}
          </>
        )}
    </div>
  );
}
