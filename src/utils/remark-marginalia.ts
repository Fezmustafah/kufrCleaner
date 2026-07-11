import type { Html, Parent, Root, RootContent, Text } from "mdast";
import type { VFile } from "vfile";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";

// Astro parses posts with GFM, so buffered note content can contain GFM-only
// node types (footnoteReference, delete, table…). Serializing without the
// GFM extensions throws "Cannot handle unknown node" and silently kills the
// whole post render.
const TO_MD = { extensions: [gfmToMarkdown()] };

export interface MarginaliaEntry {
  id: number;
  content: string;
  html: string;
}

export interface MarginaliaOptions {
  enable?: boolean;
}

const defaultOptions: Required<MarginaliaOptions> = {
  enable: true,
};

function stripTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

/**
 * Process markdown content to HTML for use inside a marginalia note.
 * Strips the wrapping <p> tag for inline display.
 */
async function processMarkdown(content: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify);

  const result = await processor.process(content);
  let html = String(result).trim();

  // Unwrap single paragraph for inline rendering
  if (html.startsWith("<p>") && html.endsWith("</p>")) {
    html = html.slice(3, -4);
  }

  return html;
}

/**
 * Remark plugin that parses {{marginalia}} syntax.
 *
 * Syntax: wrap any text in double curly braces — {{your side note here}}
 * Supports full markdown inside the braces (bold, italic, links, images, code).
 *
 * On desktop (≥1640px): renders as Tufte-style margin notes beside the text.
 * On mobile (<1280px): degrades gracefully to numbered footnotes at page bottom.
 *
 * Stores the parsed entries on file.data.astro.frontmatter.marginalia so
 * PostLayout can access them via remarkPluginFrontmatter.
 */
