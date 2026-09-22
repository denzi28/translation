import { deleteFeedbackAction, saveFeedbackAction } from "@/lib/actions/feedback";
import { formatDateTime } from "@/lib/format";
import type { Feedback, Role } from "@/lib/types";
import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";

export default function FeedbackPanel({
  groupId,
  posts,
  feedback,
  viewerRole,
  viewerId,
}: {
  groupId: string;
  posts: Array<{ id: string; title: string }>;
  feedback: Feedback[];
  viewerRole: Role;
  viewerId: string;
}) {
  const canWrite = viewerRole === "TEACHER" || viewerRole === "ADMIN";
  const grades = feedback.filter((f) => f.grade !== null);
  const latest = grades[0]?.grade ?? null;
  const commented = feedback.some((f) => f.comment.trim() !== "");

  return (
    <section className="card" id="evaluation">
      <div className="card-title">
        <h2>Teacher evaluation</h2>
        {latest !== null ? (
          <span className="badge published">Latest grade: {latest} / 100</span>
        ) : commented ? (
          <span className="badge owner">Feedback given · not graded</span>
        ) : (
          <span className="badge">Nothing yet</span>
        )}
      </div>

      <p className="alert info small">
        Private to this group. Only the teacher, admins and this group&rsquo;s own members can read
        what is written here. Students in other groups never see it.
      </p>

      {canWrite ? (
        <ActionForm action={saveFeedbackAction} className="stack" style={{ marginBottom: 18 }}>
          <input type="hidden" name="group_id" value={groupId} />
          <label className="field" style={{ margin: 0 }}>
            <span>About which post?</span>
            <select name="post_id" defaultValue="">
              <option value="">The group&rsquo;s work overall</option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>{post.title}</option>
              ))}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span>Feedback</span>
            <textarea name="comment" placeholder="Strengths, what to improve, next steps…" />
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span>Grade (optional)</span>
            <input
              type="number"
              name="grade"
              min={0}
              max={100}
              step={1}
              placeholder="e.g. 85"
              className="field-xs"
              aria-describedby="grade-hint"
            />
            <span id="grade-hint" className="tiny muted" style={{ display: "block", marginTop: 6 }}>
              Leave this blank to comment without grading. You can add a grade later.
            </span>
          </label>

          <div>
            <SubmitButton pendingLabel="Saving…">Save feedback</SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {feedback.length === 0 ? (
        <p className="empty">No feedback has been left yet.</p>
      ) : (
        <ul className="plain">
          {feedback.map((entry) => (
            <li key={entry.id}>
              <div className="spread">
                <div>
                  <strong>{entry.author_name}</strong>{" "}
                  <span className={`badge ${entry.author_role === "ADMIN" ? "admin" : "teacher"}`}>
                    {entry.author_role === "ADMIN" ? "Admin" : "Teacher"}
                  </span>
                  <div className="tiny muted">
                    {formatDateTime(entry.created_at)}
                    {entry.post_title ? ` · on “${entry.post_title}”` : " · overall"}
                  </div>
                </div>
                <div className="row">
                  {entry.grade !== null ? (
                    <span className="badge published">{entry.grade} / 100</span>
                  ) : (
                    <span className="badge">Comment only</span>
                  )}
                  {viewerRole === "ADMIN" || entry.author_id === viewerId ? (
                    <ActionForm action={deleteFeedbackAction}>
                      <input type="hidden" name="feedback_id" value={entry.id} />
                      <SubmitButton
                        className="danger small"
                        confirm="Delete this evaluation?"
                        pendingLabel="Deleting…"
                      >
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </div>
              {entry.comment ? (
                <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{entry.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
