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
    url: "/open-graph.png",
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
  let ogImage: OpenGraphImage | undefined;

  // Always use fallback image for homepage
  ogImage = getDefaultOGImage();
  ogImage = {
    ...ogImage,
    url: `${siteConfig.site}${ogImage.url}`,
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
      url: `${siteConfig.site}/open-graph.png`,
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
      url: `${siteConfig.site}/open-graph.png`,
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

