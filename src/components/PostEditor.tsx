"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/actions/auth";
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
  post: { id: string; title: string; content_html: string; status: "DRAFT" | "PUBLISHED" };
  saveAction: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(saveAction, {} as FormState);
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [dirty, setDirty] = useState(false);

  // contentEditable is uncontrolled: seed it once, then mirror it into the
  // hidden field that the server action reads.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = post.content_html;
    if (hiddenRef.current) hiddenRef.current.value = post.content_html;
  }, [post.id, post.content_html]);

  useEffect(() => {
    if (state.ok || state.error) setDirty(false);
  }, [state]);

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

  return (
    <form action={formAction}>
      <input type="hidden" name="post_id" value={post.id} />
      <input type="hidden" name="content_html" ref={hiddenRef} />

      {state.error ? <p className="alert error">{state.error}</p> : null}
      {state.ok ? <p className="alert ok">{state.ok}</p> : null}

      <label className="field">
        <span>Post title</span>
        <input
          name="title"
          defaultValue={post.title}
          required
          maxLength={160}
          onChange={() => setDirty(true)}
        />
      </label>

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
        aria-label="Blog post content"
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

      <div className="row" style={{ marginTop: 16 }}>
        <SubmitButton className="primary" name="intent" value="save" pendingLabel="Saving…">
          Save draft
        </SubmitButton>
        {post.status === "DRAFT" ? (
          <SubmitButton className="" name="intent" value="publish" pendingLabel="Publishing…">
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
