import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { shouldShowContent } from '@/utils/markdown';
import { siteConfig } from '@/config';

export const GET: APIRoute = async () => {
  if (!siteConfig.optionalContentTypes.manuscripts) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const manuscripts = await getCollection('manuscripts');
  const isDev = import.meta.env.DEV;

  const data = manuscripts
    .filter(m => shouldShowContent(m, isDev))
    .map(m => ({
      id: m.id,
      title: m.data.title,
      subtitle: m.data.subtitle ?? null,
      abstract: m.data.abstract ?? null,
      authors: m.data.authors ?? [],
      date: m.data.date?.toISOString() ?? null,
      type: m.data.type ?? 'essay',
      status: m.data.status ?? 'draft',
      tags: m.data.tags ?? [],
      doi: m.data.doi ?? null,
      url: m.data.url ?? null,
      publishedIn: m.data.publishedIn ?? null,
      slug: `/manuscripts/${m.id}/`,
    }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = true;
