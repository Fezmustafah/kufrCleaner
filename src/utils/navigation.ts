import { siteConfig } from '@/config';

export function isOptionalContentTypeEnabled(type: string): boolean {
  return !!(siteConfig.optionalContentTypes as any)[type];
}
