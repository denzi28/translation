/**
 * Page links for a list: Previous, the page numbers (the first and last
 * always, and the neighbours of the current one), Next. `hrefFor` should end
 * in an anchor on the list, so a new page lands on the list rather than at
 * the top of the page. These are plain links on purpose: Next's <Link> treats
 * a link to the same page with an anchor as a jump within the page, and would
 * scroll to the list without changing the page.
 */
export default function Pager({
  page,
  pages,
  summary,
  hrefFor,
  label,
}: {
  page: number;
  pages: number;
  summary: string;
  hrefFor: (page: number) => string;
  label: string;
}) {
  const shown: (number | "gap")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (pages <= 7 || n === 1 || n === pages || Math.abs(n - page) <= 1) shown.push(n);
    else if (shown[shown.length - 1] !== "gap") shown.push("gap");
  }

  return (
    <nav className="pager" aria-label={label}>
      <span className="pager-summary">
        {summary}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </span>
      {pages > 1 ? (
        <span className="pager-links">
          {page > 1 ? (
            <a href={hrefFor(page - 1)} className="pager-step" rel="prev">
              Previous
            </a>
          ) : (
            <span className="pager-step" aria-disabled="true">Previous</span>
          )}
          {shown.map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</span>
            ) : (
              <a
                key={n}
                href={hrefFor(n)}
               
                className="pager-page"
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
              >
                {n}
              </a>
            ),
          )}
          {page < pages ? (
            <a href={hrefFor(page + 1)} className="pager-step" rel="next">
              Next
            </a>
          ) : (
            <span className="pager-step" aria-disabled="true">Next</span>
          )}
        </span>
      ) : null}
    </nav>
  );
}
