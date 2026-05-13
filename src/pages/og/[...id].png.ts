import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { siteConfig } from '@/config';
import { optimizePostImagePath, stripObsidianBrackets } from '@/utils/images';

// ── Font loading (module-level cache — fetched once per build) ────────────
let _fontRegular: ArrayBuffer | null = null;
let _fontBold: ArrayBuffer | null = null;

async function loadGoogleFontTTF(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await fetch(url, {
    headers: {
      // Old Safari UA — Google Fonts returns TTF (satori supports TTF/OTF/WOFF)
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  }).then((r) => r.text());

  const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match?.[1]) throw new Error(`Could not parse TTF URL from Google Fonts for ${family}:${weight}`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

async function getFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (!_fontRegular) _fontRegular = await loadGoogleFontTTF('Lora', 400);
  if (!_fontBold) _fontBold = await loadGoogleFontTTF('Lora', 700);
  return { regular: _fontRegular, bold: _fontBold };
}

// ── Banner image → 1200×630 JPEG base64 data URL ─────────────────────────
async function loadBannerDataUrl(banner: string, postId: string): Promise<string | null> {
  try {
    const cleanPath = stripObsidianBrackets(banner.trim());
    if (!cleanPath) return null;

    let imageBuffer: Buffer;

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const res = await fetch(cleanPath);
      if (!res.ok) return null;
      imageBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      // Resolve via the same public path logic used by seo.ts
      const publicRelPath = optimizePostImagePath(cleanPath, postId, postId);
      const fsPath = join(process.cwd(), 'public', publicRelPath.replace(/^\//, ''));
      if (!existsSync(fsPath)) return null;
      imageBuffer = readFileSync(fsPath);
    }

    const resized = await sharp(imageBuffer)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();

    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── OG image template (unified layout — background is the only variable) ──
function buildElement(opts: {
  title: string;
  description?: string | null;
  bannerDataUrl: string | null;
  siteTitle: string;
  tags?: (string | null)[];
}) {
  const { title, description, bannerDataUrl, siteTitle, tags } = opts;
  const cleanTags = (tags ?? []).filter((t): t is string => !!t);
  const titleSize = title.length > 80 ? 36 : title.length > 55 ? 44 : 54;
  const hasBanner = !!bannerDataUrl;

  const desc = description
    ? description.length > 130
      ? description.slice(0, 127) + '…'
      : description
    : null;

  const children: object[] = [
    // Dark overlay — only needed over a photo background
    ...(hasBanner ? [{
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.1) 100%)',
        },
      },
    }] : []),
    // Decorative rings — only on gradient background (look odd on photos)
    ...(!hasBanner ? [
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            top: -200, right: -200,
            width: 580, height: 580,
            borderRadius: 290,
            border: '1px solid rgba(212,172,82,0.12)',
          },
        },
      },
      {
        type: 'div',
        props: {
          style: {
            position: 'absolute',
            top: -100, right: -100,
            width: 360, height: 360,
            borderRadius: 180,
            border: '1px solid rgba(212,172,82,0.08)',
          },
        },
      },
    ] : []),
    // Site name
    {
      type: 'div',
      props: {
        style: {
          color: '#D4AC52',
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: 3,
        },
        children: siteTitle.toUpperCase(),
      },
    },
    // Flex spacer
    { type: 'div', props: { style: { flex: 1 } } },
    // Post title
    {
      type: 'div',
      props: {
        style: {
          color: '#F2EAD8',
          fontSize: titleSize,
          fontWeight: 700,
          lineHeight: 1.3,
          marginBottom: desc ? 18 : 0,
        },
        children: title,
      },
    },
  ];

  if (desc) {
    children.push({
      type: 'div',
      props: {
        style: {
          color: '#A88C65',
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.5,
          marginBottom: cleanTags.length ? 20 : 0,
        },
        children: desc,
      },
    });
  }

  if (cleanTags.length) {
    children.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'row',
          gap: 10,
        },
        children: cleanTags.slice(0, 4).map((tag) => ({
          type: 'div',
          props: {
            style: {
              color: '#C8963E',
              fontSize: 15,
              fontWeight: 400,
              border: '1px solid rgba(200,150,62,0.4)',
              borderRadius: 4,
              padding: '3px 12px',
            },
            children: `#${tag}`,
          },
        })),
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: hasBanner
          ? `url(${bannerDataUrl})`
          : 'linear-gradient(135deg, #1C1008 0%, #3A2501 55%, #1C1008 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '60px 72px',
        position: 'relative',
      },
      children,
    },
  };
}

// ── Static paths ──────────────────────────────────────────────────────────
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts
    .filter((p) => !p.data.draft)
    .map((p) => ({ params: { id: p.id }, props: { post: p } }));
};

// ── Route handler ─────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Awaited<ReturnType<typeof getCollection<'posts'>>>[number] };
  const { title, description, banner, image, tags } = post.data;

  // Priority: banner (dedicated OG) → image (post cover) → text card
  const ogSource = banner || image;
  let bannerDataUrl: string | null = null;
  if (ogSource) {
    bannerDataUrl = await loadBannerDataUrl(ogSource, post.id);
  }

  const { regular, bold } = await getFonts();

  const element = buildElement({
    title: title || 'Untitled',
    description: description ?? null,
    bannerDataUrl,
    siteTitle: siteConfig.title,
    tags,
  });

  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Lora', data: regular, weight: 400, style: 'normal' },
      { name: 'Lora', data: bold,    weight: 700, style: 'normal' },
    ],
  });

  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 8 })
    .toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
