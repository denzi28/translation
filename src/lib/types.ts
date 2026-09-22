export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export type User = {
  id: string;
  role: Role;
  email: string | null;
  username: string | null;
  full_name: string;
  student_number: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type Post = {
  id: string;
  group_id: string;
  title: string;
  content_html: string;
  status: "DRAFT" | "PUBLISHED";
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type Feedback = {
  id: string;
  group_id: string;
  post_id: string | null;
  author_id: string;
  grade: number | null;
  comment: string;
  created_at: string;
  author_name: string;
  author_role: Role;
  post_title: string | null;
};

export type GroupRequest = {
  id: string;
  group_id: string;
  user_id: string;
  kind: "INVITE" | "REQUEST";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  created_at: string;
};

/**
 * Every student is identified across the app by full name *and* student
 * number; staff accounts fall back to their username.
 */
export function displayName(user: {
  full_name: string;
  student_number?: string | null;
  username?: string | null;
  role?: Role;
}): string {
  if (user.student_number) return `${user.full_name} (${user.student_number})`;
  if (user.username) return `${user.full_name} (${user.username})`;
  return user.full_name;
}

export function roleLabel(role: Role): string {
  return role === "TEACHER" ? "Teacher" : role === "ADMIN" ? "Admin" : "Student";
}
