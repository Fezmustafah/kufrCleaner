import type {
  Post,
  Page,
  Project,
  Docs,
  SEOData,
  OpenGraphImage,
} from "@/types";
import siteConfig from "@/config";
import {
  optimizeContentImagePath,
} from "./images";

// Helper function to get default OG image
function getDefaultOGImage(): OpenGraphImage {
  return {
    url: "/hero.webp",
    alt: siteConfig.defaultOgImageAlt,
    width: 1200,
    height: 630,
  };
}

// Helper function to extract image path from Obsidian bracket syntax
function extractImagePath(image: string): string {
  if (!image || typeof image !== "string") return "";

  // Handle Obsidian bracket syntax: [[path/to/image.jpg]] (unquoted)
  if (image.startsWith("[[") && image.endsWith("]]")) {
    return image.slice(2, -2); // Remove [[ and ]]
  }

  // Handle quoted Obsidian bracket syntax: "[[path/to/image.jpg]]"
  if (image.startsWith('"[[') && image.endsWith(']]"')) {
    return image.slice(3, -3); // Remove "[[ and ]]"
  }

  // Return as-is for regular paths
  return image;
}

// Generate SEO data for posts
export function generatePostSEO(post: Post, url: string): SEOData {
  const { title, description, tags, date, modified } = post.data;

  return {
    title: `${title} | ${siteConfig.title}`,
    description: description || '',
    canonical: url,
    ogImage: {
      // Dynamic OG image generated at /og/[id].png — handles banner/text card logic
      url: `${siteConfig.site}/og/${post.id}.png`,
      alt: post.data.imageAlt || `${title} — ${siteConfig.title}`,
      width: 1200,
      height: 630,
    },
    ogType: "article",
    author: post.data.author || siteConfig.author,
    publishedTime: date.toISOString(),
    modifiedTime: (modified || date).toISOString(),
    tags: tags?.filter((tag) => tag !== null) || undefined,
    noIndex: post.data.noIndex || false,
  };
}

// Generate SEO data for pages
export function generatePageSEO(page: Page, url: string): SEOData {
  const { title, description, image } = page.data;

  let ogImage: OpenGraphImage | undefined;

  if (image) {
    // Extract image path from Obsidian bracket syntax if needed
    const imagePath = extractImagePath(image);

    // Handle both local and external image paths
    let imageUrl: string;
    if (imagePath.startsWith("http")) {
      // External URL
      imageUrl = imagePath;
    } else {
      // Use optimizeContentImagePath for proper path resolution
      const optimizedPath = optimizeContentImagePath(
        imagePath,
        "pages",
        page.id,
        page.id
      );
      imageUrl = `${siteConfig.site}${optimizedPath}`;
    }
    ogImage = {
      url: imageUrl,
      alt: page.data.imageAlt || `Featured image for page: ${title}`,
      width: 1200,
      height: 630,
    };
  } else {
    // Use default OG image
    ogImage = getDefaultOGImage();
    ogImage = {
      ...ogImage,
      url: `${siteConfig.site}${ogImage.url}`,
    };
  }

  return {
    title: `${title} | ${siteConfig.title}`,
    description: description || "",
    canonical: url,
    ogImage,
    ogType: "website",
    noIndex: page.data.noIndex || false, // Add this line
  };
}

