import type { FileProperties, FunctionRegistry } from "./types";

export function fileHasTag(file: FileProperties, tag: string): boolean {
  const tags = normalizeList<string>(file.tags);
  if (tags.length === 0) return false;
  const normalizedTag = tag.startsWith("#") ? tag.slice(1) : tag;
  return tags.some((t) => {
    const normalizedFileTag = t.startsWith("#") ? t.slice(1) : t;
    return (
      normalizedFileTag === normalizedTag ||
      normalizedFileTag.startsWith(normalizedTag + "/")
    );
  });
}

export function fileInFolder(file: FileProperties, folder: string): boolean {
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "");
  const normalizedFilePath = file.folder.replace(/^\/+|\/+$/g, "");
  return (
    normalizedFilePath === normalizedFolder ||
    normalizedFilePath.startsWith(normalizedFolder + "/")
  );
}

export function fileHasProperty(
  note: Record<string, unknown>,
  propertyName: string,
): boolean {
  return (
    propertyName in note &&
    note[propertyName] !== undefined &&
    note[propertyName] !== null
  );
}

export function fileHasLink(file: FileProperties, linkPath: string): boolean {
  const links = normalizeList<string>(file.links);
  if (links.length === 0) return false;
  const normalizedLink = linkPath.replace(/\.md$/, "");
  return links.some((link) => {
    const normalizedFileLink = link.replace(/\.md$/, "");
    return (
      normalizedFileLink === normalizedLink ||
      normalizedFileLink.endsWith("/" + normalizedLink)
    );
  });
}

export function stringContains(str: string, substring: string, caseSensitive = false): boolean {
  if (!str || !substring) return false;
  if (caseSensitive) return str.includes(substring);
  return str.toLowerCase().includes(substring.toLowerCase());
}

export function stringStartsWith(str: string, prefix: string, caseSensitive = false): boolean {
  if (!str || !prefix) return false;
  if (caseSensitive) return str.startsWith(prefix);
  return str.toLowerCase().startsWith(prefix.toLowerCase());
}

export function stringEndsWith(str: string, suffix: string, caseSensitive = false): boolean {
  if (!str || !suffix) return false;
  if (caseSensitive) return str.endsWith(suffix);
  return str.toLowerCase().endsWith(suffix.toLowerCase());
}

export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function now(): Date { return new Date(); }

export function today(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export const builtinFunctions: FunctionRegistry = {
  "file.hasTag": fileHasTag,
  "file.inFolder": fileInFolder,
  "file.hasProperty": fileHasProperty,
  "file.hasLink": fileHasLink,
  contains: stringContains,
  startsWith: stringStartsWith,
  endsWith: stringEndsWith,
  date: parseDate,
  now,
  today,
};

function normalizeList<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof (value as Iterable<T>)[Symbol.iterator] === "function") {
    return Array.from(value as Iterable<T>);
  }
  return [];
}

export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return Boolean(value);
}
