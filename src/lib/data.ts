import { query, queryOne } from "./db";
import type { Feedback, Group, Post, Role, User } from "./types";

export type GroupMember = {
  user_id: string;
  full_name: string;
  student_number: string | null;
  email: string | null;
  is_owner: boolean;
  joined_at: string;
};

export type GroupSummary = Group & {
  member_count: number;
  published_count: number;
  draft_count: number;
  owner_name: string;
  members: GroupMember[];
};

const GROUP_SUMMARY_SQL = `
  select g.*,
         (select count(*)::int from app.group_members m where m.group_id = g.id) as member_count,
         (select count(*)::int from app.posts p
           where p.group_id = g.id and p.status = 'PUBLISHED') as published_count,
         (select count(*)::int from app.posts p
           where p.group_id = g.id and p.status = 'DRAFT') as draft_count,
         owner.full_name as owner_name,
         coalesce((
           select json_agg(json_build_object(
                    'user_id', u.id, 'full_name', u.full_name,
                    'student_number', u.student_number, 'email', u.email,
                    'is_owner', m.is_owner, 'joined_at', m.joined_at)
                  order by m.is_owner desc, u.full_name)
             from app.group_members m join app.users u on u.id = m.user_id
            where m.group_id = g.id
         ), '[]'::json) as members
    from app.groups g
    join app.users owner on owner.id = g.created_by
`;

export async function listGroups(): Promise<GroupSummary[]> {
  return query<GroupSummary>(`${GROUP_SUMMARY_SQL} order by g.name`);
}

export async function getGroup(groupId: string): Promise<GroupSummary | null> {
  return queryOne<GroupSummary>(`${GROUP_SUMMARY_SQL} where g.id = $1`, [groupId]);
}

export async function getGroupByInviteCode(code: string): Promise<GroupSummary | null> {
  return queryOne<GroupSummary>(`${GROUP_SUMMARY_SQL} where upper(g.invite_code) = upper($1)`, [
    code,
  ]);
}

export async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  const row = await queryOne(
    "select 1 as ok from app.group_members where user_id = $1 and group_id = $2",
    [userId, groupId],
  );
  return row !== null;
}

export async function isGroupOwner(userId: string, groupId: string): Promise<boolean> {
  const row = await queryOne(
    "select 1 as ok from app.group_members where user_id = $1 and group_id = $2 and is_owner",
    [userId, groupId],
  );
  return row !== null;
}

// ------------------------------------------------------------------ posts --
export type PostSummary = Post & {
  group_name: string;
  author_name: string;
  author_student_number: string | null;
  editor_name: string | null;
  editor_student_number: string | null;
};

const POST_SELECT = `
  select p.*, g.name as group_name,
         u.full_name as author_name, u.student_number as author_student_number,
         e.full_name as editor_name, e.student_number as editor_student_number
    from app.posts p
    join app.groups g on g.id = p.group_id
    join app.users u on u.id = p.created_by
    left join app.users e on e.id = p.updated_by
`;

/**
 * Published posts are visible to everyone; drafts only to the authoring group
 * (staff intentionally do not see unfinished work).
 */
export async function listVisiblePosts(user: User, ownGroupId: string | null): Promise<PostSummary[]> {
  return query<PostSummary>(
    `${POST_SELECT}
      where p.status = 'PUBLISHED' or p.group_id = $1
      order by coalesce(p.published_at, p.updated_at) desc`,
    [ownGroupId],
  );
}

export async function listGroupPosts(groupId: string): Promise<PostSummary[]> {
  return query<PostSummary>(
    `${POST_SELECT}
      where p.group_id = $1
      order by p.status, coalesce(p.published_at, p.updated_at) desc`,
    [groupId],
  );
}

export async function getPost(postId: string): Promise<PostSummary | null> {
  return queryOne<PostSummary>(`${POST_SELECT} where p.id = $1`, [postId]);
}

// --------------------------------------------------------------- feedback --
/**
 * Private evaluation. Visible to staff and to the members of the group it was
 * written for, never to students from another group.
 */
export async function canSeeFeedback(
  user: User,
  groupId: string,
  ownGroupId: string | null,
): Promise<boolean> {
  if (user.role === "TEACHER" || user.role === "ADMIN") return true;
  return ownGroupId === groupId;
}