// Generate SEO data for projects
export function generateProjectSEO(project: Project, url: string): SEOData {
  const { title, description, image, date } = project.data;

  let ogImage: OpenGraphImage | undefined;

  if (image) {
    // Extract image path from Obsidian bracket syntax if needed
    const imagePath = extractImagePath(image);

    // Handle both local and external image paths
    let imageUrl: string;
    if (imagePath.startsWith("http")) {
      // External URL
      imageUrl = imagePath;
    } else {
      // Use optimizeImagePath for proper path resolution
      const optimizedPath = optimizeContentImagePath(
        imagePath,
        "projects",
        project.id,
        project.id
      );
      imageUrl = `${siteConfig.site}${optimizedPath}`;
    }
    ogImage = {
      url: imageUrl,
      alt: project.data.imageAlt || `Featured image for project: ${title}`,
      width: 1200,
      height: 630,
    };
  } else {
    // Use default OG image
    ogImage = getDefaultOGImage();
    ogImage = {
      ...ogImage,
      url: `${siteConfig.site}${ogImage.url}`,
    };
  }

  return {
    title: `${title} | ${siteConfig.title}`,
    description: description || '',
    canonical: url,
    ogImage,
    ogType: "article",
    publishedTime: date.toISOString(),
    modifiedTime: date.toISOString(),
    tags: project.data.categories?.filter((cat) => cat !== null) || undefined,
    noIndex: project.data.noIndex || false,
  };
}

// Generate SEO data for documentation
export function generateDocumentationSEO(
  documentation: Docs,
  url: string
): SEOData {
  const { title, description, image, category, version } = documentation.data;

  let ogImage: OpenGraphImage | undefined;

  if (image) {
    // Extract image path from Obsidian bracket syntax if needed
    const imagePath = extractImagePath(image);

    let imageUrl: string;
    if (imagePath.startsWith("http")) {
      // External URL
      imageUrl = imagePath;
    } else {
      // Use optimizeImagePath for proper path resolution
      const optimizedPath = optimizeContentImagePath(
        imagePath,
        "documentation",
        documentation.id,
        documentation.id
      );
      imageUrl = `${siteConfig.site}${optimizedPath}`;
    }
    ogImage = {
      url: imageUrl,
      alt:
        documentation.data.imageAlt ||
        `Featured image for documentation: ${title}`,
      width: 1200,
      height: 630,
    };
  } else {
    // Use default OG image
    ogImage = getDefaultOGImage();
    ogImage = {
      ...ogImage,
      url: `${siteConfig.site}${ogImage.url}`,
    };
  }

  return {
    title: `${title} | ${siteConfig.title}`,
    description: description || '',
    canonical: url,
    ogImage,
    ogType: "article",
    articleSection: category || undefined,
    keywords: version
      ? [`${category || "Documentation"}`, `version ${version}`]
      : [category || "Documentation"],
    noIndex: documentation.data.noIndex || false,
  };
}

// Generate SEO data for homepage
export function generateHomeSEO(url: string): SEOData {
  // Use the site hero image as the homepage OG image when configured;
  // falls back to /open-graph.png via getDefaultOGImage().
  const heroPath = siteConfig.hero?.image;
  const ogImage: OpenGraphImage = heroPath
    ? {
        url: `${siteConfig.site}${heroPath}`,
        alt: siteConfig.hero?.imageAlt || siteConfig.defaultOgImageAlt,
        width: 1200,
        height: 630,
      }
    : {
        ...getDefaultOGImage(),
        url: `${siteConfig.site}${getDefaultOGImage().url}`,
      };

  return {
    title: siteConfig.title,
    description: siteConfig.description,
    canonical: normalizeCanonicalUrl(url),
    ogImage,
    ogType: "website",
  };
}

// Generate SEO data for tag pages
export function generateTagSEO(
  tag: string,
  site: string,
  currentPage?: number
): SEOData {
  const title = `Posts tagged with "${tag}" | ${siteConfig.title}`;
  const description = `Browse all posts tagged with ${tag} on ${siteConfig.title}`;
  const baseUrl = `${site}/posts/tag/${tag}`;
  const canonical =
    currentPage && currentPage > 1 ? `${baseUrl}/${currentPage}` : baseUrl;

  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    ogType: "website",
    ogImage: {
      ...getDefaultOGImage(),
      url: `${siteConfig.site}/hero.webp`,
    },
  };
}

