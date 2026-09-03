export default function StatCard({
  title,
  value,
  description
}) {
  return (
    <article className="stat-card">

      <div className="stat-card-title">
        {title}
      </div>

      <h2>
        {value}
      </h2>

      <p>
        {description}
      </p>

    </article>
  );
}