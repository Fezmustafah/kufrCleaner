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
        return val[0] || null;
      }
      if (typeof val === 'string') {
        // Handle string format - return as-is
        return val;
      }
      return null;
    }),
    imageOG: z.boolean().optional(),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    targetKeyword: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    noIndex: z.boolean().optional(),
    category: z.string().nullable().optional(),
  }),
});

// Define schema for static pages
const pagesCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/_empty' }),
  schema: z.object({
    title: z.string().default('Untitled Page'),
    description: z.string().nullable().optional().default('No description provided'),
    draft: z.boolean().optional(),
    lastModified: z.coerce.date().optional(),
    image: z.any().nullable().optional().transform((val) => {
      // Handle various Obsidian syntax formats
      if (Array.isArray(val)) {
        // Handle array format from [[...]] syntax - take first element
        return val[0] || null;
      }
      if (typeof val === 'string') {
        // Handle string format - return as-is
        return val;
      }
      return null;
    }),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    noIndex: z.boolean().optional(),
  }),
});

// Define schema for projects
const projectsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/projects' }),
  schema: z.object({
    title: z.string().default('Untitled Project'),
    description: z.string().nullable().optional().default('No description provided'),
    date: z.coerce.date().default(() => new Date()),
    categories: z.array(z.string()).nullable().optional().default([]),
    repositoryUrl: z.union([z.string(), z.null(), z.undefined()]).optional().transform(val => val || ''),
    projectUrl: z.union([z.string(), z.null(), z.undefined()]).optional().transform(val => val || ''),
    demoUrl: z.union([z.string(), z.null(), z.undefined()]).optional().transform(val => val || ''),
    demoURL: z.union([z.string(), z.null(), z.undefined()]).optional().transform(val => val || ''),
    status: z.string().nullable().optional(),
    image: z.any().nullable().optional().transform((val) => {
      // Handle various Obsidian syntax formats
      if (Array.isArray(val)) {
        // Handle array format from [[...]] syntax - take first element
        return val[0] || null;
      }
      if (typeof val === 'string') {
        // Handle string format - return as-is
        return val;
      }
      return null;
    }),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    draft: z.boolean().optional(),
    noIndex: z.boolean().optional(),
    featured: z.boolean().optional(),
  }),
});

// Citation reference schema (reusable)
const citationReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(['article', 'book', 'chapter', 'conference', 'thesis', 'report', 'website', 'other']).optional().default('other'),
  title: z.string(),
  author: z.union([z.string(), z.array(z.string())]).optional(),
  year: z.number().optional(),
  journal: z.string().optional(),
  booktitle: z.string().optional(),
  publisher: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  accessed: z.string().optional(),
});

// Define schema for manuscripts
const manuscriptsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/manuscripts' }),
  schema: z.object({
    title: z.string().default('Untitled Manuscript'),
    subtitle: z.string().nullable().optional(),
    abstract: z.string().nullable().optional(),
    authors: z.union([z.string(), z.array(z.string())]).optional().transform(val =>
      val ? (Array.isArray(val) ? val : [val]) : []
    ),
    date: z.coerce.date().default(() => new Date()),
    modified: z.coerce.date().optional(),
    type: z.enum(['essay', 'paper', 'research-note', 'review', 'preprint', 'other']).optional().default('essay'),
    status: z.string().nullable().optional().default('draft'),
    tags: z.array(z.string()).nullable().optional(),
    categories: z.array(z.string()).nullable().optional().default([]),
    doi: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    pdf: z.string().nullable().optional(),
    publishedIn: z.string().nullable().optional(),
    volume: z.string().nullable().optional(),
    issue: z.string().nullable().optional(),
    pages: z.string().nullable().optional(),
    references: z.array(citationReferenceSchema).optional().default([]),
    draft: z.boolean().optional(),
    noIndex: z.boolean().optional(),
    hideTOC: z.boolean().optional().default(true),
    showTOC: z.boolean().optional(),
    featured: z.boolean().optional(),
  }),
});

// Define schema for docs
const docsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/docs' }),
  schema: z.object({
    title: z.string().default('Untitled Documentation'),
    description: z.string().nullable().optional().default('No description provided'),
    category: z.string().nullable().optional().default('General'),
    order: z.number().default(0),
    lastModified: z.coerce.date().optional(),
    version: z.string().nullable().optional(),
    image: z.any().nullable().optional().transform((val) => {
      // Handle various Obsidian syntax formats
      if (Array.isArray(val)) {
        // Handle array format from [[...]] syntax - take first element
        return val[0] || null;
      }
      if (typeof val === 'string') {
        // Handle string format - return as-is
        return val;
      }
      return null;
    }),
    imageAlt: z.string().nullable().optional(),
    hideCoverImage: z.boolean().optional(),
    hideTOC: z.boolean().optional(),
    draft: z.boolean().optional(),
    noIndex: z.boolean().optional(),
    showTOC: z.boolean().optional(),
    featured: z.boolean().optional(),
  }),
});

// Define schema for special home pages (homepage blurb, 404, projects index, docs index)
const specialCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bin/_empty' }),
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

// Export collections
export const collections = {
  posts: postsCollection,
  pages: pagesCollection,
  projects: projectsCollection,
  manuscripts: manuscriptsCollection,
  docs: docsCollection,
  special: specialCollection,
  tags: tagsCollection,
};

