import { ENTRY_FIELDS } from "@/lib/entry";
import type { PostSummary } from "@/lib/data";

/** Renders a completed entry in the shape of the model in the course brief. */
export default function EntryCard({ post }: { post: PostSummary }) {
  const rows = ENTRY_FIELDS.filter((field) => post[field.name].trim() !== "");

  return (
    <article className="entry">
      <h2 className="entry-head">
        <span className="entry-word">{post.title}</span>
        {post.pronunciation ? (
          <span className="entry-pron">{post.pronunciation}</span>
        ) : null}
        {post.category ? (
          <>
            <span className="entry-dot" aria-hidden="true">·</span>
            <span className="entry-cat">{post.category}</span>
          </>
        ) : null}
      </h2>

      {rows.length === 0 ? (
        <p className="empty">This entry has not been written yet.</p>
      ) : (
        <dl className="entry-body">
          {rows.map((field) => (
            <div className="entry-row" key={field.name}>
              <dt>{field.label}.</dt>
              <dd>{post[field.name]}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
