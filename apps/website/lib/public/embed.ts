/** Old cms.js getEmbedUrl: YouTube / Vimeo / Streamable → embed URL; direct files stay as-is. */
export function embedUrl(url: string): { kind: "iframe" | "video"; src: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.replace(/^www\.|^m\./, "");
    let id = "";
    if (h === "youtu.be") id = u.pathname.slice(1);
    else if (h === "youtube.com") id = u.searchParams.get("v") || (u.pathname.match(/^\/(embed|shorts|live)\/([\w-]+)/)?.[2] ?? "");
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
    const vm = h === "vimeo.com" && u.pathname.match(/^\/(\d+)/);
    if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
    const st = h === "streamable.com" && u.pathname.match(/^\/(?:e\/)?(\w+)/);
    if (st) return { kind: "iframe", src: `https://streamable.com/e/${st[1]}` };
    if (/\.(mp4|webm|mov)$/i.test(u.pathname) || h.endsWith("cloudinary.com")) return { kind: "video", src: u.toString() };
    return null;
  } catch { return null; }
}
