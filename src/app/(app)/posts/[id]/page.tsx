import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import FeedbackPanel from "@/components/FeedbackPanel";
import SubmitButton from "@/components/SubmitButton";
import { deletePostAction } from "@/lib/actions/posts";
import { getCurrentUser, getMyGroupId } from "@/lib/auth";
import {
  canSeeFeedback,
  getPost,
  isGroupMember,
  listFeedbackForGroup,
  listGroupPosts,
} from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const post = await getPost(id);
  if (!post) notFound();

  const canEdit = await isGroupMember(user.id, post.group_id);
  // Drafts stay inside the group that is writing them.
  if (post.status === "DRAFT" && !canEdit) notFound();

  const myGroupId = await getMyGroupId(user.id);
  const showFeedback = await canSeeFeedback(user, post.group_id, myGroupId);
  const feedback = showFeedback
    ? (await listFeedbackForGroup(post.group_id)).filter(
        (entry) => entry.post_id === null || entry.post_id === post.id,
      )
    : [];
  const groupPosts = showFeedback ? await listGroupPosts(post.group_id) : [];

  return (
    <>
      <div className="page-head spread">
        <div>
          <p className="tiny muted" style={{ margin: 0 }}>
            <Link href={`/groups/${post.group_id}`}>{post.group_name}</Link>
          </p>
          <h1>{post.title}</h1>
          <p className="lede small">
            {post.status === "PUBLISHED"
              ? `Published ${formatDateTime(post.published_at)}`
              : `Draft · last edited ${formatDateTime(post.updated_at)}`}{" "}
            · written by {post.author_name}
          </p>
        </div>
        <div className="row">
          <span className={`badge ${post.status === "PUBLISHED" ? "published" : "draft"}`}>
            {post.status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          {canEdit ? (
            <Link className="btn small" href={`/posts/${post.id}/edit`}>Edit</Link>
          ) : null}
        </div>
      </div>

      <article className="card">
        {post.content_html.trim() ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: post.content_html }} />
        ) : (
          <p className="empty">This post is still empty.</p>
        )}
      </article>

      {!canEdit ? (
        <p className="tiny muted" style={{ marginTop: 12 }}>
          You are reading another group&rsquo;s blog. Only its members can edit it.
        </p>
      ) : (
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn small" href={`/posts/${post.id}/edit`}>Open editor</Link>
          <ActionForm action={deletePostAction}>
            <input type="hidden" name="post_id" value={post.id} />
            <SubmitButton className="danger small" confirm="Delete this post permanently?">
              Delete post
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      {showFeedback ? (
        <div style={{ marginTop: 20 }}>
          <FeedbackPanel
            groupId={post.group_id}
            posts={groupPosts.map((p) => ({ id: p.id, title: p.title }))}
            feedback={feedback}
            viewerRole={user.role}
            viewerId={user.id}
          />
        </div>
      ) : null}
    </>
  );
}