export function remarkMarginalia(userOpts: MarginaliaOptions = {}) {
  const opts = { ...defaultOptions, ...userOpts };

  if (!opts.enable) {
    return () => (tree: Root) => tree;
  }

  return async function transformer(tree: Root, file: VFile) {
    const marginaliaEntries: MarginaliaEntry[] = [];
    let marginaliaId = 0;

    // Footnotes referenced inside {{...}} notes. The reference leaves the
    // body when the note is extracted, so GFM would drop its definition from
    // the bottom footnote section. Two-part fix:
    //  1. In the note HTML, [^n] becomes a real superscript link to the
    //     bottom definition (GFM's ids are `fn-<identifier>`; clobberPrefix
    //     is '' in astro.config.mjs).
    //  2. A hidden "echo" footnoteReference is re-emitted right after the
    //     marker (sup.fn-echo, display:none in marginalia.css) so GFM still
    //     renders the definition — and its ↩ backref returns to the marker.
    const footnoteIds = new Set<string>();
    for (const node of tree.children) {
      if (node.type === "footnoteDefinition") footnoteIds.add(node.identifier);
    }

    const linkifyFootnoteRefs = (markdown: string): string =>
      markdown.replace(/\[\^([^\]]+)\]/g, (match, label: string) => {
        const id = label.toLowerCase();
        if (!footnoteIds.has(id)) return match;
        return `<sup class="note-fn-ref"><a href="#fn-${id}">${label}</a></sup>`;
      });

    const collectFnRefs = (nodes: RootContent[], out: Map<string, string>) => {
      for (const n of nodes) {
        if (n.type === "footnoteReference") {
          out.set(n.identifier, n.label || n.identifier);
        }
        if (isParent(n)) collectFnRefs(n.children as RootContent[], out);
      }
    };

    async function processChildren(
      nodes: RootContent[],
    ): Promise<RootContent[]> {
      // Normalize MDX escape placeholders (⟪ → {{ and ⟫ → }}) in text nodes.
      // The mdx-escape-marginalia Vite plugin replaces {{...}} with ⟪...⟫ so
      // MDX's acorn parser doesn't reject them. After MDX parses the file,
      // ⟪ and ⟫ may be in DIFFERENT text nodes (split by em/strong/img nodes),
      // so we normalize all text nodes here before the buffer-collection loop,
      // which already handles openers/closers in different nodes.
      for (const node of nodes) {
        if (node.type === "text") {
          (node as Text).value = (node as Text).value
            .replace(/\u27ea/g, "{{")
            .replace(/\u27eb/g, "}}");
        }
      }

      const newChildren: RootContent[] = [];
      let buffer: RootContent[] | null = null;

      const flushAsNote = async () => {
        if (!buffer || buffer.length === 0) {
          buffer = null;
          return;
        }

        // Labeled form (aarnphm syntax): {{sidenotes[anchor words]: note}} —
        // the anchor words stay in the running text as the note's marker.
        // Bare {{note}} keeps the glyph-only marker.
        let anchorLabel = "";
        const firstNode = buffer[0];
        if (firstNode?.type === "text") {
          const labelMatch = (firstNode as Text).value.match(/^sidenotes\[([^\]]*)\]:\s*/);
          if (labelMatch) {
            anchorLabel = labelMatch[1];
            (firstNode as Text).value = (firstNode as Text).value.slice(labelMatch[0].length);
          }
        }

        const noteFnRefs = new Map<string, string>();
        collectFnRefs(buffer, noteFnRefs);

        const rawMarkdown = stripTrailingNewline(
          toMarkdown({ type: "root", children: buffer }, TO_MD),
        );
        const markdownContent = linkifyFootnoteRefs(rawMarkdown.trim());

        if (!markdownContent) {
          buffer = null;
          return;
        }

        const html = await processMarkdown(markdownContent);
        marginaliaId += 1;
        const id = marginaliaId;

        marginaliaEntries.push({ id, content: markdownContent, html });

        const escapedLabel = anchorLabel
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const htmlMarker = `<span class="footnote-container"><label for="mn-${id}" class="margin-toggle footnote-number">${escapedLabel}</label><input type="checkbox" id="mn-${id}" class="margin-toggle" /><span id="mn-note-${id}" class="footnote">${html}</span></span>`;

        newChildren.push({ type: "html", value: htmlMarker } as Html);

        // Hidden echo references (see block comment above)
        for (const [identifier, label] of noteFnRefs) {
          if (!footnoteIds.has(identifier)) continue;
          newChildren.push({
            type: "footnoteReference",
            identifier,
            label,
            data: { hProperties: { className: ["fn-echo"] } },
          } as unknown as RootContent);
        }

        buffer = null;
      };

      const flushAsLiteral = () => {
        if (!buffer) return;

        const literalContent = stripTrailingNewline(
          toMarkdown({ type: "root", children: buffer }, TO_MD),
        );
        newChildren.push({
          type: "text",
          value: `{{${literalContent}`,
        } as Text);
        buffer = null;
      };

      for (const node of nodes) {
        if (node.type === "text") {
          let text = (node as Text).value;

          while (text.length > 0) {
            if (buffer) {
              const endIndex = text.indexOf("}}");

              if (endIndex === -1) {
                buffer.push({ type: "text", value: text } as Text);
                text = "";
              } else {
                const portion = text.slice(0, endIndex);
                if (portion) buffer.push({ type: "text", value: portion } as Text);
                text = text.slice(endIndex + 2);
                await flushAsNote();
              }
            } else {
              const startIndex = text.indexOf("{{");

              if (startIndex === -1) {
                newChildren.push({ type: "text", value: text } as Text);
                text = "";
              } else {
                if (startIndex > 0) {
                  newChildren.push({
                    type: "text",
                    value: text.slice(0, startIndex),
                  } as Text);
                }
                text = text.slice(startIndex + 2);
                buffer = [];
              }
            }
          }
        } else if (buffer) {
          buffer.push(node);
        } else {
          if (isParent(node) && Array.isArray(node.children)) {
            (node as Parent).children = await processChildren(
              node.children as RootContent[],
            );
          }
          newChildren.push(node);
        }
      }

      if (buffer) flushAsLiteral();

      return newChildren;
    }

    function isParent(node: RootContent): node is Parent & RootContent {
      return "children" in node && Array.isArray((node as Parent).children);
    }

    tree.children = await processChildren(tree.children);

    // Expose marginalia to the layout via remarkPluginFrontmatter
    if (!file.data.astro) file.data.astro = {};
    if (!file.data.astro.frontmatter) file.data.astro.frontmatter = {};
    file.data.astro.frontmatter.marginalia = marginaliaEntries;

    return tree;
  };
}

export default remarkMarginalia;
