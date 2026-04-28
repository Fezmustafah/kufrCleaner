import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { remarkInternalLinks, remarkFolderImages, remarkImageCaptions } from './src/utils/internallinks.ts';
import remarkCallouts from './src/utils/remark-callouts.ts';
import remarkImageGrids from './src/utils/remark-image-grids.ts';
import remarkMermaid from './src/utils/remark-mermaid.ts';
import { remarkObsidianEmbeds } from './src/utils/remark-obsidian-embeds.ts';
import remarkBases from './src/utils/remark-bases.ts';
import remarkInlineTags from './src/utils/remark-inline-tags.ts';
import { remarkObsidianComments } from './src/utils/remark-obsidian-comments.ts';
import remarkObsidianImageSize from './src/utils/remark-obsidian-image-size.ts';
import remarkMath from 'remark-math';
import remarkReadingTime from 'remark-reading-time';
import remarkToc from 'remark-toc';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeMark from './src/utils/rehype-mark.ts';
import rehypeImageAttributes from './src/utils/rehype-image-attributes.ts';
import { rehypeNormalizeAnchors } from './src/utils/rehype-normalize-anchors.ts';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { siteConfig } from './src/config.ts';
import { remarkMarginalia } from './src/utils/remark-marginalia.ts';
import remarkCitations from './src/utils/remark-citations.ts';
import swup from '@swup/astro';
import refreshContentOnChange from './src/integrations/refresh-content-on-change.ts';
import { fileURLToPath } from 'node:url';

// Deployment platform configuration
const DEPLOYMENT_PLATFORM = process.env.DEPLOYMENT_PLATFORM || 'netlify';
const isGitHubPages = DEPLOYMENT_PLATFORM === 'github-pages';

