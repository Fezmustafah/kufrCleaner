import type { Note } from "./types";
import jexlModule from "jexl";
import type { Filter, FileProperties, EvaluationContext, FilterResult } from "./types";
import { builtinFunctions, isTruthy } from "./functions";
import { wrapString, wrapList, wrapDate } from "./propertyWrappers";

const jexl = new jexlModule.Jexl();

jexl.addFunction("contains", builtinFunctions["contains"]);
jexl.addFunction("startsWith", builtinFunctions["startsWith"]);
jexl.addFunction("endsWith", builtinFunctions["endsWith"]);
jexl.addFunction("now", builtinFunctions["now"]);
jexl.addFunction("today", builtinFunctions["today"]);
jexl.addFunction("date", builtinFunctions["date"]);
jexl.addFunction("hasTag", builtinFunctions["file.hasTag"]);
jexl.addFunction("inFolder", builtinFunctions["file.inFolder"]);
jexl.addFunction("hasProperty", builtinFunctions["file.hasProperty"]);
jexl.addFunction("hasLink", builtinFunctions["file.hasLink"]);

function normalizeExpression(expression: string): string {
  return expression
    .replace(/\bfile\.hasTag\s*\(/g, "hasTag(_file, ")
    .replace(/\bfile\.inFolder\s*\(/g, "inFolder(_file, ")
    .replace(/\bfile\.hasProperty\s*\(/g, "hasProperty(_note, ")
    .replace(/\bfile\.hasLink\s*\(/g, "hasLink(_file, ");
}

function extractEmbeds(body: string | undefined): string[] {
  if (!body) return [];
  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  const embeds: string[] = [];
  let match;
  while ((match = embedRegex.exec(body)) !== null) {
    embeds.push(match[1]);
  }
  return embeds;
}

function createFileProperties(note: Note): FileProperties {
  const parts = note.id.split("/");
  const fileName = parts[parts.length - 1];
  const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  const basename = fileName.replace(/\.[^.]+$/, "");
  const ext = fileName.includes(".") ? fileName.split(".").pop() || "md" : "md";

  return {
    name: note.data.title || fileName,
    basename,
    path: note.id,
    folder,
    ext,
    ctime: note.data.date || note.data.created,
    mtime: note.data.lastModified || note.data.updated || note.data.date,
    tags: Array.isArray(note.data.tags) ? note.data.tags : [],
    links: Array.isArray(note.data.links) ? note.data.links : [],
    embeds: extractEmbeds(note.body),
    properties: { ...note.data },
  };
}

function createContext(note: Note): EvaluationContext {
  return {
    file: createFileProperties(note),
    note: note.data,
  };
}

function evaluateExpression(expression: string, context: EvaluationContext): boolean {
  try {
    const fileProxy = {
      name: wrapString(context.file.name),
      basename: wrapString(context.file.basename),
      path: wrapString(context.file.path),
      folder: wrapString(context.file.folder),
      ext: wrapString(context.file.ext),
      size: context.file.size,
      ctime: wrapDate(context.file.ctime),
      mtime: wrapDate(context.file.mtime),
      tags: wrapList(context.file.tags),
      links: wrapList(context.file.links),
      embeds: wrapList(context.file.embeds),
      properties: context.file.properties,
      hasTag: (tag: string) => builtinFunctions["file.hasTag"](context.file, tag),
      inFolder: (folder: string) => builtinFunctions["file.inFolder"](context.file, folder),
      hasProperty: (prop: string) => builtinFunctions["file.hasProperty"](context.note, prop),
      hasLink: (link: string) => builtinFunctions["file.hasLink"](context.file, link),
    };

    const variables: Record<string, unknown> = {
      file: fileProxy,
      _file: context.file,
      _note: context.note,
      ...context.note,
    };

    const normalized = normalizeExpression(expression);
    const result = jexl.evalSync(normalized, variables);
    return isTruthy(result);
  } catch {
    return false;
  }
}

function evaluateFilter(filter: Filter, context: EvaluationContext): boolean {
  if (typeof filter === "string") return evaluateExpression(filter, context);

  if (typeof filter === "object") {
    if ("and" in filter && Array.isArray(filter.and)) {
      return filter.and.every((sub) => evaluateFilter(sub, context));
    }
    if ("or" in filter && Array.isArray(filter.or)) {
      return filter.or.some((sub) => evaluateFilter(sub, context));
    }
    if ("not" in filter && Array.isArray(filter.not)) {
      return !filter.not.some((sub) => evaluateFilter(sub, context));
    }
  }
  return true;
}

export function filterNotes(notes: Note[], filter?: Filter, limit?: number): FilterResult {
  const totalCount = notes.length;
  if (!filter) {
    const result = limit ? notes.slice(0, limit) : notes;
    return { notes: result, filteredCount: result.length, totalCount };
  }

  const filtered = notes.filter((note) => {
    const context = createContext(note);
    return evaluateFilter(filter, context);
  });

  const result = limit ? filtered.slice(0, limit) : filtered;
  return { notes: result, filteredCount: result.length, totalCount };
}

export function getPropertyValue(note: Note, propertyName: string): unknown {
  if (propertyName.startsWith("file.")) {
    const fileProps = createFileProperties(note);
    const prop = propertyName.substring(5);
    if (prop in fileProps) return fileProps[prop as keyof FileProperties];
    return undefined;
  }
  if (propertyName in note.data) return (note.data as Record<string, unknown>)[propertyName];
  return undefined;
}

export function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
