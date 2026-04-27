/**
 * Unified Note type — maps to Astro content collection entries.
 * Uses entry.id (not slug) per project rules.
 */
export type Note = {
  id: string;
  data: Record<string, any>;
  body?: string;
};

export type ViewType = "table" | "cards" | "list";

export type FilterConjunction = "and" | "or" | "not";

export type Filter =
  | string
  | { [K in FilterConjunction]?: Filter[] };

export interface BaseView {
  type: ViewType;
  name: string;
  limit?: number;
  filters?: Filter;
  order?: string[];
  image?: string;
  imageFit?: "cover" | "contain" | "";
  imageAspectRatio?: number;
  cardSize?: number;
}

export interface BaseConfig {
  filters?: Filter;
  formulas?: Record<string, string>;
  properties?: Record<string, PropertyConfig>;
  views: BaseView[];
}

export interface PropertyConfig {
  displayName?: string;
}

export interface FileProperties {
  name: string;
  basename: string;
  path: string;
  folder: string;
  ext: string;
  size?: number;
  ctime?: Date;
  mtime?: Date;
  tags: string[];
  links: string[];
  embeds: string[];
  properties?: Record<string, any>;
}

export type NoteProperties = Record<string, any>;

export interface EvaluationContext {
  file: FileProperties;
  note: NoteProperties;
  formula?: Record<string, any>;
}

export interface FilterResult {
  notes: Note[];
  filteredCount: number;
  totalCount: number;
}

export type BaseFunction = (...args: any[]) => any;
export type FunctionRegistry = Record<string, BaseFunction>;
