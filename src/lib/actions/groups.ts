"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyGroupId, requireUser } from "@/lib/auth";
import { query, queryOne, transaction } from "@/lib/db";
import { MAX_MEMBERS } from "@/lib/constants";
import { isGroupMember } from "@/lib/data";
import type { FormState } from "./auth";

function describeDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("GROUP_FULL")) {
    return `That group already has the maximum of ${MAX_MEMBERS} members.`;
  }
  if (message.includes("group_members_one_group_uk")) {
    return "A student can belong to only one group at a time.";
  }
  if (message.includes("groups_name_key")) {
    return "A group with that name already exists.";
  }
  if (message.includes("group_requests_pending_uk")) {
    return "There is already a pending request for that student.";
  }
  return "Something went wrong. Please try again.";
}

function newInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function refresh() {
  revalidatePath("/groups", "layout");
  revalidatePath("/my-group");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students can create groups." };
  if (await getMyGroupId(user.id)) {
    return { error: "You are already in a group. Leave it before creating another." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 3 || name.length > 60) {
    return { error: "Group name must be between 3 and 60 characters." };
  }

  let groupId: string;
  try {
    groupId = await transaction(async (run) => {
      const [group] = await run<{ id: string }>(
        `insert into app.groups (name, description, invite_code, created_by)
         values ($1, $2, $3, $4) returning id`,
        [name, description, newInviteCode(), user.id],
      );
      await run(
        "insert into app.group_members (group_id, user_id, is_owner) values ($1, $2, true)",
        [group.id, user.id],
      );
      // Any pending invitations or requests are moot now.
      await run(
        `update app.group_requests set status = 'CANCELLED', resolved_at = now()
          where user_id = $1 and status = 'PENDING'`,
        [user.id],
      );
      return group.id;
    });
  } catch (error) {
    return { error: describeDbError(error) };
  }

  refresh();
  redirect(`/groups/${groupId}`);
}

export async function updateGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  const allowed = user.role === "ADMIN" || (await isGroupMember(user.id, groupId));
  if (!allowed) return { error: "You cannot edit this group." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 3 || name.length > 60) {
    return { error: "Group name must be between 3 and 60 characters." };
  }
  try {
    await query("update app.groups set name = $1, description = $2 where id = $3", [
      name,
      description,
      groupId,
    ]);
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Group details saved." };
}

export async function inviteStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  const inviteeId = String(formData.get("user_id") ?? "");
  if (!(await isGroupMember(user.id, groupId))) {
    return { error: "Only members of the group can invite classmates." };
  }

  const counts = await queryOne<{ n: number }>(
    "select count(*)::int as n from app.group_members where group_id = $1",
    [groupId],
  );
  if ((counts?.n ?? 0) >= MAX_MEMBERS) {
    return { error: `The group is full (${MAX_MEMBERS} members).` };
  }
  const invitee = await queryOne<{ role: string }>("select role from app.users where id = $1", [
    inviteeId,
  ]);
  if (!invitee || invitee.role !== "STUDENT") return { error: "That classmate was not found." };
  if (await getMyGroupId(inviteeId)) return { error: "That student is already in a group." };

  try {
    await query(
      `insert into app.group_requests (group_id, user_id, kind, created_by)
       values ($1, $2, 'INVITE', $3)`,
      [groupId, inviteeId, user.id],
    );
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Invitation sent." };
}

export async function requestJoinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students can join groups." };
  const groupId = String(formData.get("group_id") ?? "");
  if (await getMyGroupId(user.id)) return { error: "You are already in a group." };

  const counts = await queryOne<{ n: number }>(
    "select count(*)::int as n from app.group_members where group_id = $1",
    [groupId],
  );
  if ((counts?.n ?? 0) >= MAX_MEMBERS) return { error: "That group is already full." };

  try {
    await query(
      `insert into app.group_requests (group_id, user_id, kind, created_by)
       values ($1, $2, 'REQUEST', $2)`,
      [groupId, user.id],
    );
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Join request sent to the group." };
}

export async function joinByCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "STUDENT") return { error: "Only students can join groups." };
  if (await getMyGroupId(user.id)) return { error: "You are already in a group." };

  const code = String(formData.get("invite_code") ?? "").trim();
  if (!code) return { error: "Enter an invite code." };
  const group = await queryOne<{ id: string }>(
    "select id from app.groups where upper(invite_code) = upper($1)",
    [code],
  );
  if (!group) return { error: "No group matches that invite code." };

  try {
    await transaction(async (run) => {
      await run("insert into app.group_members (group_id, user_id) values ($1, $2)", [
        group.id,
        user.id,
      ]);
      await run(
        `update app.group_requests set status = 'CANCELLED', resolved_at = now()
          where user_id = $1 and status = 'PENDING'`,
        [user.id],
      );
    });
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  redirect(`/groups/${group.id}`);
}

