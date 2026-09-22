/** Placeholder shown while a page's data is still being fetched. */
export default function PageSkeleton() {
  return (
    <>
      <div className="page-head">
        <div className="skeleton title" />
        <div className="skeleton line medium" />
      </div>
      <div className="grid two">
        {[0, 1].map((key) => (
          <div className="card" key={key}>
            <div className="skeleton line short" style={{ height: 16 }} />
            <div className="skeleton line" />
            <div className="skeleton line medium" />
            <div className="skeleton line short" />
          </div>
        ))}
      </div>
      <span className="tiny muted" role="status">Loading…</span>
    </>
  );
}
