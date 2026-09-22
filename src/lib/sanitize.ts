import sanitizeHtml from "sanitize-html";

/**
 * The editor toolbar emits `execCommand` markup, so the allowlist mirrors what
 * those commands produce (including legacy <font> tags) and nothing else.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "div", "br", "span", "font",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "b", "strong", "i", "em", "u", "s", "strike", "del", "sub", "sup",
    "ul", "ol", "li", "blockquote", "pre", "code", "hr",
    "a", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    "*": ["style", "align"],
    a: ["href", "title", "target", "rel"],
    font: ["face", "size", "color"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-family": [/^[\w\s,'"-]+$/],
      "font-size": [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^[\w\s-]+$/],
      "text-decoration-line": [/^[\w\s-]+$/],
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.%]+\)$/, /^[a-zA-Z]+$/],
      "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.%]+\)$/, /^[a-zA-Z]+$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** A short plain-text preview for listings. */
export function htmlExcerpt(html: string, length = 180): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}
