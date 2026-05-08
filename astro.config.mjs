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
import rehypeRebaseLinks from './src/utils/rehype-rebase-links.ts';
import rehypeFigureCaptions from './src/utils/rehype-figure-captions.ts';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { rehypeHeadingHighlight } from './src/utils/rehype-heading-highlight.ts';
import { siteConfig } from './src/config.ts';
import { remarkMarginalia } from './src/utils/remark-marginalia.ts';
import remarkAnnotations from './src/utils/remark-annotations.ts';
import remarkCitations from './src/utils/remark-citations.ts';
import swup from '@swup/astro';
import refreshContentOnChange from './src/integrations/refresh-content-on-change.ts';
import { fileURLToPath } from 'node:url';

// Deployment platform configuration
const DEPLOYMENT_PLATFORM = process.env.DEPLOYMENT_PLATFORM || 'netlify';
const isGitHubPages = DEPLOYMENT_PLATFORM === 'github-pages';

export default defineConfig({
  site: isGitHubPages ? 'https://fezmustafah.github.io' : siteConfig.site,
  base: isGitHubPages ? '/kufrCleaner/' : undefined,
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
  '/posts/abbasid-islam-and-the-composition-of-the-sunnah-in-the-abbasid-era': '/posts/abbasid-islam-refuted-early-syriac-evidence-for-islam-before-the-abbasids',
  '/posts/story-of-abrahas-elephant-and-how-the-elephant-traveled-in-the-desert-and-can-the-elephant-walk-in': '/posts/abrahas-elephant-can-an-elephant-walk-from-yemen-to-mecca-every-doubt-refuted',
  '/posts/2026-projects': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/notes-on-prophet-muhammad-in-bible': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/ahad-vs-wahid': '/posts/ahad-vs-wahidواحد-vs-أحد-the-arabic-word-that-proves-gods-absolute-oneness-in-surah-al-ikhlas',
  '/posts/final-academic-response-1351212802366242877': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/marriage-with-aisha': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/aishas-jealousy-made-her-wish-to-be-stung-by-a-scorpion-or-a-snake': '/posts/aishas-jealousy-and-love-for-the-prophet-صلى-الله-عليه-وسلم-the-camel-incident-explained',
  '/posts/shocking-facts-about-the-fatimid-caliph-called-al-hakim-bi-amr-allah-who-persecuted-christians': '/posts/al-hakim-bi-amr-allah-the-fatimid-caliph-who-persecuted-christians-was-not-muslim-his-mother-was-christian-and-he-claimed-to-be-god',
  '/posts/the-doubt-about-al-zuhris-statement-we-were-informed-that-he-had-recited-a-lot-of-the-quran': '/posts/al-zuhris-weak-narration-debunked-no-the-quran-was-never-lost-or-incomplete',
  '/posts/syriac-borrows-the-name-god-from-arabic-according-to-scientific-and-archaeological-evidence': '/posts/allah-is-not-from-syriac-archaeological-proof-the-word-is-originally-arabic',
  '/posts/and-purify-your-garments': '/posts/and-purify-your-garmentsdoes-the-command-to-avoid-idols-mean-that-the-messenger-worshipped-idols',
  '/posts/the-arabs-who-settled-in-the-levant-and-iraq-were-called-syrian-arabs-because-syria-originally-refer': '/posts/arabs-of-the-levant-and-iraq-were-called-syrians-what-ancient-greek-and-roman-sources-actually-say',
  '/posts/differences-in-quranic-manuscripts-advanced': '/posts/are-quranic-manuscript-differences-evidence-of-corruption-a-refutation-of-daniel-brubaker',
  '/posts/who-is-asiya-bint-muzahim-1325166212518383616': '/posts/asiya-bint-muzahim-is-isis-nefert-6-historical-proofs-that-match',
  '/posts/documented-scientific-references': '/posts/authors-of-gospels',
  '/posts/by-sawt-al-haqiqa-ig': '/posts/aw-rah-of-slave-women',
  '/posts/untitled-1319673407654330471': '/posts/birth-of-prophet',
  '/posts/they-steal-when-hungry': '/posts/black-people-steal-when-hungry-is-there-any-racism-in-islam',
  '/posts/black-seed': '/posts/black-seed-in-islam-nigella-sativa-prophetic-medicine-and-modern-scientific-research',
  '/posts/by-islamophobes-nightmare-pdf': '/posts/by-islamophobes-nightmare-pdf-slavery',
  '/posts/debunking-the-myth-that-life-originated-by-chance-through-serendipitous-chemical-reactions-and-res': '/posts/can-life-arise-by-chance-debunking-abiogenesis-through-logic-and-cell-biology',
  '/posts/65-4-surah-talaq-4-child-marriage': '/posts/child-marriage-in-islam-main-article',
  '/posts/circumambulating-the-kaaba': '/posts/circumambulating-the-kaaba-is-paganism-the-bible-answers',
  '/posts/distortion-v1': '/posts/corruption-of-bible-general-v2',
  '/posts/cutting-people-with-knives-and-axes-sawing-them-apart-tearing-them-apart-with-threshing-machin-1327293582695993344': '/posts/davids-massacre-in-2-samuel-12-2931-old-bible-translations-vs-modern-changes',
  '/posts/deficient-in-religion': '/posts/deficient-in-mind-and-religion-hadith-meaning-context-and-full-refutation',
  '/posts/women-are-deficient-in-religio': '/posts/deficient-in-mind-and-religion-hadith-meaning-context-and-full-refutation',
  '/posts/the-blind-companion-killed-his-wife-or-female-slave-when-she-insulted-the-prophet': '/posts/did-a-blind-companion-kill-his-wife-for-insulting-the-prophet-complete-hadith-refutation',
  '/posts/t-is-the-hadith-about-a-woman-drinking-the-urine-of-the-prophet-peace-an': '/posts/did-a-woman-drink-the-prophet-muhammads-urine-hadith-authenticity-explained',
  '/posts/his-burning-of-al-fujaah-al-salami': '/posts/did-abu-bakr-burn-al-fujaa-peacefully-the-narrations-are-weak-and-the-context-is-misrepresented',
  '/posts/al-anbiya-98-qiraats-difference': '/posts/did-aisha-and-the-companions-recite-hadhab-jahannam-refuting-a-false-quranic-variant-claim-surah-al-anbiya-verse-98',
  '/posts/responding-to-the-doubt-about-breastfeeding-an-adult-in-detail': '/posts/did-islam-allow-breastfeeding-an-adult-scholarly-refutation-of-the-salim-hadith-misconception',
  '/posts/arian-heresy-argument': '/posts/did-islam-borrow-from-the-ebionites-and-arians-the-jewish-christian-myth-refuted',
  '/posts/did-jacob-wrestle-with-the-god-of-the-christians-or-did-he-wrestle-with-a-human-being': '/posts/did-jacob-wrestle-with-the-god-of-the-christians-or-with-a-human-being',
  '/posts/the-response-to-christs-claim-is-that-god-creates-from-clay-the-shape-of-a-bird-and-it-becomes-a-b': '/posts/did-jesus-creating-a-bird-from-clay-prove-he-is-god-quran-gospel-scholars-answer',
  '/posts/ahmad': '/posts/did-jesus-prophesy-ahmad-in-john-16-the-greek-arabic-connection-explained',
  '/posts/i-am-the-alpha-and-the-omega-the-beginning-and-the-end': '/posts/did-jesus-say-i-am-the-alpha-and-the-omega-manuscript-evidence-and-contextual-proof',
  '/posts/khalid-bin-al-walid-may-allah-be-pleased-with-him-was-a-cannibal-who': '/posts/did-khalid-ibn-al-walid-commit-cannibalism-refuting-the-slander-full-isnad-analysis-biblical-counter-evidence',
  '/posts/mecca-never-existed': '/posts/did-mecca-exist-before-the-4th-century-historical-evidence-that-proves-it-did',
  '/posts/doubt-about-moses-peace-be-upon-him-throwing-the-tablets': '/posts/did-moses-throwing-the-tablets-disrespect-gods-word-al-araf-150-explained-with-tafsir-bible',
  '/posts/responding-to-the-suspicion-that-embryology-in-the-quran-is-borrowed-from-aristotle-and-hippocrates': '/posts/did-muhammad-copy-embryology-from-greek-science-refuting-the-aristotle-and-hippocrates-claim',
  '/posts/responding-to-the-allegation-did-the-quran-steal-the-word-allah-from-elohim-in-the-jewish-heri': '/posts/did-muslims-steal-allah-from-elohim-a-linguistic-refutation',
  '/posts/abraham-lied': '/posts/did-prophet-abraham-commit-shirk-or-doubt-refuting-quranic-misconceptions-about-ibrahim-صلى-الله-عليه-وسلم',
  '/posts/is-surat-al-fil-borrowed-from-the-poet-rubah-ibn-al-ajaj': '/posts/did-prophet-muhammad-borrow-surah-al-fil-refuting-the-rubah-ibn-al-ajjaj-claim',
  '/posts/muslim-prayer-is-taken-from-the-sumerian-civilization': '/posts/did-prophet-muhammad-copy-prayer-from-sumerians-a-complete-refutation',
  '/posts/response-to-the-allegation-that-the-prophet-defecated-and-ate-without-washing-his-hands-or-touching': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-eat-with-unclean-hands-full-refutation-of-the-christian-polemic',
  '/posts/bukhari-6982-suicide': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-try-to-commit-suicide-refuting-the-weak-bukhari-addition-az-zuhris-idraj',
  '/posts/myth-of-the-creation-of-adam-and-how-satan-entered-through-his-mouth-and-exited-through-his-anus': '/posts/did-satan-enter-adams-body-refuting-a-weak-israiliyyat-narration-misused-against-islam',
  '/posts/the-response-to-the-lie-that-the-prophet-peace-and-blessings-be-upon-him-quoted-from-the-monk-bahi': '/posts/did-the-monk-bahira-teach-the-prophet-صلى-الله-عليه-وسلم-the-quran-6-historical-proofs-syriac-forgeries-catholic-encyclopedia-answer',
  '/posts/bhukhari-4503-they-are-from-them-killing-children-night-raid': '/posts/did-the-prophet-allow-killing-women-and-children-a-complete-islamic-response',
  '/posts/kissed-hassan-hussain': '/posts/did-the-prophet-kiss-al-hasan-on-the-lips-context-hadith-analysis-christian-objections-refuted',
  '/posts/prophet-kissed-hassan-and-hussain': '/posts/did-the-prophet-kiss-al-hasan-on-the-lips-context-hadith-analysis-christian-objections-refuted',
  '/posts/she-died-so-i-slept-with-her': '/posts/did-the-prophet-lie-with-fatima-bint-asad-in-her-grave-linguistic-and-hadith-refutation-of-the-christian-allegation',
  '/posts/bani-mustaliq': '/posts/did-the-prophet-muhammad-attack-peaceful-people-the-raid-on-banu-al-mustaliq-explained',
  '/posts/historical-evidence-of-the-messenger-of-god-may-god-bless-him-and-grant-him-peace': '/posts/did-the-prophet-muhammad-really-exist-historical-proof-from-coins-inscriptions-and-non-muslim-chronicles',
  '/posts/refuting-the-claim-that-the-prophet-peace-and-blessings-be-upon-him-borrowed-from-jabr-and-yasar': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-learn-from-two-christian-slaves-the-jabr-yasar-accusation-refuted',
  '/posts/killing-of-kinana-bin-al-rabi-bin-abi-al-haqiq': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-order-the-torture-of-kinanah-ibn-al-rabi-a-full-isnad-refutation-of-the-khaybar-slander',
  '/posts/dawud-4449-trust-tawrat': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-place-his-hand-on-the-torah-refuting-the-weak-hisham-ibn-sad-report',
  '/posts/update-2026-1490037128745189496': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-say-anakta-hā-the-maiz-hadith-arabic-usage-and-legal-clarity',
  '/posts/anekatah': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-say-anakta-hā-the-maiz-hadith-arabic-usage-and-legal-clarity',
  '/posts/existence-of-statues-or-pictures-of-jesus-son-of-mary-and-his-mother-in-the-kaaba': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-spare-the-image-of-mary-jesus-in-the-kaaba-al-azraqis-narrations-examined-with-11-authentic-hadiths',
  '/posts/is-the-story-of-luqman-s-advice-to-his-son-transferred': '/posts/did-the-quran-borrow-luqmans-wisdom-from-ahiqar-full-refutation-of-the-claim',
  '/posts/the-quran-borrowed-the-story-of-solomon-and-the-hoopoe-from-targum-esther-ii': '/posts/did-the-quran-borrow-solomons-hoopoe-story-from-targum-sheni',
  '/posts/story-of-abraham-and-his-father-in-the-quran-was-quoted-from-the-haggadah': '/posts/did-the-quran-copy-abrahams-story-from-the-haggadah-a-complete-refutation-with-historical-evidence',
  '/posts/response-to-the-allegation-that-the-story-of-the-birth-of-christ-was-copied-from-the-apocryphal-go': '/posts/did-the-quran-copy-from-the-apocryphal-gospels-a-complete-refutation-with-academic-sources',
  '/posts/blowing-up-the-talmudic-traditions-in-the-quran': '/posts/did-the-quran-copy-the-talmud-a-complete-refutation-of-the-plagiarism-claim',
  '/posts/doubts-and-responses-to-allegations-of-distortion-of-the-holy-quran': '/posts/did-the-quran-get-distorted-scholarly-refutations-to-8-major-claims-al-hajjaj-ibn-masoud-surat-al-noorayn-more',
  '/posts/sunset': '/posts/did-the-quran-say-the-sun-literally-sets-in-a-muddy-spring-quran-18-86-explained',
  '/posts/the-anomalous-readings-of-ubayd-ikrimah-mujahid-saeed-alqamah-hattan-al-amash': '/posts/do-anomalous-tabiin-readings-disprove-the-qurans-preservation-chain-analysis-birmingham-manuscript-orientalist-testimony',
  '/posts/update-1369578720981155840': '/posts/do-muslims-worship-the-kaaba-the-qibla-accusation-refuted-with-christian-biblical-evidence',
  '/posts/from-refuting-kufar-recommended': '/posts/does-allah-pray-on-the-prophet-the-meaning-of-salawat-in-quran-33-56-christian-objection-refuted',
  '/posts/allah-prays-scans': '/posts/does-allah-pray-on-the-prophet-the-meaning-of-salawat-in-quran-33-56-christian-objection-refuted',
  '/posts/refuting-the-christians-evidence-of-denying-the-good-news-of-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/prophet-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/a-stupid-suspicion-about-the-hanafi-school-of-thought-the-religion-of-the-prophet-abraham-peace-be': '/posts/does-hanif-mean-pagan-refuting-the-christian-objection-against-abrahams-religion',
  '/posts/book-of-hosea': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/the-name-of-muhammad-in-hosea-96': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/isa42-even-accepted-by-jews-of-medina': '/posts/does-isaiah-42-prophesy-muhammad-the-chosen-servant-prophecy-examined',
  '/posts/isaiah-42-the-main-prophecy': '/posts/does-isaiah-42-prophesy-muhammad-the-chosen-servant-prophecy-examined',
  '/posts/does-isaiah-53-talk-about-the-crucifixion-and-resurrection-of-christ': '/posts/does-isaiah-53-prophesy-jesus-hebrew-and-septuagint-evidence-against-the-christian-claim',
  '/posts/the-lie-that-islam-attributes-the-child-of-adultery-to-the-husband': '/posts/does-islam-attribute-adultery-children-to-the-husband-refuting-the-child-belongs-to-the-bed',
  '/posts/a-response-to-the-accursed-enemies-of-religion-who-said-that-islam-permits-bestiality': '/posts/does-islam-permit-bestiality-classical-fiqh-refutation-of-a-false-claim',
  '/posts/does-the-quran-acknowledge-jacobs-struggle-with-god': '/posts/does-israel-mean-wrestling-with-god-hebrew-lexicon-islamic-tafsir-rabbi-rashi-father-tadros-answer',
  '/posts/and-now-father-glorify-me-in-your-own-presence-with-the-glory-that-was-mine-john-17-5-does-this': '/posts/does-john-17-5-indicate-the-divinity-of-christ',
  '/posts/does-the-title-lord-mean-the-divinity-of-christ-kyrios-and-the-specifications-of-the-messiah-a': '/posts/does-lord-prove-jesus-is-god-kyrios-explained-from-christian-sources',
  '/posts/sahih-al-bukhari-3399-muslim-1470d-wives-betraying-the-husband': '/posts/does-sahih-al-bukhari-3399-blame-eve-for-womens-betrayal-refuting-the-misuse-of-the-hadith',
  '/posts/trinity-exist-in-islam': '/posts/does-the-christian-trinity-exist-in-islam-a-complete-refutation',
  '/posts/the-response-to-the-doubt-and-he-made-the-moon-a-light-in-them': '/posts/does-the-moon-light-up-all-seven-heavens-surah-nuh-71-1516-explained-with-tafsir-arabic-grammar',
  '/posts/the-claim-that-god-almighty-does-not-have-the-exclusive-right-to-know-what-is-in-the-wombs': '/posts/does-ultrasound-gender-detection-contradict-quran-31-34-hadith-scholars-embryology-answer',
  '/posts/1st-doubt': '/posts/doubts-regarding-prophet-marriage-with-safiyyah-bint-huyayy',
  '/posts/distortion-of-the-text-of-ephesians-3-9-who-created-all-things-through-jesus-christ': '/posts/ephesians-3-9-exposed-how-through-jesus-christ-was-added-to-the-bible',
  '/posts/immortal-boys-youth': '/posts/eternal-youths-in-paradise-explained-refuting-the-false-claim-about-quran-76-19',
  '/posts/even-if-he-committed-adultery-and-even-if-he-stole': '/posts/even-if-he-committed-adultery-and-even-if-he-stole-does-islam-permit-major-sins',
  '/posts/final-academic-response': '/posts/flat-earth-in-islam',
  '/posts/embroyoloy': '/posts/hadith-of-42-nights-embryology-sex-differentiation-and-organ-formation-explained',
  '/posts/a-collection-of-historical-and-geographical-errors-in-the-gospel-of-mark-quote-from-the-book-of-sai': '/posts/historical-and-geographical-errors-in-the-gospel-of-mark-ninehams-evidence-explained',
  '/posts/has-science-proven-the-impossibility-of-diversification-from-two-pairs': '/posts/hla-gene-diversity-and-adam-eve-does-science-disprove-a-two-person-bottleneck',
  '/posts/the-response-to-the-doubt-about-how-god-created-every-animal-and-every-living-thing-from-water-whil': '/posts/how-can-allah-create-everything-from-water-if-jinn-were-created-from-fire-a-complete-response',
  '/posts/the-response-to-the-doubt-about-the-ant-conversation-with-solomon': '/posts/how-did-the-ant-speak-in-surah-an-naml-science-arabic-linguistics-biblical-parallels',
  '/posts/conditions-of-the-peoples-of-the-sasanian-empire-before-and-after-the-islamic-conquest': '/posts/how-islam-liberated-persia-from-sasanian-oppression-and-built-a-civilization',
  '/posts/the-contradiction-in-the-number-of-angels-in-the-battle-of-badr': '/posts/how-many-angels-were-at-badr-resolving-the-1000-vs-3000-vs-5000-doubt-quran-tafsir-bible',
  '/posts/a-distortion-to-obliterate-the-good-tidings-on-the-tongue-of-christ': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/john-7-52-the-prophet-of-end-times': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/distortions-in-gospel-of-john-to-obliterate-the-prophecy-on-the-tongue-of-jesus': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/doubts-about-the-compilation-of-the-holy-quran': '/posts/how-was-the-quran-compiled-dots-diacritics-the-two-collections-doubts-answered',
  '/posts/falsifying-the-genetic-similarity-between-humans-and-apes': '/posts/human-ape-dna-similarity-refuted-the-988-genetic-similarity-claim-examined',
  '/posts/distortion-of-the-word-samad-in-the-editions-of-ibn-kathirs-interpretation-or-vice-versa': '/posts/ibn-kathir-and-samad-refuting-the-claim-that-allahs-name-came-from-an-idol',
  '/posts/abraham-lied-1325421805514784820': '/posts/ibrahim-only-told-three-lies-what-did-the-prophet-صلى-الله-عليه-وسلم-mean-al-nawawi-ibn-al-jawzi-al-razi-explained',
  '/posts/if-jesus-is-god-because-he-forgave-sins-then-let-the-christian-worship-the-jewish-priest-because-he': '/posts/if-jesus-forgave-sins-does-that-prove-he-is-god-a-biblical-refutation',
  '/posts/moon-god': '/posts/is-allah-a-moon-god-the-claim-debunked-and-why-yahweh-has-a-bigger-problem',
  '/posts/david-is-also-the-christ-the-son-of-god-the-forgotten-fourth-divine-person': '/posts/is-david-also-the-christ-and-son-of-god-a-biblical-challenge-to-christian-title-based-divinity-claims',
  '/posts/is-the-prophet-descended-from-the-prostitute-and-fallen-grandmother-of-jesus-tamar': '/posts/is-prophet-muhammad-صلى-الله-عليه-وسلم-descended-from-tamar-refuting-the-zerah-genealogy-claim',
  '/posts/response-to-christan-lies': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology-of-prophet': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/desire-of-nations': '/posts/is-the-desire-of-all-nations-in-haggai-2-7-a-prophecy-about-muhammad-the-hebrew-hmd-explained',
  '/posts/hadith-about-the-age-of-flies': '/posts/is-the-hadith-about-the-flys-lifespan-being-40-nights-authentic-full-isnad-analysis-scientific-proof',
  '/posts/is-the-word-waqi-distorted-in-the-quran-why-is-there-no-extension-of-the-alif-in-some-words-in': '/posts/is-the-word-wāqi-distorted-in-the-quran-the-truth-about-alif-in-ancient-manuscripts',
  '/posts/surah-nisa-34-domestic-abuse-quran-434': '/posts/islam-and-wife-beating-classical-scholars-on-quran-4-34-and-its-strict-limits',
  '/posts/captives-of-awtas': '/posts/islamic-rules-of-war-captives-the-rape-accusation-a-complete-refutation',
  '/posts/the-story-of-the-angel-in-the-sinaiticus-manuscript-and-the-papal-lie-in-response-to-pope-shenouda': '/posts/john-5-34-and-the-angel-at-bethesda-missing-from-the-oldest-bible-manuscripts',
  '/posts/distortion-of-the-text-of-the-angel-of-blessing': '/posts/john-5-4-is-not-in-the-bible-manuscript-evidence-exposes-a-major-new-testament-distortion',
  '/posts/a-scribe-of-a-12th-century-new-testament-manuscript-added-a-proverb-to-the-text-because-it-fit-the-t': '/posts/john-7-4-a-12th-century-scribe-added-a-proverb-to-the-new-testament-text',
  '/posts/marginalia': '/posts/marginalia-test',
  '/posts/untitled-1319706055076220939': '/posts/mercy-of-prophet-muhammad',
  '/posts/the-prophet-as-mercy-towards-humanity': '/posts/mercy-of-prophet-muhammad',
  '/posts/mirza-ghulams-kufr': '/posts/mirza-ghulam-qadianis-blasphemy-in-his-own-words-kufr-false-prophethood-and-the-qadiani-claim-exposed',
  '/posts/historical-proofs-december-2024-update': '/posts/moon-split-2',
  '/posts/as-for-my-cousin-he-violated-my-honor': '/posts/my-honor-was-violated-does-the-hadith-mean-the-prophet-صلى-الله-عليه-وسلم-was-assaulted',
  '/posts/he-will-be-called-a-nazarene-a-false-prophecy-or-a-lost-text': '/posts/nazareth-netzer-and-matthew-2-23-the-failed-christian-defense-refuted',
  '/posts/noahs-flood-peace-be-upon-him': '/posts/noahs-flood-was-it-global-or-local-the-quran-vs-the-torah',
  '/posts/prophecies-of-the-end-time-b-prophet': '/posts/prophecies',
  '/posts/prophcies': '/posts/prophecies',
  '/posts/dt-33-2': '/posts/prophecy-in-deuteronomy-332',
  '/posts/revision': '/posts/prophets-doubt-in-islam-what-does-yunus-94-really-mean',
  '/posts/psalms-120': '/posts/psalm-120-in-the-tents-of-kedar-and-the-meccan-persecution',
  '/posts/psalm-144-is-missing-6-paragraphs-is-this-a-distortion-or-not': '/posts/psalm-144-in-codex-sinaiticus-missing-verses-or-psalm-numbering-confusion',
  '/posts/update-2026-1468269937515823264': '/posts/refuting-the-dirham-anachronism-how-the-quran-accurately-describes-ancient-currency',
  '/posts/finally-saint-cyril-the-great-solved-the-problem-of-the-christians-orders-to-slaughter-infants-and': '/posts/saint-cyril-on-killing-children-the-biblical-problem-christians-cannot-escape',
  '/posts/slavery-quick-version': '/posts/slavery-in-islam-islamic-law-vs-western-systems-explained',
  '/posts/from-islamophobes-nightmare-pdf': '/posts/slavery-in-islam-islamophobes',
  '/posts/slavery': '/posts/slavery-resources-only',
  '/posts/the-historical-miracle-in-the-quran-and-proof-of-the-destruction-of-the-villages-of-sodom-and-gomorr': '/posts/sodom-and-gomorrah-in-the-quran-historical-evidence-and-the-tall-el-hammam-discovery',
  '/posts/more-questions-asked-about-it-summary-of-debate': '/posts/surah-al-rum-prophecy-refuted-answering-the-badr-hadith-and-ghalabat-reading-doubt',
  '/posts/so-today-we-will-save-you-with-your-body-that-you-may-be-a-sign-to-those-who-come-after-you': '/posts/surah-yunus-92-and-the-mummy-of-ramses-ii-marine-sand-broken-bones-and-the-sign-that-endures',
  '/posts/a-woman-comes-in-the-form-of-a-devil': '/posts/tabarruj-in-islam-what-the-quran-hadith-and-classical-scholars-say-about-womens-modesty',
  '/posts/responding-to-the-allegation-of-similarity-between-the-birth-of-mithras-and-the-prophet-isa-peace': '/posts/the-birth-of-mithras-vs-the-birth-of-jesus-in-the-quran-a-refutation-of-the-similarity-claim',
  '/posts/update-1340956212472320102': '/posts/the-camel-urine-hadith-explained-context-science-and-refutation',
  '/posts/muslim-2361': '/posts/the-date-palm-pollination-hadith-scholarly-positions',
  '/posts/the-miracle-in-the-almightys-saying-he-said-your-appointment-is-the-day-of-adornment': '/posts/the-day-of-adornment-in-the-quran-the-pharaonic-festival-that-confirms-divine-revelation',
  '/posts/20-evidences-that-lie-the-story': '/posts/the-false-attribution-of-the-story-of-david-and-uriahs-wife-to-the-quran',
  '/posts/then-bite-him-with-them-his-father-and-do-not-use-euphemisms-and-did-the-prophet-command-that-some': '/posts/the-fathers-penis-hadith-why-its-weak-misread-mistranslated-a-complete-response',
  '/posts/genealogy-of-muhammad': '/posts/the-genealogy-of-prophet-muhammad-صلى-الله-عليه-وسلم-from-ishmael-to-the-final-prophet',
  '/posts/the-writer-of-the-gospel-of-luke-the-unknown-person-condition-time-and-place-wrote-his-gospe': '/posts/the-gospel-of-luke-unknown-author-human-sources-and-late-dating-problems',
  '/posts/the-weak-one-who-has-no-support': '/posts/the-hadith-of-the-people-of-paradise-and-hell-meaning-of-zabr',
  '/posts/mecca-in-the-bible-the-hidden-prophecy-of-psalm-84-bakkah': '/posts/the-man-of-bakkah-in-psalm-84-ancient-manuscripts-hebrew-linguistics-the-prophet-صلى-الله-عليه-وسلم',
  '/posts/aisha-broke-plates': '/posts/the-prophet-صلى-الله-عليه-وسلم-aishas-jealousy-and-the-bowl-incident-refuting-claims-of-lust-and-misconduct',
  '/posts/messenger-applied-light-and-turned-his-pubic-hair-with-his-hand': '/posts/the-prophet-صلى-الله-عليه-وسلم-and-depilatory-cream-hadith-analysis-refutation',
  '/posts/muhammad-peace-be-upon-him-wanted-to-tie-the-devils-demons-and-jinn-to-the-pillars-of-the-mosque': '/posts/the-prophet-صلى-الله-عليه-وسلم-and-the-jinn-at-the-mosque-the-hadith-of-tying-the-devil-explained',
  '/posts/the-noble-messenger-used-to-urinate-while-sitting-is-there-anyone-who-objects': '/posts/the-prophet-صلى-الله-عليه-وسلم-urinating-while-sitting-the-wisdom-the-evidence-and-the-modern-scientific-confirmation',
  '/posts/untitled-1319706865596371084': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/lslam-attitude-towards-non-muslim': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/the-suspicion-of-the-camels-mention-in-the-time-of-joseph-peace-be-upon-him-and-the-miracle': '/posts/the-quran-and-camels-in-josephs-time-a-historical-miracle-not-an-error',
  '/posts/the-danger-of-usury-testimonials-from-non-muslims': '/posts/the-quran-was-right-non-muslim-scholars-economists-us-senate-reports-on-the-harm-of-usury',
  '/posts/the-quranic-miracle-in-mentioning-that-abraham-peace-be-upon-him-is-the-friend-of-god': '/posts/the-quranic-miracle-of-ibrahim-as-khalil-allah-does-abraham-mean-friend-of-the-creator',
  '/posts/quran-n-hail': '/posts/the-qurans-mention-of-hail-and-snow',
  '/posts/response-to-the-evidence-on-the-recurrent-laryngeal-nerve': '/posts/the-recurrent-laryngeal-nerve-is-it-evidence-of-poor-design-a-scientific-rebuttal',
  '/posts/samaritan-error-archeological-error': '/posts/the-samaritan-anachronism-debunked-al-samiri-in-the-quran-and-the-true-origins-of-the-samaritans',
  '/posts/ajwa-dates': '/posts/the-seven-ajwa-dates-does-the-prophet-being-bewitched-disprove-the-hadith',
  '/posts/bond-women-awrah': '/posts/the-slave-girls-awrah-in-islamic-jurisprudence-a-complete-analysis',
  '/posts/women-rights': '/posts/the-status-of-women-among-islamic-jurists',
  '/posts/mutah-pleasure-marriage': '/posts/the-truth-about-mutah-temporary-marriage-permanently-forbidden-in-quran-sunnah-full-evidence',
  '/posts/and-indeed-it-is-expanding': '/posts/the-universe-is-expanding',
  '/posts/he-fabricated-a-lie-against-ibn-abbas-may': '/posts/the-weak-chain-behind-the-claim-that-ikrimah-lied-against-ibn-abbas',
  '/posts/well-of-buda-dawood-67': '/posts/the-well-of-budhaah-hadith-does-islam-permit-ablution-with-filthy-water',
  '/posts/tirmidhi-2861-jinns-zutt-the-prophet': '/posts/the-zutt-and-prophet',
  '/posts/story-of-people-of-zutt-and-prophet': '/posts/the-zutt-and-prophet',
  '/posts/story-of-dhul-qarnayn-was-borrowed-from-syriac-sources': '/posts/was-dhul-qarnayn-borrowed-from-the-alexander-legend-a-refutation-of-the-syriac-source-theory',
  '/posts/is-hajj-a-pagan-ritual-taken-from-hindus': '/posts/was-islamic-hajj-borrowed-from-hinduism-full-refutation-of-the-hindu-ritual-claim',
  '/posts/is-pharaohs-divinity-in-the-quran-taken-from-the-madras': '/posts/was-pharaohs-divinity-in-the-quran-copied-from-the-midrash-a-chronological-refutation',
  '/posts/non-islamic-sources-regarding-the-prophet-muhammads-saw-being-unlettered': '/posts/was-prophet-muhammad-illiterate-non-islamic-sources-on-the-unlettered-prophet',
  '/posts/cave-story-borrowed': '/posts/was-the-cave-of-thawr-story-borrowed-from-saint-felix',
  '/posts/refuting-claims-that-the-quran-was-copied-from-zoroastrian-and-jewish-sources': '/posts/was-the-quran-copied-from-jewish-and-zoroastrian-sources-7-claims-refuted-with-historical-evidence',
  '/posts/either-believe-in-the-trinity-or-be-burned-this-is-how-the-church-spread-the-doctrine-of-the-trinit': '/posts/was-the-trinity-spread-by-proof-or-by-fire-the-story-of-michael-servetus',
  '/posts/condition-of-peoples-and-countries-under-roman-and-persian-rule-before-the-islamic-conquest': '/posts/were-the-islamic-conquests-oppressive-how-rome-and-persia-actually-treated-egypt-syria-and-the-levant',
  '/posts/untitled-1359074889570455562': '/posts/what-has-islam-given-to-the-world',
  '/posts/the-lie-that-the-prophet-ordered-the-sucking-of-genitals': '/posts/what-is-the-meaning-of-until-he-tastes-her-honey-in-the-halala-hadith-refuting-the-oral-sex-allegation-against-the-prophets-hadith',
  '/posts/testimonies-of-non-muslims': '/posts/what-non-muslims-said-about-prophet-muhammad-testimonies-from-historians-scholars',
  '/posts/allah-almighty-gave-good-tidings-to-abraham-peace-be-upon-him-of-a-forbearing-boy-and-in-anothe': '/posts/which-of-abrahams-two-sons-was-the-forbearing-boy-and-which-was-the-knowledgeable-boy',
  '/posts/revelation-of-john-who-wrote-it-and-when-did-it-become-canonical-and-part-of-the-new-testament': '/posts/who-wrote-the-book-of-revelation-the-unknown-author-the-church-has-debated-for-centuries',
  '/posts/and-then-sends-a-prophet': '/posts/why-did-god-leave-people-for-600-years-before-sending-prophet-muhammad',
  '/posts/we-have-killed-the-messiah-jesus-the-son-of-mary-the-messenger-of-god': '/posts/why-did-the-jews-call-jesus-messiah-if-they-didnt-believe-in-him-the-quranic-answer-explained',
  '/posts/why-did-the-quran-mention-the-masculine-word-obedient-when-referring-to-the-wives-of-the-prophet': '/posts/why-did-the-quran-use-masculine-yaqnut-for-the-prophets-wives-full-linguistic-answer',
  '/posts/uthman-ibn-affan-and-the-holy-quran-revisited': '/posts/why-did-uthman-burn-other-quran-copies-the-uthmanic-codex-and-preservation-of-the-quran',
  '/posts/did-god-fail-to-preserve-the-previous-books': '/posts/why-didnt-allah-preserve-the-bible-and-torah-quran-15-9-and-the-trust-given-to-ahl-al-kitab',
  '/posts/circumcision-a-medical-and-legislative-miracle-in-the-final-message': '/posts/why-islam-prescribed-circumcision-modern-medicine-confirms-the-sunnah',
  '/posts/untitled-1319668747341926410': '/posts/women-rights-before-islam',
  '/posts/a-womans-testimony-alone': '/posts/womens-testimony-in-islam-why-two-women-half-a-mind-the-complete-scholarly-analysis-from-ibn-taymiyyah-to-mahmoud-shaltut'
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
      reloadScripts: false, // SwupScriptsPlugin breaks ES module scripts (import X as Y syntax error)
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
      [remarkInternalLinks, { base: isGitHubPages ? '/kufrCleaner/' : '/' }],
      remarkInlineTags,
      remarkObsidianComments, // Remove Obsidian comments (%%...%%) early in processing
      remarkMarginalia,       // Parse {{marginalia}} side notes (⟪...⟫ in .mdx normalized internally)
      remarkAnnotations,      // Parse ::text{type}:: rough-notation annotations
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
      rehypeFigureCaptions,
      [rehypeSlug, {
        test: (node) => node.tagName !== 'h1'
      }],
      rehypeHeadingHighlight,
      [rehypeAutolinkHeadings, {
        behavior: 'append',
        test: (node) => node.tagName !== 'h1',
        properties: {
          'data-role': 'anchor',
          'data-no-swup': '',
          ariaLabel: 'Link to this section',
        },
        content: {
          type: 'element',
          tagName: 'svg',
          properties: {
            xmlns: 'http://www.w3.org/2000/svg',
            width: 16,
            height: 16,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            ariaHidden: 'true',
          },
          children: [
            {
              type: 'element',
              tagName: 'path',
              properties: { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
              children: [],
            },
            {
              type: 'element',
              tagName: 'path',
              properties: { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
              children: [],
            },
          ],
        },
      }],
      rehypeNormalizeAnchors, // Run LAST to ensure className and href fixes aren't overridden
      ...(isGitHubPages ? [[rehypeRebaseLinks, { base: '/kufrCleaner/' }] as any] : []),
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
