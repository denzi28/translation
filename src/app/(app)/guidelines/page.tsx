import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { deleteGuidelinesAction, uploadGuidelinesAction } from "@/lib/actions/guidelines";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { getGuidelinesMeta } from "@/lib/data";
import { formatBytes, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  const user = (await getCurrentUser())!;
  const staff = isStaff(user);
  const meta = await getGuidelinesMeta();

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Project guidelines</h1>
          <p className="lede">
            The course requirements for the final project. Every signed-in student, the teacher and
            admins can read or download this document.
          </p>
        </div>
        {meta ? (
          <div className="row">
            <a className="btn primary" href="/api/guidelines/file?download=1">Download PDF</a>
            <a className="btn" href="/api/guidelines/file" target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          </div>
        ) : null}
      </div>

      {meta ? (
        <section className="card">
          <div className="card-title">
            <h2>{meta.filename}</h2>
            <span className="tiny muted">
              {formatBytes(meta.byte_size)} · updated {formatDateTime(meta.uploaded_at)}
              {meta.uploader_name ? ` by ${meta.uploader_name}` : ""}
            </span>
          </div>
          <object className="pdf-frame" data="/api/guidelines/file#view=FitH" type="application/pdf">
            <iframe className="pdf-frame" src="/api/guidelines/file" title="Project guidelines" />
          </object>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            If the document does not appear above, use “Download PDF” or “Open in a new tab”.
          </p>
        </section>
      ) : (
        <section className="card">
          <p className="empty" style={{ marginTop: 0 }}>
            No guidelines document has been uploaded yet.
            {staff ? "" : " Your teacher will publish it here."}
          </p>
        </section>
      )}

      {staff ? (
        <section className="card">
          <div className="card-title">
            <h2>{meta ? "Replace the PDF" : "Upload the PDF"}</h2>
            <span className="badge teacher">Teacher &amp; admin only</span>
          </div>
          <ActionForm action={uploadGuidelinesAction} className="stack">
            <label className="field" style={{ margin: 0 }}>
              <span>PDF file (max 8 MB)</span>
              <input type="file" name="file" accept="application/pdf,.pdf" required />
            </label>
            <div className="row">
              <SubmitButton pendingLabel="Uploading…">
                {meta ? "Replace guidelines" : "Upload guidelines"}
              </SubmitButton>
            </div>
          </ActionForm>
          {meta ? (
            <ActionForm action={deleteGuidelinesAction} style={{ marginTop: 12 }}>
              <SubmitButton className="danger small" confirm="Remove the guidelines PDF?">
                Remove current PDF
              </SubmitButton>
            </ActionForm>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
