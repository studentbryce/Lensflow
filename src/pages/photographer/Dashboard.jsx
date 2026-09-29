import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BiImage, BiFile } from "react-icons/bi";
import { supabase } from "../../lib/supabaseClient";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import StatCard from "../../components/dashboard/StatCard";
import "./Dashboard.css";

const currency = (n) => new Intl.NumberFormat("en-NZ", {
  style: "currency", currency: "NZD"
}).format(Number(n || 0));
const dateText = (s) => s ? new Date(`${s.slice(0,10)}T00:00:00`)
  .toLocaleDateString("en-NZ", {day:"numeric",month:"short"}) : "No date";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({bookings:0,clients:0,outstanding:0,galleries:0});
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [recentGalleries, setRecentGalleries] = useState([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const {data:{user},error:authError} = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("No authenticated user found.");
        const {data:photographer,error:profileError} = await supabase
          .from("photographer_profiles")
          .select("photographer_id,business_name,slug,profile_image_url")
          .eq("user_id",user.id).single();
        if (profileError) throw profileError;
        const id = photographer.photographer_id;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
        const [bookings,clients,invoices,galleries,galleryCount] = await Promise.all([
          supabase.from("bookings").select(`
            booking_id,booking_date,start_time,end_time,status,total_amount,
            clients(client_id,user_id,profiles(first_name,last_name)),
            services(service_id,name)
          `).eq("photographer_id",id).gte("booking_date",today)
            .in("status",["pending","confirmed"])
            .order("booking_date",{ascending:true})
            .order("start_time",{ascending:true}).limit(5),
          supabase.from("clients").select("client_id",{count:"exact",head:true})
            .eq("photographer_id",id),
          supabase.from("invoices").select("*").eq("photographer_id",id)
            .in("status",["draft","sent","overdue"])
            .order("created_at",{ascending:false}),
          supabase.from("galleries").select("*").eq("photographer_id",id)
            .order("created_at",{ascending:false}).limit(4),
          supabase.from("galleries").select("gallery_id",{count:"exact",head:true})
            .eq("photographer_id",id).eq("is_published",true)
        ]);
        for (const result of [bookings,clients,invoices,galleries,galleryCount]) {
          if (result.error) throw result.error;
        }
        if (!active) return;
        const unpaid = invoices.data || [];
        setProfile(photographer);
        setUpcomingBookings(bookings.data || []);
        setRecentGalleries(galleries.data || []);
        setOutstandingInvoices([...unpaid].sort((a,b)=>
          (a.due_date||"9999-12-31").localeCompare(b.due_date||"9999-12-31")
        ).slice(0,3));
        setStats({
          bookings:bookings.data?.length||0,
          clients:clients.count||0,
          outstanding:unpaid.reduce((sum,x)=>sum+Number(x.total_amount||0),0),
          galleries:galleryCount.count||0
        });
      } catch(e) {
        console.error("Dashboard error:",e);
        if (active) setError(e.message||"Unable to load dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDashboard();
    return () => { active=false; };
  },[retry]);

  if (loading) return <div className="dashboard-page"><div className="dashboard-loading">Loading your dashboard...</div></div>;
  if (error) return <div className="dashboard-page"><div className="dashboard-error">
    <h2>Unable to load dashboard</h2><p>{error}</p>
    <button type="button" onClick={()=>setRetry(n=>n+1)}>Try Again</button>
  </div></div>;

  return <div className="dashboard-page photographer-dashboard">
    <DashboardHeader profile={profile}/>
    <section className="dashboard-stats" aria-label="Dashboard summary">
      <StatCard title="Upcoming Bookings" value={stats.bookings} description="Upcoming sessions"/>
      <StatCard title="Clients" value={stats.clients} description="Active clients"/>
      <StatCard title="Outstanding" value={currency(stats.outstanding)} description="Unpaid invoices"/>
      <StatCard title="Galleries" value={stats.galleries} description="Published galleries"/>
    </section>
    <section className="dashboard-section dashboard-mini-card dashboard-bookings-card">
      <div className="section-heading"><div><span className="eyebrow">Your schedule</span>
        <h2>Upcoming Bookings</h2></div>
        <Link className="dashboard-view-all" to="/photographer/bookings">View all</Link>
      </div>
      {!upcomingBookings.length ? <div className="dashboard-mini-empty"><p>No upcoming bookings.</p></div> :
      <div className="dashboard-mini-list">{upcomingBookings.map(b=>{
        const name=[b.clients?.profiles?.first_name,b.clients?.profiles?.last_name]
          .filter(Boolean).join(" ")||"Unknown Client";
        return <div className="dashboard-booking-row" key={b.booking_id}>
          <div className="dashboard-booking-icon dashboard-booking-date"><strong>{dateText(b.booking_date)}</strong>
            <span>{b.start_time?.slice(0,5)||"—"}</span></div>
          <div className="dashboard-info"><strong title={name}>{name}</strong>
            <span>{b.services?.name||"Photography Session"}</span></div>
          <div className="dashboard-booking-right">
            <strong>{currency(b.total_amount)}</strong>
            <span className={`dashboard-mini-badge ${b.status === "confirmed" ? "is-published" : "is-draft"}`}>{b.status}</span>
          </div>
        </div>;
      })}</div>}
    </section>
    <div className="dashboard-bottom-grid">
      <section className="dashboard-section dashboard-mini-card">
        <div className="section-heading"><div><span className="eyebrow">Your photos</span>
          <h2>Recent Galleries</h2></div>
          <Link className="dashboard-view-all" to="/photographer/galleries">View all</Link>
        </div>
        {!recentGalleries.length ? <div className="dashboard-mini-empty">
          <BiImage size={28}/><p>No galleries yet.</p></div> :
        <div className="dashboard-mini-list">{recentGalleries.map(g=>
          <div className="dashboard-gallery-row" key={g.gallery_id}>
            <div className="dashboard-gallery-thumb"><BiImage/></div>
            <div className="dashboard-mini-info">
              <strong>{g.title||g.name||g.gallery_name||"Untitled Gallery"}</strong>
              <span>{g.description||dateText(g.created_at)}</span>
            </div>
            <span className={`dashboard-mini-badge ${g.is_published?"is-published":"is-draft"}`}>
              {g.is_published?"Available":"Draft"}
            </span>
          </div>
        )}</div>}
      </section>
      <section className="dashboard-section dashboard-mini-card">
        <div className="section-heading"><div><span className="eyebrow">Payments</span>
          <h2>Outstanding Invoices</h2></div>
          <Link className="dashboard-view-all" to="/photographer/invoices">View all</Link>
        </div>
        {!outstandingInvoices.length ? <div className="dashboard-mini-empty">
          <BiFile size={28}/><p>No outstanding invoices.</p></div> :
        <div className="dashboard-mini-list">{outstandingInvoices.map(i=>
          <div className="dashboard-invoice-row" key={i.invoice_id}>
            <div className="dashboard-invoice-icon"><BiFile/></div>
            <div className="dashboard-mini-info">
              <strong>{i.invoice_number||"Invoice"}</strong>
              <span>{i.due_date?`Due ${dateText(i.due_date)}`:"No due date"}</span>
            </div>
            <div className="dashboard-invoice-right">
              <strong>{currency(i.total_amount)}</strong>
              <span className={`dashboard-mini-badge invoice-${i.status}`}>{i.status}</span>
            </div>
          </div>
        )}</div>}
      </section>
    </div>
  </div>;
}
