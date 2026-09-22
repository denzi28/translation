"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/actions/auth";
import { ENTRY_FIELDS, HEADLINE_EXAMPLES, missingSections } from "@/lib/entry";
import type { Post } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const FONTS = [
  "Default",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
];

// execCommand's fontSize takes the legacy 1–7 scale.
const SIZES: Array<[string, string]> = [
  ["2", "Small"],
  ["3", "Normal"],
  ["4", "Large"],
  ["5", "Larger"],
  ["6", "Huge"],
];

const BLOCKS: Array<[string, string]> = [
  ["p", "Paragraph"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
  ["blockquote", "Quote"],
  ["pre", "Code block"],
];

/** Four horizontal rules whose lengths and offsets show the alignment. */
function AlignIcon({ lines }: { lines: Array<[number, number]> }) {
  return (
    <svg viewBox="0 0 16 14" width="16" height="14" aria-hidden="true">
      {lines.map(([x, width], index) => (
        <rect key={index} x={x} y={index * 4} width={width} height="2" rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

export default function PostEditor({
  post,
  saveAction,
}: {
  post: Post;
  saveAction: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(saveAction, {} as FormState);
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  // contentEditable is uncontrolled: seed it once, then mirror it into the
  // hidden field that the server action reads.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = post.content_html;
    if (hiddenRef.current) hiddenRef.current.value = post.content_html;
  }, [post.id, post.content_html]);

  useEffect(() => {
    if (state.ok || state.error) setDirty(false);
  }, [state]);

  /** Which sections are still blank, so the writer sees it before publishing. */
  function recheck() {
    const form = formRef.current;
    if (!form) return;
    const read = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
    setMissing(
      missingSections({
        title: read("title"),
        category: read("category"),
        definition: read("definition"),
        context_notes: read("context_notes"),
        examples: read("examples"),
        attempts: read("attempts"),
        why_untranslatable: read("why_untranslatable"),
      }),
    );
  }

  useEffect(recheck, []);

  function sync() {
    if (editorRef.current && hiddenRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML;
    }
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    sync();
    setDirty(true);
  }

  const complete = missing.length === 0;

  return (
    <form action={formAction} ref={formRef} onInput={recheck}>
      <input type="hidden" name="post_id" value={post.id} />
      <input type="hidden" name="content_html" ref={hiddenRef} />

      {state.error ? <p className="alert error">{state.error}</p> : null}
      {state.ok ? <p className="alert ok">{state.ok}</p> : null}

      <section className="card mould">
        <div className="card-title">
          <h2>The entry</h2>
          <span className={`badge ${complete ? "published" : "draft"}`}>
            {complete ? "Complete" : `${missing.length} left`}
          </span>
        </div>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          One word per entry. Every section must be written before you can publish —
          the grey text is the model entry, and disappears as you type.
        </p>

        <div className="grid two">
          <label className="field">
            <span>Word or phrase</span>
            <input
              name="title"
              defaultValue={post.title === "New entry" ? "" : post.title}
              placeholder={HEADLINE_EXAMPLES.title}
              required
              maxLength={160}
              onChange={() => setDirty(true)}
            />
          </label>
          <label className="field">
            <span>Pronunciation — optional</span>
            <input
              name="pronunciation"
              defaultValue={post.pronunciation}
              placeholder={HEADLINE_EXAMPLES.pronunciation}
              maxLength={120}
              onChange={() => setDirty(true)}
            />
          </label>
        </div>

        <label className="field">
          <span>Category</span>
          <input
            name="category"
            defaultValue={post.category}
            placeholder={HEADLINE_EXAMPLES.category}
            maxLength={120}
            onChange={() => setDirty(true)}
          />
        </label>

        {ENTRY_FIELDS.map((field) => (
          <label className="field" key={field.name}>
            <span>{field.label}</span>
            <textarea
              name={field.name}
              rows={field.rows}
              defaultValue={post[field.name]}
              placeholder={field.example}
              onChange={() => setDirty(true)}
            />
            <span className="tiny muted">{field.hint}</span>
          </label>
        ))}

        {!complete ? (
          <p className="alert info small" style={{ marginBottom: 0 }}>
            Still to write: {missing.join(", ")}. You can save a draft meanwhile.
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Your own thoughts</h2>
          <span className="badge">Optional</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          Anything you want to add below the entry — what surprised you, what you
          would ask a native speaker, where you disagree with the usual translation.
        </p>

        <div className="toolbar" role="toolbar" aria-label="Formatting">
          <select
            aria-label="Paragraph style"
            defaultValue="p"
            onChange={(e) => exec("formatBlock", `<${e.target.value}>`)}
          >
            {BLOCKS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            aria-label="Font"
            defaultValue="Default"
            onChange={(e) =>
              exec("fontName", e.target.value === "Default" ? "inherit" : e.target.value)
            }
          >
            {FONTS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>

          <select aria-label="Font size" defaultValue="3" onChange={(e) => exec("fontSize", e.target.value)}>
            {SIZES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <span className="sep" />
          <button type="button" title="Bold (Ctrl+B)" onClick={() => exec("bold")}><b>B</b></button>
          <button type="button" title="Italic (Ctrl+I)" onClick={() => exec("italic")}><i>I</i></button>
          <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></button>
          <button type="button" title="Strikethrough" onClick={() => exec("strikeThrough")}>
            <s>S</s>
          </button>

          <span className="sep" />
          <button type="button" title="Bulleted list" onClick={() => exec("insertUnorderedList")}>• List</button>
          <button type="button" title="Numbered list" onClick={() => exec("insertOrderedList")}>1. List</button>

          <span className="sep" />
          <button type="button" title="Align left" aria-label="Align left" onClick={() => exec("justifyLeft")}>
            <AlignIcon lines={[[0, 16], [0, 10], [0, 14], [0, 8]]} />
          </button>
          <button type="button" title="Align centre" aria-label="Align centre" onClick={() => exec("justifyCenter")}>
            <AlignIcon lines={[[0, 16], [3, 10], [1, 14], [4, 8]]} />
          </button>
          <button type="button" title="Align right" aria-label="Align right" onClick={() => exec("justifyRight")}>
            <AlignIcon lines={[[0, 16], [6, 10], [2, 14], [8, 8]]} />
          </button>
          <button type="button" title="Justify" aria-label="Justify" onClick={() => exec("justifyFull")}>
            <AlignIcon lines={[[0, 16], [0, 16], [0, 16], [0, 16]]} />
          </button>

          <span className="sep" />
          <button
            type="button"
            title="Insert link"
            onClick={() => {
              const url = window.prompt("Link address (https://…)");
              if (url) exec("createLink", url);
            }}
          >
            Link
          </button>
          <button type="button" title="Clear formatting" onClick={() => exec("removeFormat")}>Clear</button>
          <button type="button" title="Undo" onClick={() => exec("undo")}>↺</button>
          <button type="button" title="Redo" onClick={() => exec("redo")}>↻</button>
        </div>

        <div
          ref={editorRef}
          className="editor prose"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Your own thoughts"
          data-placeholder="Write anything you want to add below the entry…"
          onInput={() => {
            sync();
            setDirty(true);
          }}
          onBlur={sync}
          // Paste as plain text so foreign markup never enters the document.
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            sync();
            setDirty(true);
          }}
        />
      </section>

      <div className="row" style={{ marginTop: 16 }}>
        <SubmitButton className="primary" name="intent" value="save" pendingLabel="Saving…">
          Save draft
        </SubmitButton>
        {post.status === "DRAFT" ? (
          <SubmitButton
            className=""
            name="intent"
            value="publish"
            pendingLabel="Publishing…"
            title={complete ? undefined : `Still to write: ${missing.join(", ")}`}
          >
            Publish
          </SubmitButton>
        ) : (
          <SubmitButton className="" name="intent" value="unpublish" pendingLabel="Updating…">
            Unpublish (back to draft)
          </SubmitButton>
        )}
        <span className={`tiny muted editor-status${dirty ? " dirty" : ""}`}>
          <span className="dot" aria-hidden="true" />
          {dirty ? "Unsaved changes" : "All changes saved"}
          {" · "}
          {post.status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
      </div>
    </form>
  );
}