// Generate SEO data for posts listing pages
export function generatePostsListSEO(
  site: string,
  currentPage?: number
): SEOData {
  const title =
    currentPage && currentPage > 1
      ? `Posts - Page ${currentPage} | ${siteConfig.title}`
      : `Posts | ${siteConfig.title}`;
  const description = `Browse all posts on ${siteConfig.title}`;
  const canonical =
    currentPage && currentPage > 1
      ? `${site}/posts/${currentPage}`
      : `${site}/posts`;

  return {
    title,
    description,
    canonical,
    robots: "index, follow",
    ogType: "website",
    ogImage: {
      ...getDefaultOGImage(),
      url: `${siteConfig.site}/hero.webp`,
    },
  };
}

// Normalize canonical URLs to prevent duplicates
export function normalizeCanonicalUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash unless it's the root
    if (urlObj.pathname !== "/" && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Generate structured data (JSON-LD)
export function generateStructuredData(
  type: "blog" | "article" | "website",
  data: any
) {
  const baseData = {
    "@context": "https://schema.org",
    "@type":
      type === "blog" ? "Blog" : type === "article" ? "BlogPosting" : "WebSite",
    ...data,
  };

  return JSON.stringify(baseData);
}

// Generate Organization structured data — the primary entity-disambiguation
// signal. Tells Google/AI that "OpenIslam" is a distinct entity (with its own
// alternate names + social profiles) so it is NOT conflated with the
// similarly-named WikiIslam. Emitted site-wide via BaseLayout.
export function generateOrganizationSchema(): string {
  const sameAs = (siteConfig.navigation?.social || [])
    .map((s) => s.url)
    .filter((u): u is string => !!u && u.startsWith("http"));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.site}/#organization`,
    name: siteConfig.title,
    alternateName: ["OpenIslam Wiki", "Open Islam", "openislam.wiki"],
    url: siteConfig.site,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.site}/logo.png`,
    },
    image: `${siteConfig.site}/logo.png`,
    description: siteConfig.description,
    disambiguatingDescription:
      "OpenIslam is an independent Islamic scholarship and apologetics resource that defends Islam through evidence-based articles on hadith authentication, Quranic linguistics, and Islamic history. It is unrelated to WikiIslam or any critical/ex-Muslim wiki.",
    founder: { "@type": "Person", name: siteConfig.author },
    knowsAbout: [
      "Islamic apologetics",
      "Hadith authentication",
      "Quranic linguistics",
      "Islamic history",
      "Comparative religion",
      "Refutation of doubts about Islam",
    ],
    sameAs,
  });
}

// Generate a DefinedTerm for "OpenIslam" — an explicit, machine-readable
// definition that pins the name (and its variants) to THIS site, so AI/search
// does not resolve the term to the similarly-named WikiIslam. Homepage only.
export function generateDefinedTermSchema(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${siteConfig.site}/#term-openislam`,
    name: "OpenIslam",
    alternateName: ["OpenIslam Wiki", "Open Islam"],
    description:
      "OpenIslam (openislam.wiki) is an independent Islamic scholarship and apologetics website that defends Islam through evidence-based articles. It is a distinct entity, unrelated to WikiIslam.",
    url: siteConfig.site,
    inDefinedTermSet: { "@id": `${siteConfig.site}/#organization` },
  });
}

// Generate WebSite structured data with SearchAction + publisher linkage to the
// Organization entity above. Emitted on website-type pages via BaseLayout.
export function generateWebsiteSchema(description?: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.site}/#website`,
    name: siteConfig.title,
    alternateName: ["OpenIslam Wiki", "Open Islam"],
    url: siteConfig.site,
    description: description || siteConfig.description,
    inLanguage: siteConfig.language,
    publisher: { "@id": `${siteConfig.site}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.site}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

// Check if page should be excluded from sitemap
export function shouldExcludeFromSitemap(slug: string): boolean {
  if (!slug) return false;

  const excludePatterns = ["404", "sitemap", "rss", "api/"];

  return excludePatterns.some((pattern) => slug.includes(pattern));
}

// Create breadcrumb structured data
export function generateBreadcrumbs(
  path: Array<{ name: string; url: string }>
): any {
  const items = path.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

