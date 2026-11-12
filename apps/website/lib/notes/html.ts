/**
 * Notes v2 — rich text cleaner. Notes are shared between staff, so the HTML a browser sends is NEVER stored as-is.
 * Only these come back out, rebuilt by us (no attributes copied from the input):
 *   b strong i em u s strike br p div span ul ol li blockquote code pre
 *   mark   → class "y" | "g" | "r"   (highlighter)
 *   div    → class "ck" | "ck d"     (checklist item, d = done) — its first <b> is the tick box
 *   img    → src must be a Cloudinary image URL (https://res.cloudinary.com/<cloud>/image/upload/…)
 * Everything else (script, style, iframe, links, on* handlers, inline styles…) is dropped; text is escaped.
 */
const KEEP = new Set(["b", "strong", "i", "em", "u", "s", "strike", "br", "p", "div", "span", "ul", "ol", "li", "blockquote", "code", "pre", "mark", "img"]);
const VOID = new Set(["br", "img"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "head", "title", "textarea", "select"]);
const IMG = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]{1,60}\/image\/upload\/[A-Za-z0-9_\-/.,%=:]{1,400}$/;
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Decode the few entities a browser puts in innerHTML, then escape — so text can never become markup. */
function text(t: string) {
  const d = t.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " })[e as string] as string);
  return d.replace(/[&<>"]/g, (c) => ESC[c]!);
}
function attr(raw: string, name: string) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(raw);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").replace(/&amp;/g, "&") : "";
}

export function cleanHtml(input: unknown, max = 60_000): string {
  const src = String(input ?? "").slice(0, max * 2);
  const out: string[] = [];
  const open: string[] = [];
  let skip: string | null = null;
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>|[^<]+|</g;
  for (let m: RegExpExecArray | null; (m = re.exec(src)); ) {
    const tok = m[0];
    if (tok.startsWith("<!--")) continue;
    const tag = m[1]?.toLowerCase();
    if (skip) { if (tag === skip && tok.startsWith("</")) skip = null; continue; }
    if (!tag) { out.push(tok === "<" ? "&lt;" : text(tok)); continue; }
    const closing = tok.startsWith("</");
    if (DROP_WITH_CONTENT.has(tag)) { if (!closing && !tok.endsWith("/>")) skip = tag; continue; }
    if (!KEEP.has(tag)) continue; // unknown tag: drop the tag, keep its text
    if (closing) {
      if (VOID.has(tag)) continue;
      const i = open.lastIndexOf(tag);
      if (i < 0) continue;
      while (open.length > i) out.push(`</${open.pop()}>`);
      continue;
    }
    const a = m[2] ?? "";
    if (tag === "br") { out.push("<br>"); continue; }
    if (tag === "img") { const s = attr(a, "src"); if (IMG.test(s)) out.push(`<img src="${s.replace(/"/g, "%22")}" alt="">`); continue; }
    let cls = "";
    if (tag === "mark") { const c = attr(a, "class"); cls = /\b(y|g|r)\b/.exec(c)?.[1] ?? "y"; }
    if (tag === "div") { const c = attr(a, "class"); if (/\bck\b/.test(c)) cls = /\bd\b/.test(c) ? "ck d" : "ck"; }
    out.push(cls ? `<${tag} class="${cls}">` : `<${tag}>`);
    open.push(tag);
    if (open.length > 40) break; // absurd nesting
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join("").slice(0, max);
}

/** Old plain-text notes → safe HTML (line breaks kept). */
export const plainToHtml = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) => ESC[c]!).split("\n")
  .map((l) => { const m = /^\s*([☐☑])\s?(.*)$/.exec(l); return m ? `<div class="ck${m[1] === "☑" ? " d" : ""}"><b>${m[1] === "☑" ? "✓" : ""}</b><span>${m[2]}</span></div>` : `${l}<br>`; })
  .join("").replace(/(<br>)+$/, ""); // v1 "☐ / ☑" lines become real checklist items
/** Plain text for search / previews. */
export const htmlToText = (h: string) => h.replace(/<br>|<\/(div|p|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
