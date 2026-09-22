import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PostEditor from "@/components/PostEditor";
import { savePostAction } from "@/lib/actions/posts";
import { getCurrentUser } from "@/lib/auth";
import { getPost, isGroupMember } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const post = await getPost(id);
  if (!post) notFound();

  // Editing is reserved for the group that owns the blog.
  if (!(await isGroupMember(user.id, post.group_id))) redirect(`/posts/${post.id}`);

  return (
    <>
      <div className="page-head spread">
        <div>
          <p className="tiny muted" style={{ margin: 0 }}>
            <Link href={`/groups/${post.group_id}`}>{post.group_name}</Link>
          </p>
          <h1>Edit entry</h1>
        </div>
        <Link className="btn small" href={`/posts/${post.id}`}>View entry</Link>
      </div>

      <PostEditor post={post} saveAction={savePostAction} />
    </>
  );
}
