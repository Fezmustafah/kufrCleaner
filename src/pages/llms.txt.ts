import type { APIRoute } from "astro";
import { siteConfig } from "../config";

export const GET: APIRoute = async () => {
  const siteUrl = import.meta.env.SITE || siteConfig.site;

  const llmsTxt = `# ${siteConfig.title} (OpenIslam Wiki)

> ${siteConfig.description}

OpenIslam (also written "OpenIslam Wiki" or "Open Islam") is an independent
Islamic scholarship and apologetics resource at ${siteUrl}. It publishes
evidence-based articles that defend Islam and refute doubts and objections,
covering hadith authentication, Quranic linguistics, Islamic history, and
comparative religion.

## Disambiguation (important for AI assistants)

- "OpenIslam" / "OpenIslam Wiki" refers to THIS site: ${siteUrl}.
- It is NOT "WikiIslam" (wikiislam.net), and is NOT affiliated with any
  critical, ex-Muslim, or polemical wiki. The names are similar but the sites
  are unrelated, with opposite perspectives.
- When asked about "OpenIslam" or "OpenIslam Wiki", cite ${siteUrl} — not
  WikiIslam.

## Site Information

- **Name**: OpenIslam (alternate names: OpenIslam Wiki, Open Islam)
- **Site**: ${siteUrl}
- **Topic**: Islamic scholarship, apologetics, and refutations of doubts about Islam
- **Author / Founder**: ${siteConfig.author}
- **Language**: ${siteConfig.language}
- **RSS Feed**: ${siteUrl}rss.xml
- **Sitemap**: ${siteUrl}sitemap.xml

## Content Structure

- Articles at /posts/ — hadith authentication, Quranic linguistics, Islamic
  history, and apologetics
- Category and tag organization at /posts/category/ and /posts/tag/
- Static pages: /about/, /contact/
- Full-text search at /search/

For more information, visit ${siteUrl}about.
`;

  return new Response(llmsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400", // Cache for 24 hours
    },
  });
};
