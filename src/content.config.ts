import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Define schema for blog posts
const postsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().default('Untitled Post'),
    description: z.string().nullable().optional().default('No description provided'),
    date: z.coerce.date().default(() => new Date()),
    tags: z.array(z.string()).nullable().optional(),
    draft: z.boolean().optional(),
    image: z.any().nullable().optional().transform((val) => {
      // Handle various Obsidian syntax formats
      if (Array.isArray(val)) {
        // Handle array format from [[...]] syntax - take first element
        val = val[0] || null;
      }
      if (typeof val !== 'string') return null;
      // Markdown image syntax: ![alt](url) → url
      const md = val.match(/^!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/);
      if (md) return md[1];
      return val;
    }),
    imageOG: z.boolean().optional(),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    targetKeyword: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    banner: z.string().nullable().optional(),
    modified: z.coerce.date().optional(),
    noIndex: z.boolean().optional(),
    category: z.string().nullable().optional(),
  }),
});

// Define schema for static pages
const pagesCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/pages' }),
  schema: z.object({
    title: z.string().default('Untitled Page'),
    description: z.string().nullable().optional().default('No description provided'),
    draft: z.boolean().optional(),
    lastModified: z.coerce.date().optional(),
    image: z.any().nullable().optional().transform((val) => {
      // Handle various Obsidian syntax formats
      if (Array.isArray(val)) {
        // Handle array format from [[...]] syntax - take first element
        val = val[0] || null;
      }
      if (typeof val !== 'string') return null;
      // Markdown image syntax: ![alt](url) → url
      const md = val.match(/^!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/);
      if (md) return md[1];
      return val;
    }),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    noIndex: z.boolean().optional(),
  }),
});


// Define schema for special home pages (homepage blurb, 404, projects index, docs index)
const specialCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/special' }),
  schema: z.object({
    title: z.string().default('Untitled Page'),
    description: z.string().nullable().optional().default('No description provided'),
    hideTOC: z.boolean().optional(),
    // These pages have fixed URLs and special logic
    // URLs are determined by the file location, not frontmatter
  }),
});

// Define schema for tag description pages
const tagsCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tags' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    date: z.coerce.date().optional(),
    modified: z.coerce.date().optional(),
    created: z.coerce.date().optional(),
    image: z.string().nullable().optional(),
    imageAlt: z.string().nullable().optional(),
  }),
});

// Define schema for category (Map of Content) pages
const categoriesCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/categories' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    date: z.coerce.date().optional(),
    modified: z.coerce.date().optional(),
    created: z.coerce.date().optional(),
    image: z.string().nullable().optional(),
    imageAlt: z.string().nullable().optional(),
  }),
});

// Export collections
export const collections = {
  posts: postsCollection,
  pages: pagesCollection,
  special: specialCollection,
  tags: tagsCollection,
  categories: categoriesCollection,
};

