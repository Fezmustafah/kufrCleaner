export function slugifyPath(path: string): string {
  return path
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-/]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
