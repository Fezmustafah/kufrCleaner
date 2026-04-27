import * as yaml from "js-yaml";
import type { BaseConfig, BaseView, Filter, PropertyConfig } from "./types";

interface RawBaseYAML {
  views?: unknown[];
  filters?: unknown;
  formulas?: unknown;
  properties?: unknown;
}

interface RawViewYAML {
  type?: string;
  name?: string;
  limit?: number;
  filters?: unknown;
  order?: unknown;
  image?: string;
  imageFit?: string;
  imageAspectRatio?: number;
  cardSize?: number;
  [key: string]: unknown;
}

export function parseBaseFile(content: string): BaseConfig {
  try {
    const parsed = yaml.load(content) as RawBaseYAML;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Base file must contain a valid YAML object");
    }
    if (!parsed.views || !Array.isArray(parsed.views) || parsed.views.length === 0) {
      throw new Error('Base file must contain at least one view in the "views" array');
    }

    const views: BaseView[] = parsed.views.map((view: unknown, index: number) => {
      const rawView = view as RawViewYAML;
      if (!rawView || typeof rawView !== "object") {
        throw new Error(`View at index ${index} must be an object`);
      }
      if (!rawView.type || !["table", "cards", "list"].includes(rawView.type)) {
        throw new Error(`View at index ${index} must have a valid type (table, cards, or list)`);
      }
      if (!rawView.name || typeof rawView.name !== "string") {
        throw new Error(`View at index ${index} must have a name`);
      }
      return {
        type: rawView.type as BaseView["type"],
        name: rawView.name,
        limit: rawView.limit ? Number(rawView.limit) : undefined,
        filters: rawView.filters as Filter | undefined,
        order: Array.isArray(rawView.order) ? (rawView.order as string[]) : undefined,
        image: rawView.image as string | undefined,
        imageFit: rawView.imageFit as BaseView["imageFit"] | undefined,
        imageAspectRatio: rawView.imageAspectRatio ? Number(rawView.imageAspectRatio) : undefined,
        cardSize: rawView.cardSize ? Number(rawView.cardSize) : undefined,
      };
    });

    return {
      views,
      filters: parsed.filters as Filter | undefined,
      formulas: parsed.formulas as Record<string, string> | undefined,
      properties: parsed.properties as Record<string, PropertyConfig> | undefined,
    };
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`Invalid YAML in base file: ${error.message}`);
    }
    throw error;
  }
}

export function combineFilters(globalFilters?: Filter, viewFilters?: Filter): Filter | undefined {
  if (!globalFilters && !viewFilters) return undefined;
  if (!globalFilters) return viewFilters;
  if (!viewFilters) return globalFilters;
  return { and: [globalFilters, viewFilters] };
}
