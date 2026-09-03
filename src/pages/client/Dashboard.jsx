import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import StatCard from "../../components/dashboard/StatCard";

export default function Dashboard() {
  return (
    <div className="dashboard-page">

      <DashboardHeader />

      <section className="dashboard-stats">

        <StatCard
          title="Upcoming Bookings"
          value="0"
          description="No upcoming bookings"
        />

        <StatCard
          title="Clients"
          value="0"
          description="Active clients"
        />

        <StatCard
          title="Outstanding"
          value="$0.00"
          description="Unpaid invoices"
        />

        <StatCard
          title="Galleries"
          value="0"
          description="Published galleries"
        />

      </section>

      <section className="dashboard-section">

        <h2>Upcoming Bookings</h2>

        <div className="empty-state">
          <p>No upcoming bookings.</p>
        </div>

      </section>

    </div>
  );
}