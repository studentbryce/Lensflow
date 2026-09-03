export default function DashboardHeader({ profile }) {
  return (
    <header className="dashboard-header">

      <div>
        <span className="eyebrow">
          Welcome back
        </span>

        <h1>
          {profile?.business_name || "LensFlow"}
        </h1>

        <p>
          Manage your photography business from one place.
        </p>
      </div>

    </header>
  );
}