/** Accept or decline an invitation addressed to the signed-in student. */
export async function respondToInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const requestId = String(formData.get("request_id") ?? "");
  const accept = String(formData.get("decision") ?? "") === "accept";

  const request = await queryOne<{ group_id: string; user_id: string }>(
    `select group_id, user_id from app.group_requests
      where id = $1 and kind = 'INVITE' and status = 'PENDING'`,
    [requestId],
  );
  if (!request || request.user_id !== user.id) return { error: "That invitation is no longer open." };

  if (!accept) {
    await query(
      "update app.group_requests set status = 'DECLINED', resolved_at = now() where id = $1",
      [requestId],
    );
    refresh();
    return { ok: "Invitation declined." };
  }

  try {
    await transaction(async (run) => {
      await run("insert into app.group_members (group_id, user_id) values ($1, $2)", [
        request.group_id,
        user.id,
      ]);
      await run(
        "update app.group_requests set status = 'ACCEPTED', resolved_at = now() where id = $1",
        [requestId],
      );
      await run(
        `update app.group_requests set status = 'CANCELLED', resolved_at = now()
          where user_id = $1 and status = 'PENDING'`,
        [user.id],
      );
    });
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  redirect(`/groups/${request.group_id}`);
}

/** A group member accepts or declines an incoming join request. */
export async function respondToJoinRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const requestId = String(formData.get("request_id") ?? "");
  const accept = String(formData.get("decision") ?? "") === "accept";

  const request = await queryOne<{ group_id: string; user_id: string }>(
    `select group_id, user_id from app.group_requests
      where id = $1 and kind = 'REQUEST' and status = 'PENDING'`,
    [requestId],
  );
  if (!request) return { error: "That request is no longer open." };
  if (!(await isGroupMember(user.id, request.group_id)) && user.role !== "ADMIN") {
    return { error: "Only members of the group can answer join requests." };
  }

  if (!accept) {
    await query(
      "update app.group_requests set status = 'DECLINED', resolved_at = now() where id = $1",
      [requestId],
    );
    refresh();
    revalidatePath(`/groups/${request.group_id}`);
    return { ok: "Request declined." };
  }

  try {
    await transaction(async (run) => {
      await run("insert into app.group_members (group_id, user_id) values ($1, $2)", [
        request.group_id,
        request.user_id,
      ]);
      await run(
        "update app.group_requests set status = 'ACCEPTED', resolved_at = now() where id = $1",
        [requestId],
      );
      await run(
        `update app.group_requests set status = 'CANCELLED', resolved_at = now()
          where user_id = $1 and status = 'PENDING'`,
        [request.user_id],
      );
    });
  } catch (error) {
    return { error: describeDbError(error) };
  }
  refresh();
  revalidatePath(`/groups/${request.group_id}`);
  return { ok: "Member added." };
}

export async function cancelRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const requestId = String(formData.get("request_id") ?? "");
  await query(
    `update app.group_requests set status = 'CANCELLED', resolved_at = now()
      where id = $1 and status = 'PENDING' and (user_id = $2 or created_by = $2)`,
    [requestId, user.id],
  );
  refresh();
  return { ok: "Request withdrawn." };
}

export async function leaveGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  if (!(await isGroupMember(user.id, groupId))) return { error: "You are not in that group." };

  await transaction(async (run) => {
    await run("delete from app.group_members where group_id = $1 and user_id = $2", [
      groupId,
      user.id,
    ]);
    const remaining = await run<{ n: number }>(
      "select count(*)::int as n from app.group_members where group_id = $1",
      [groupId],
    );
    if (remaining[0].n === 0) {
      // An empty group would violate the 1 to 5 member rule, so it is removed.
      await run("delete from app.groups where id = $1", [groupId]);
    } else {
      // Keep exactly one owner.
      await run(
        `update app.group_members set is_owner = true
          where group_id = $1
            and user_id = (select user_id from app.group_members
                            where group_id = $1 order by joined_at limit 1)
            and not exists (select 1 from app.group_members
                             where group_id = $1 and is_owner)`,
        [groupId],
      );
    }
  });
  refresh();
  redirect("/my-group");
}

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  const targetId = String(formData.get("user_id") ?? "");

  const owner = await queryOne(
    "select 1 as ok from app.group_members where group_id = $1 and user_id = $2 and is_owner",
    [groupId, user.id],
  );
  if (!owner && user.role !== "ADMIN") {
    return { error: "Only the group owner or an admin can remove members." };
  }
  if (targetId === user.id) return { error: "Use “Leave group” to remove yourself." };

  await query("delete from app.group_members where group_id = $1 and user_id = $2", [
    groupId,
    targetId,
  ]);
  refresh();
  revalidatePath(`/groups/${groupId}`);
  return { ok: "Member removed." };
}

export async function regenerateInviteCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  if (!(await isGroupMember(user.id, groupId)) && user.role !== "ADMIN") {
    return { error: "Only members of the group can do that." };
  }
  await query("update app.groups set invite_code = $1 where id = $2", [newInviteCode(), groupId]);
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/my-group");
  return { ok: "New invite code generated." };
}

export async function deleteGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const groupId = String(formData.get("group_id") ?? "");
  const owner = await queryOne(
    "select 1 as ok from app.group_members where group_id = $1 and user_id = $2 and is_owner",
    [groupId, user.id],
  );
  if (!owner && user.role !== "ADMIN") {
    return { error: "Only the group owner or an admin can delete this group." };
  }
  await query("delete from app.groups where id = $1", [groupId]);
  refresh();
  redirect("/groups");
}