export async function listFeedbackForGroup(groupId: string): Promise<Feedback[]> {
  return query<Feedback>(
    `select f.*, u.full_name as author_name, u.role as author_role, p.title as post_title
       from app.feedback f
       join app.users u on u.id = f.author_id
       left join app.posts p on p.id = f.post_id
      where f.group_id = $1
      order by f.created_at desc`,
    [groupId],
  );
}

/**
 * The group's evaluation state in one round trip: the most recent grade, if any
 * has been given, and whether a teacher has left written feedback. A group can
 * have plenty of the second and none of the first.
 */
export async function feedbackSummary(
  groupId: string,
): Promise<{ grade: number | null; comments: number }> {
  const row = await queryOne<{ grade: number | null; comments: number }>(
    `select
       (select grade from app.feedback
         where group_id = $1 and grade is not null
         order by created_at desc limit 1) as grade,
       (select count(*)::int from app.feedback
         where group_id = $1 and btrim(comment) <> '') as comments`,
    [groupId],
  );
  return { grade: row?.grade ?? null, comments: row?.comments ?? 0 };
}

// ------------------------------------------------------------- invitations --
export type RequestRow = {
  id: string;
  group_id: string;
  user_id: string;
  kind: "INVITE" | "REQUEST";
  status: string;
  created_at: string;
  group_name: string;
  full_name: string;
  student_number: string | null;
  email: string | null;
};

export async function pendingForUser(userId: string): Promise<RequestRow[]> {
  return query<RequestRow>(
    `select r.*, g.name as group_name, u.full_name, u.student_number, u.email
       from app.group_requests r
       join app.groups g on g.id = r.group_id
       join app.users u on u.id = r.user_id
      where r.user_id = $1 and r.kind = 'INVITE' and r.status = 'PENDING'
      order by r.created_at desc`,
    [userId],
  );
}

export async function pendingForGroup(groupId: string): Promise<RequestRow[]> {
  return query<RequestRow>(
    `select r.*, g.name as group_name, u.full_name, u.student_number, u.email
       from app.group_requests r
       join app.groups g on g.id = r.group_id
       join app.users u on u.id = r.user_id
      where r.group_id = $1 and r.status = 'PENDING'
      order by r.kind, r.created_at`,
    [groupId],
  );
}

export async function myOutgoingRequests(userId: string): Promise<RequestRow[]> {
  return query<RequestRow>(
    `select r.*, g.name as group_name, u.full_name, u.student_number, u.email
       from app.group_requests r
       join app.groups g on g.id = r.group_id
       join app.users u on u.id = r.user_id
      where r.user_id = $1 and r.kind = 'REQUEST' and r.status = 'PENDING'
      order by r.created_at desc`,
    [userId],
  );
}

/** Students who are not yet in any group: the pool a group can invite from. */
export async function unassignedStudents(searchTerm = ""): Promise<User[]> {
  const term = `%${searchTerm.trim().toLowerCase()}%`;
  return query<User>(
    `select u.id, u.role, u.email, u.username, u.full_name, u.student_number, u.created_at
       from app.users u
      where u.role = 'STUDENT'
        and not exists (select 1 from app.group_members m where m.user_id = u.id)
        and ($1 = '%%' or lower(u.full_name) like $1 or lower(u.email) like $1
             or lower(u.student_number) like $1)
      order by u.full_name
      limit 50`,
    [term],
  );
}

// ------------------------------------------------------------------ admin --
export type AdminUserRow = User & { group_name: string | null };

export async function listAllUsers(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    `select u.id, u.role, u.email, u.username, u.full_name, u.student_number, u.created_at,
            g.name as group_name
       from app.users u
       left join app.group_members m on m.user_id = u.id
       left join app.groups g on g.id = m.group_id
      order by case u.role when 'ADMIN' then 0 when 'TEACHER' then 1 else 2 end, u.full_name`,
  );
}

export async function countsByRole(): Promise<Record<Role, number>> {
  const rows = await query<{ role: Role; n: number }>(
    "select role, count(*)::int as n from app.users group by role",
  );
  const out: Record<Role, number> = { STUDENT: 0, TEACHER: 0, ADMIN: 0 };
  for (const row of rows) out[row.role] = row.n;
  return out;
}

export async function getGuidelinesMeta(): Promise<{
  filename: string;
  mime_type: string;
  byte_size: number;
  uploaded_at: string;
  uploader_name: string | null;
} | null> {
  return queryOne(
    `select g.filename, g.mime_type, g.byte_size, g.uploaded_at, u.full_name as uploader_name
       from app.guidelines g
       left join app.users u on u.id = g.uploaded_by
      where g.id = 1`,
  );
}