export default defineConfig({
  site: isGitHubPages ? 'https://fezmustafah.github.io' : siteConfig.site,
  base: isGitHubPages ? '/kufrCleaner' : undefined,
  deployment: {
    platform: DEPLOYMENT_PLATFORM
  },
  csp: {
    scriptDirective: {
      resources: [
        "'self'",
        "'unsafe-inline'",
        "https://unpkg.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://giscus.app",
        "https://platform.twitter.com"
      ]
    },
    styleDirective: {
      resources: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ]
    },
    fontDirective: {
      resources: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ]
    },
    imgDirective: {
      resources: ["'self'", "data:", "https:"]
    },
    connectDirective: {
      resources: ["'self'", "https://giscus.app"]
    },
    frameDirective: {
      resources: [
        "'self'",
        "https://www.youtube.com",
        "https://giscus.app",
        "https://platform.twitter.com"
      ]
    }
  },
  devToolbar: {
    enabled: true
  },
  redirects: (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'build') ? {
  '/posts/2026-projects': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/notes-on-prophet-muhammad-in-bible': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/final-academic-response-1351212802366242877': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/marriage-with-aisha': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/the-doubt-about-al-zuhris-statement-we-were-informed-that-he-had-recited-a-lot-of-the-quran': '/posts/al-zuhris-weak-narration-debunked-no-the-quran-was-never-lost-or-incomplete',
  '/posts/syriac-borrows-the-name-god-from-arabic-according-to-scientific-and-archaeological-evidence': '/posts/allah-is-not-from-syriac-archaeological-proof-the-word-is-originally-arabic',
  '/posts/and-purify-your-garments': '/posts/and-purify-your-garmentsdoes-the-command-to-avoid-idols-mean-that-the-messenger-worshipped-idols',
  '/posts/update-2026-1490037128745189496': '/posts/anekatah',
  '/posts/differences-in-quranic-manuscripts-advanced': '/posts/are-quranic-manuscript-differences-evidence-of-corruption-a-refutation-of-daniel-brubaker',
  '/posts/documented-scientific-references': '/posts/authors-of-gospels',
  '/posts/by-sawt-al-haqiqa-ig': '/posts/aw-rah-of-slave-women',
  '/posts/untitled-1319673407654330471': '/posts/birth-of-prophet',
  '/posts/they-steal-when-hungry': '/posts/black-people-steal-when-hungry-is-there-any-racism-in-islam',
  '/posts/by-islamophobes-nightmare-pdf': '/posts/by-islamophobes-nightmare-pdf-slavery',
  '/posts/65-4-surah-talaq-4-child-marriage': '/posts/child-marriage-in-islam-main-article',
  '/posts/circumambulating-the-kaaba': '/posts/circumambulating-the-kaaba-is-paganism-the-bible-answers',
  '/posts/the-blind-companion-killed-his-wife-or-female-slave-when-she-insulted-the-prophet': '/posts/did-a-blind-companion-kill-his-wife-for-insulting-the-prophet-complete-hadith-refutation',
  '/posts/responding-to-the-doubt-about-breastfeeding-an-adult-in-detail': '/posts/did-islam-allow-breastfeeding-an-adult-scholarly-refutation-of-the-salim-hadith-misconception',
  '/posts/ahmad': '/posts/did-jesus-prophesy-ahmad-in-john-16-the-greek-arabic-connection-explained',
  '/posts/khalid-bin-al-walid-may-allah-be-pleased-with-him-was-a-cannibal-who': '/posts/did-khalid-ibn-al-walid-commit-cannibalism-refuting-the-slander-full-isnad-analysis-biblical-counter-evidence',
  '/posts/mecca-never-existed': '/posts/did-mecca-exist-before-the-4th-century-historical-evidence-that-proves-it-did',
  '/posts/responding-to-the-suspicion-that-embryology-in-the-quran-is-borrowed-from-aristotle-and-hippocrates': '/posts/did-muhammad-copy-embryology-from-greek-science-refuting-the-aristotle-and-hippocrates-claim',
  '/posts/is-surat-al-fil-borrowed-from-the-poet-rubah-ibn-al-ajaj': '/posts/did-prophet-muhammad-borrow-surah-al-fil-refuting-the-rubah-ibn-al-ajjaj-claim',
  '/posts/muslim-prayer-is-taken-from-the-sumerian-civilization': '/posts/did-prophet-muhammad-copy-prayer-from-sumerians-a-complete-refutation',
  '/posts/response-to-the-allegation-that-the-prophet-defecated-and-ate-without-washing-his-hands-or-touching': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-eat-with-unclean-hands-full-refutation-of-the-christian-polemic',
  '/posts/kissed-hassan-hussain': '/posts/did-the-prophet-kiss-al-hasan-on-the-lips-context-hadith-analysis-christian-objections-refuted',
  '/posts/prophet-kissed-hassan-and-hussain': '/posts/did-the-prophet-kiss-al-hasan-on-the-lips-context-hadith-analysis-christian-objections-refuted',
  '/posts/she-died-so-i-slept-with-her': '/posts/did-the-prophet-lie-with-fatima-bint-asad-in-her-grave-linguistic-and-hadith-refutation-of-the-christian-allegation',
  '/posts/bani-mustaliq': '/posts/did-the-prophet-muhammad-attack-peaceful-people-the-raid-on-banu-al-mustaliq-explained',
  '/posts/refuting-the-claim-that-the-prophet-peace-and-blessings-be-upon-him-borrowed-from-jabr-and-yasar': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-learn-from-two-christian-slaves-the-jabr-yasar-accusation-refuted',
  '/posts/killing-of-kinana-bin-al-rabi-bin-abi-al-haqiq': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-order-the-torture-of-kinanah-ibn-al-rabi-a-full-isnad-refutation-of-the-khaybar-slander',
  '/posts/is-the-story-of-luqman-s-advice-to-his-son-transferred': '/posts/did-the-quran-borrow-luqmans-wisdom-from-ahiqar-full-refutation-of-the-claim',
  '/posts/story-of-abraham-and-his-father-in-the-quran-was-quoted-from-the-haggadah': '/posts/did-the-quran-copy-abrahams-story-from-the-haggadah-a-complete-refutation-with-historical-evidence',
  '/posts/response-to-the-allegation-that-the-story-of-the-birth-of-christ-was-copied-from-the-apocryphal-go': '/posts/did-the-quran-copy-from-the-apocryphal-gospels-a-complete-refutation-with-academic-sources',
  '/posts/blowing-up-the-talmudic-traditions-in-the-quran': '/posts/did-the-quran-copy-the-talmud-a-complete-refutation-of-the-plagiarism-claim',
  '/posts/update-1369578720981155840': '/posts/do-muslims-worship-the-kaaba-the-qibla-accusation-refuted-with-christian-biblical-evidence',
  '/posts/from-refuting-kufar-recommended': '/posts/does-allah-pray-on-the-prophet-the-meaning-of-salawat-in-quran-33-56-christian-objection-refuted',
  '/posts/allah-prays-scans': '/posts/does-allah-pray-on-the-prophet-the-meaning-of-salawat-in-quran-33-56-christian-objection-refuted',
  '/posts/refuting-the-christians-evidence-of-denying-the-good-news-of-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/prophet-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/book-of-hosea': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/the-name-of-muhammad-in-hosea-96': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/isa42-even-accepted-by-jews-of-medina': '/posts/does-isaiah-42-prophesy-muhammad-the-chosen-servant-prophecy-examined',
  '/posts/isaiah-42-the-main-prophecy': '/posts/does-isaiah-42-prophesy-muhammad-the-chosen-servant-prophecy-examined',
  '/posts/the-lie-that-islam-attributes-the-child-of-adultery-to-the-husband': '/posts/does-islam-attribute-adultery-children-to-the-husband-refuting-the-child-belongs-to-the-bed',
  '/posts/trinity-exist-in-islam': '/posts/does-the-christian-trinity-exist-in-islam-a-complete-refutation',
  '/posts/1st-doubt': '/posts/doubts-regarding-prophet-marriage-with-safiyyah-bint-huyayy',
  '/posts/and-the-clear-miracle': '/posts/embroyology-hadith',
  '/posts/even-if-he-committed-adultery-and-even-if-he-stole': '/posts/even-if-he-committed-adultery-and-even-if-he-stole-does-islam-permit-major-sins',
  '/posts/final-academic-response': '/posts/flat-earth-in-islam',
  '/posts/update-2026': '/posts/he-hastens-to-fulfill-your-desires-v2',
  '/posts/a-distortion-to-obliterate-the-good-tidings-on-the-tongue-of-christ': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/john-7-52-the-prophet-of-end-times': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/distortions-in-gospel-of-john-to-obliterate-the-prophecy-on-the-tongue-of-jesus': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/moon-god': '/posts/is-allah-a-moon-god-the-claim-debunked-and-why-yahweh-has-a-bigger-problem',
  '/posts/the-name-of-ahmad-in-isaiah-421': '/posts/is-muhammad-ahmad-named-in-isaiah-42-1-the-chosen-one-prophecy-explained',
  '/posts/response-to-christan-lies': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology-of-prophet': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/desire-of-nations': '/posts/is-the-desire-of-all-nations-in-haggai-2-7-a-prophecy-about-muhammad-the-hebrew-hmd-explained',
  '/posts/hadith-about-the-age-of-flies': '/posts/is-the-hadith-about-the-flys-lifespan-being-40-nights-authentic-full-isnad-analysis-scientific-proof',
  '/posts/captives-of-awtas': '/posts/islamic-rules-of-war-captives-the-rape-accusation-a-complete-refutation',
  '/posts/psalms-84': '/posts/mecca-in-the-bible-the-hidden-prophecy-of-psalm-84-bakkah',
  '/posts/the-hidden-prophecy-of-psalm-84-bakkah': '/posts/mecca-in-the-bible-the-hidden-prophecy-of-psalm-84-bakkah',
  '/posts/untitled-1319706055076220939': '/posts/mercy-of-prophet-muhammad',
  '/posts/the-prophet-as-mercy-towards-humanity': '/posts/mercy-of-prophet-muhammad',
  '/posts/as-for-my-cousin-he-violated-my-honor': '/posts/my-honor-was-violated-does-the-hadith-mean-the-prophet-صلى-الله-عليه-وسلم-was-assaulted',
  '/posts/prophecies-of-the-end-time-b-prophet': '/posts/prophecies',
  '/posts/prophcies': '/posts/prophecies',
  '/posts/dt-33-2': '/posts/prophecy-in-deuteronomy-332',
  '/posts/revision': '/posts/prophets-doubt-in-islam-what-does-yunus-94-really-mean',
  '/posts/psalms-120': '/posts/psalm-120-in-the-tents-of-kedar-and-the-meccan-persecution',
  '/posts/context': '/posts/quran-434-wife-beating-verse-additions',
  '/posts/update-2026-1468269937515823264': '/posts/refuting-the-dirham-anachronism-how-the-quran-accurately-describes-ancient-currency',
  '/posts/slavery-quick-version': '/posts/slavery-in-islam-islamic-law-vs-western-systems-explained',
  '/posts/from-islamophobes-nightmare-pdf': '/posts/slavery-in-islam-islamophobes',
  '/posts/slavery': '/posts/slavery-resources-only',
  '/posts/sunset': '/posts/sun-sets-in-muddy-spring',
  '/posts/update-1340956212472320102': '/posts/the-camel-urine-hadith-explained-context-science-and-refutation',
  '/posts/muslim-2361': '/posts/the-date-palm-pollination-hadith-scholarly-positions',
  '/posts/genealogy-of-muhammad': '/posts/the-genealogy-of-prophet-muhammad-صلى-الله-عليه-وسلم-from-ishmael-to-the-final-prophet',
  '/posts/messenger-applied-light-and-turned-his-pubic-hair-with-his-hand': '/posts/the-prophet-صلى-الله-عليه-وسلم-and-depilatory-cream-hadith-analysis-refutation',
  '/posts/untitled-1319706865596371084': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/lslam-attitude-towards-non-muslim': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/response-to-the-suspicion-that-embryology-in-the-quran-was-borrowed-from-galen-and-al-harith-bin-ka': '/posts/the-quran-did-not-copy-galen-embryology-objection-refuted',
  '/posts/the-danger-of-usury-testimonials-from-non-muslims': '/posts/the-quran-was-right-non-muslim-scholars-economists-us-senate-reports-on-the-harm-of-usury',
  '/posts/quran-n-hail': '/posts/the-qurans-mention-of-hail-and-snow',
  '/posts/samaritan-error-archeological-error': '/posts/the-samaritan-anachronism-debunked-al-samiri-in-the-quran-and-the-true-origins-of-the-samaritans',
  '/posts/bond-women-awrah': '/posts/the-slave-girls-awrah-in-islamic-jurisprudence-a-complete-analysis',
  '/posts/women-rights': '/posts/the-status-of-women-among-islamic-jurists',
  '/posts/mutah-pleasure-marriage': '/posts/the-truth-about-mutah-temporary-marriage-permanently-forbidden-in-quran-sunnah-full-evidence',
  '/posts/untitled-1319671382862200917': '/posts/the-unique-characteristics-of-the-prophet-muhammad-صلى-الله-عليه-وسلم-khaṣāiṣ-al-nabī',
  '/posts/characteristics-of-prophet': '/posts/the-unique-characteristics-of-the-prophet-muhammad-صلى-الله-عليه-وسلم-khaṣāiṣ-al-nabī',
  '/posts/and-indeed-it-is-expanding': '/posts/the-universe-is-expanding',
  '/posts/well-of-buda-dawood-67': '/posts/the-well-of-budhaah-hadith-does-islam-permit-ablution-with-filthy-water',
  '/posts/tirmidhi-2861-jinns-zutt-the-prophet': '/posts/the-zutt-and-prophet',
  '/posts/story-of-people-of-zutt-and-prophet': '/posts/the-zutt-and-prophet',
  '/posts/story-of-dhul-qarnayn-was-borrowed-from-syriac-sources': '/posts/was-dhul-qarnayn-borrowed-from-the-alexander-legend-a-refutation-of-the-syriac-source-theory',
  '/posts/is-hajj-a-pagan-ritual-taken-from-hindus': '/posts/was-islamic-hajj-borrowed-from-hinduism-full-refutation-of-the-hindu-ritual-claim',
  '/posts/non-islamic-sources-regarding-the-prophet-muhammads-saw-being-unlettered': '/posts/was-prophet-muhammad-illiterate-non-islamic-sources-on-the-unlettered-prophet',
  '/posts/untitled-1359074889570455562': '/posts/what-has-islam-given-to-the-world',
  '/posts/the-lie-that-the-prophet-ordered-the-sucking-of-genitals': '/posts/what-is-the-meaning-of-until-he-tastes-her-honey-in-the-halala-hadith-refuting-the-oral-sex-allegation-against-the-prophets-hadith',
  '/posts/testimonies-of-non-muslims': '/posts/what-non-muslims-said-about-prophet-muhammad-testimonies-from-historians-scholars',
  '/posts/allah-almighty-gave-good-tidings-to-abraham-peace-be-upon-him-of-a-forbearing-boy-and-in-anothe': '/posts/which-of-abrahams-two-sons-was-the-forbearing-boy-and-which-was-the-knowledgeable-boy',
  '/posts/and-then-sends-a-prophet': '/posts/why-did-god-leave-people-for-600-years-before-sending-prophet-muhammad',
  '/posts/we-have-killed-the-messiah-jesus-the-son-of-mary-the-messenger-of-god': '/posts/why-did-the-jews-call-jesus-messiah-if-they-didnt-believe-in-him-the-quranic-answer-explained',
  '/posts/deficient-in-religion': '/posts/women-are-deficient-in-religio',
  '/posts/untitled-1319668747341926410': '/posts/women-rights-before-islam'
} : {},
image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false,
      }
    },
    remotePatterns: []
  },
  integrations: [
    refreshContentOnChange(),
    tailwind(),
    sitemap(),
    swup({
      theme: false,
      animationClass: 'transition-swup-',
      containers: ['#swup-container'],
      smoothScrolling: false,
      cache: process.env.NODE_ENV === 'production', // off in dev so post edits show immediately
      preload: true,
      accessibility: false,
      updateHead: true,
      updateBodyClass: false,
      globalInstance: true,
      plugins: [], // Disable all plugins including scroll
      skipPopStateHandling: (event) => {
        // ALWAYS skip Swup handling for back/forward navigation
        // Let the browser handle it naturally
        return true;
      },
      // Simplified link selector for better compatibility
      linkSelector: 'a[href]:not([data-no-swup]):not([href^="mailto:"]):not([href^="tel:"])'
    })
  ],
  markdown: {
      remarkPlugins: [
      remarkCitations,          // Process [@citation-key] inline citations
      remarkObsidianImageSize, // Parse Obsidian image size syntax first
      remarkInternalLinks,
      remarkInlineTags,
      remarkObsidianComments, // Remove Obsidian comments (%%...%%) early in processing
      remarkMarginalia,       // Parse {{marginalia}} side notes (⟪...⟫ in .mdx normalized internally)
      remarkFolderImages,
      remarkObsidianEmbeds,
      // Bases directive (table-only v1)
      remarkBases,
      remarkImageCaptions,
      remarkMath,
      remarkCallouts,
      remarkBreaks,
      remarkImageGrids,
      remarkMermaid,
      [remarkReadingTime, {}],
      [remarkToc, {
        tight: true,
        ordered: false,
        maxDepth: 3,
        heading: 'contents|table[ -]of[ -]contents?|toc'
      }],
    ],
    rehypePlugins: [
      rehypeKatex,
      rehypeMark,
      rehypeImageAttributes,
      [rehypeSlug, {
        test: (node) => node.tagName !== 'h1'
      }],
      [rehypeAutolinkHeadings, {
        behavior: 'wrap',
        test: (node) => node.tagName !== 'h1',
        properties: {
          className: ['anchor-link'],
          ariaLabel: 'Link to this section'
        }
      }],
      rehypeNormalizeAnchors, // Run LAST to ensure className and href fixes aren't overridden
    ],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },
  vite: {
    assetsInclude: ['**/*.base', '**/*.home', '**/*.base'],
    build: {
      rollupOptions: {
        external: ['/pagefind/pagefind.js'],
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@/layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
        '@/utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
        '@/types': fileURLToPath(new URL('./src/types.ts', import.meta.url)),
        '@/config': fileURLToPath(new URL('./src/config.ts', import.meta.url))
      }
    },
    server: {
      host: 'localhost',
      port: 5000,
      strictPort: false, // Allow fallback to 5001 if 5000 is occupied (e.g., AirPlay on macOS)
      allowedHosts: [],
      middlewareMode: false,
      hmr: true,
      watch: {
        ignored: ['**/.obsidian/**', '**/_bases/**', '**/bases/**'],
        usePolling: process.platform === 'win32',
        interval: 1000
      },
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        // CSP headers are handled by src/middleware.ts for all routes
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    optimizeDeps: {
      exclude: ['astro:content']
    },
    exclude: ['**/_redirects']
  },
  build: {
    assets: '_assets'
  }
});
