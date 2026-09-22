-- Each post is one dictionary-style entry for one untranslatable word: a fixed
-- set of sections (the "mould") that must be completed before it can be
-- published, plus free commentary underneath in `content_html`.

alter table app.posts add column if not exists pronunciation      text not null default '';
alter table app.posts add column if not exists category           text not null default '';
alter table app.posts add column if not exists definition         text not null default '';
alter table app.posts add column if not exists context_notes      text not null default '';
alter table app.posts add column if not exists examples           text not null default '';
alter table app.posts add column if not exists attempts           text not null default '';
alter table app.posts add column if not exists why_untranslatable text not null default '';

comment on column app.posts.title is 'The word or phrase the entry is about.';
comment on column app.posts.content_html is 'Optional commentary below the entry.';
