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
import pagefind from 'astro-pagefind';
import refreshContentOnChange from './src/integrations/refresh-content-on-change.ts';
import { fileURLToPath } from 'node:url';

// Deployment platform configuration
const DEPLOYMENT_PLATFORM = process.env.DEPLOYMENT_PLATFORM || 'netlify';
const isGitHubPages = DEPLOYMENT_PLATFORM === 'github-pages';

export default defineConfig({
  site: siteConfig.site,
  prefetch: true,
  base: undefined,
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
  '/posts/7-hijab-doubts': '/posts/7-common-doubts-about-the-hijab-and-how-islam-answers-every-one',
  '/posts/abdullah-bin-saad-bin-abi-sarh': '/posts/abdullah-bin-saad-bin-abi-sarh-apostasy-claim-refuted-through-hadith-chains-and-textual-criticism',
  '/posts/story-of-abrahas-elephant-and-how-the-elephant-traveled-in-the-desert-and-can-the-elephant-walk-in': '/posts/abrahas-elephant-can-an-elephant-walk-from-yemen-to-mecca-every-doubt-refuted',
  '/posts/what-is-abrogation': '/posts/abrogation-in-islam-explained-refuting-christian-claims-about-naskh-and-quran-preservation',
  '/posts/a-claim-to-deny-the-hadith-that-abrogates-the-ten-forbidden-breastfeedings-by-five': '/posts/abrogation-of-quranic-verses-understanding-the-ten-and-five-breastfeedings-hadith',
  '/posts/deception-no-5-muhammad-and-abu-hurairah-uncover-the-abdomen-and-kiss-the-navel': '/posts/abu-hurairah-kissing-al-hasans-stomach-hadith-explained',
  '/posts/2026-projects': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/notes-on-prophet-muhammad-in-bible': '/posts/additional-notes-on-prophet-muhammad-in-bible',
  '/posts/ahad-vs-wahid': '/posts/ahad-vs-wahidواحد-vs-أحد-the-arabic-word-that-proves-gods-absolute-oneness-in-surah-al-ikhlas',
  '/posts/final-academic-response-1351212802366242877': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/marriage-with-aisha': '/posts/aisha-marriage-age-historical-evidence-scholarly-sources-refutation',
  '/posts/aishas-jealousy-made-her-wish-to-be-stung-by-a-scorpion-or-a-snake': '/posts/aishas-jealousy-and-love-for-the-prophet-صلى-الله-عليه-وسلم-the-camel-incident-explained',
  '/posts/al-andalus-before-and-after-the-islamic-conquest': '/posts/al-andalus-islamic-civilization-and-the-liberation-from-visigothic-tyranny',
  '/posts/al-buraq': '/posts/al-buraq-and-the-bible-refuting-christian-claims-about-mythical-creatures-in-islam',
  '/posts/shocking-facts-about-the-fatimid-caliph-called-al-hakim-bi-amr-allah-who-persecuted-christians': '/posts/al-hakim-bi-amr-allah-the-fatimid-caliph-who-persecuted-christians-was-not-muslim-his-mother-was-christian-and-he-claimed-to-be-god',
  '/posts/the-doubt-about-al-zuhris-statement-we-were-informed-that-he-had-recited-a-lot-of-the-quran': '/posts/al-zuhris-weak-narration-debunked-no-the-quran-was-never-lost-or-incomplete',
  '/posts/syriac-borrows-the-name-god-from-arabic-according-to-scientific-and-archaeological-evidence': '/posts/allah-is-not-from-syriac-archaeological-proof-the-word-is-originally-arabic',
  '/posts/the-arabs-who-settled-in-the-levant-and-iraq-were-called-syrian-arabs-because-syria-originally-refer': '/posts/arabs-of-the-levant-and-iraq-were-called-syrians-what-ancient-greek-and-roman-sources-actually-say',
  '/posts/differences-in-quranic-manuscripts-advanced': '/posts/are-quranic-manuscript-differences-evidence-of-corruption-a-refutation-of-daniel-brubaker',
  '/posts/who-is-asiya-bint-muzahim-1325166212518383616': '/posts/asiya-bint-muzahim-is-isis-nefert-6-historical-proofs-that-match',
  '/posts/documented-scientific-references': '/posts/authors-of-gospels',
  '/posts/by-sawt-al-haqiqa-ig': '/posts/aw-rah-of-slave-women',
  '/posts/slave-as-second-wife-in-christianity': '/posts/biblical-concubinage-was-not-normal-marriage-jewish-sources-expose-the-claim',
  '/posts/by-islamophobes-nightmare-pdf': '/posts/by-islamophobes-nightmare-pdf-slavery',
  '/posts/camel-pee': '/posts/camel-pee-notes',
  '/posts/with-the-eyes': '/posts/can-believers-see-allah-resolving-the-alleged-contradiction-between-quran-75-22-83-15-and-6-103',
  '/posts/debunking-the-myth-that-life-originated-by-chance-through-serendipitous-chemical-reactions-and-res': '/posts/can-life-arise-by-chance-debunking-abiogenesis-through-logic-and-cell-biology',
  '/posts/circumambulating-the-kaaba': '/posts/circumambulating-the-kaaba-is-paganism-the-bible-answers',
  '/posts/cutting-people-with-knives-and-axes-sawing-them-apart-tearing-them-apart-with-threshing-machin-1327293582695993344': '/posts/davids-massacre-in-2-samuel-12-2931-old-bible-translations-vs-modern-changes',
  '/posts/deficient-in-religion': '/posts/deficient-in-mind-and-religion-hadith-meaning-context-and-full-refutation',
  '/posts/women-are-deficient-in-religio': '/posts/deficient-in-mind-and-religion-hadith-meaning-context-and-full-refutation',
  '/posts/dhul-khulasa-ghazwa': '/posts/dhul-khulasa-ghazwa-dhul-khulasa-hadith-explained-did-the-prophet-order-killing',
  '/posts/the-blind-companion-killed-his-wife-or-female-slave-when-she-insulted-the-prophet': '/posts/did-a-blind-companion-kill-his-wife-for-insulting-the-prophet-complete-hadith-refutation',
  '/posts/t-is-the-hadith-about-a-woman-drinking-the-urine-of-the-prophet-peace-an': '/posts/did-a-woman-drink-the-prophet-muhammads-urine-hadith-authenticity-explained',
  '/posts/his-burning-of-al-fujaah-al-salami': '/posts/did-abu-bakr-burn-al-fujaa-peacefully-the-narrations-are-weak-and-the-context-is-misrepresented',
  '/posts/al-anbiya-98-qiraats-difference': '/posts/did-aisha-and-the-companions-recite-hadhab-jahannam-refuting-a-false-quranic-variant-claim-surah-al-anbiya-verse-98',
  '/posts/deception-no-4-why-is-hassans-character-similar-to-the-character-of-the-messenger-of-god': '/posts/did-al-hasan-resemble-prophet-muhammad-in-physical-strength',
  '/posts/thread-did-early-christians-even-agree-on-what-the-bible-is': '/posts/did-early-christians-even-agree-on-what-the-bible-is',
  '/posts/update-2-0': '/posts/did-gabriel-blow-into-maryams-private-part-refuting-the-crude-misreading-of-surah-at-tahrim-66-12',
  '/posts/abubakr-and-umar-are-among-the-doomed': '/posts/did-ibn-abbas-permit-mutah-why-the-report-refers-to-hajj-tamattu-not-temporary-marriage',
  '/posts/did-abdullah-bin-masoud-deny-the-two-muawwidhat': '/posts/did-ibn-masud-deny-surah-al-falaq-and-surah-an-nas',
  '/posts/responding-to-the-doubt-about-breastfeeding-an-adult-in-detail': '/posts/did-islam-allow-breastfeeding-an-adult-scholarly-refutation-of-the-salim-hadith-misconception',
  '/posts/deception-no-2-a-muslim-man-would-marry-one-of-sahaba-so-that-she-would-spend-on-him': '/posts/did-islam-allow-muslim-men-to-marry-prostitutes-for-money',
  '/posts/arian-heresy-argument': '/posts/did-islam-borrow-from-the-ebionites-and-arians-the-jewish-christian-myth-refuted',
  '/posts/did-jacob-wrestle-with-the-god-of-the-christians-or-did-he-wrestle-with-a-human-being': '/posts/did-jacob-wrestle-with-the-god-of-the-christians-or-with-a-human-being',
  '/posts/the-response-to-christs-claim-is-that-god-creates-from-clay-the-shape-of-a-bird-and-it-becomes-a-b': '/posts/did-jesus-creating-a-bird-from-clay-prove-he-is-god-quran-gospel-scholars-answer',
  '/posts/i-am-the-alpha-and-the-omega-the-beginning-and-the-end': '/posts/did-jesus-say-i-am-the-alpha-and-the-omega-manuscript-evidence-and-contextual-proof',
  '/posts/khalid-bin-al-walid-may-allah-be-pleased-with-him-was-a-cannibal-who': '/posts/did-khalid-ibn-al-walid-commit-cannibalism-refuting-the-slander-full-isnad-analysis-biblical-counter-evidence',
  '/posts/mecca-never-existed': '/posts/did-mecca-exist-before-the-4th-century-historical-evidence-that-proves-it-did',
  '/posts/monkey-adultery': '/posts/did-monkeys-stone-for-zina-refuting-the-sahih-al-bukhari-objection',
  '/posts/contradiction-in-the-quran-as-it-mentions-different-statements-about-the-fire-that-moses-peace-be': '/posts/did-moses-say-different-things-about-the-fire-refuting-the-quran-contradiction-claim',
  '/posts/doubt-about-moses-peace-be-upon-him-throwing-the-tablets': '/posts/did-moses-throwing-the-tablets-disrespect-gods-word-al-araf-150-explained-with-tafsir-bible',
  '/posts/responding-to-the-suspicion-that-embryology-in-the-quran-is-borrowed-from-aristotle-and-hippocrates': '/posts/did-muhammad-copy-embryology-from-greek-science-refuting-the-aristotle-and-hippocrates-claim',
  '/posts/responding-to-the-allegation-did-the-quran-steal-the-word-allah-from-elohim-in-the-jewish-heri': '/posts/did-muslims-steal-allah-from-elohim-a-linguistic-refutation',
  '/posts/abraham-lied': '/posts/did-prophet-abraham-commit-shirk-or-doubt-refuting-quranic-misconceptions-about-ibrahim-صلى-الله-عليه-وسلم',
  '/posts/is-surat-al-fil-borrowed-from-the-poet-rubah-ibn-al-ajaj': '/posts/did-prophet-muhammad-borrow-surah-al-fil-refuting-the-rubah-ibn-al-ajjaj-claim',
  '/posts/muslim-prayer-is-taken-from-the-sumerian-civilization': '/posts/did-prophet-muhammad-copy-prayer-from-sumerians-a-complete-refutation',
  '/posts/deception-no-20-muhammads-denial-of-the-companions-you-do-not-know-what-they-innovated-after-y': '/posts/did-prophet-muhammad-disown-his-companions-hadith-explained',
  '/posts/deception-no-12-the-companions-bad-behavior-towards-the-prophet-may-god-bless-him-and-grant-him': '/posts/did-prophet-muhammad-distribute-spoils-unfairly-at-hunayn',
  '/posts/deception-no-21-some-of-my-friends-do-not-see-me-after-i-leave-them': '/posts/did-prophet-muhammad-say-some-companions-would-not-see-him-again',
  '/posts/response-to-the-allegation-that-the-prophet-defecated-and-ate-without-washing-his-hands-or-touching': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-eat-with-unclean-hands-full-refutation-of-the-christian-polemic',
  '/posts/angels-do-not-enter-the-house-of-the-messenger-of-islam': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-keep-urine-under-his-bed-refuting-the-angel-objection',
  '/posts/bukhari-6982-suicide': '/posts/did-prophet-muhammad-صلى-الله-عليه-وسلم-try-to-commit-suicide-refuting-the-weak-bukhari-addition-az-zuhris-idraj',
  '/posts/myth-of-the-creation-of-adam-and-how-satan-entered-through-his-mouth-and-exited-through-his-anus': '/posts/did-satan-enter-adams-body-refuting-a-weak-israiliyyat-narration-misused-against-islam',
  '/posts/deception-no-16-i-do-not-know-anything-today-of-what-we-were-like-during-the-time-of-the-messeng': '/posts/did-the-companions-change-the-sunnah-after-prophet-muhammad',
  '/posts/deception-no-3-the-companions-come-to-arafat-and-their-penises-drip-with-semen': '/posts/did-the-companions-go-to-arafat-while-dripping-with-semen-hadith-explained',
  '/posts/the-response-to-the-lie-that-the-prophet-peace-and-blessings-be-upon-him-quoted-from-the-monk-bahi': '/posts/did-the-monk-bahira-teach-the-prophet-صلى-الله-عليه-وسلم-the-quran-6-historical-proofs-syriac-forgeries-catholic-encyclopedia-answer',
  '/posts/she-died-so-i-slept-with-her': '/posts/did-the-prophet-lie-with-fatima-bint-asad-in-her-grave-linguistic-and-hadith-refutation-of-the-christian-allegation',
  '/posts/bani-mustaliq': '/posts/did-the-prophet-muhammad-attack-peaceful-people-the-raid-on-banu-al-mustaliq-explained',
  '/posts/historical-evidence-of-the-messenger-of-god-may-god-bless-him-and-grant-him-peace': '/posts/did-the-prophet-muhammad-really-exist-historical-proof-from-coins-inscriptions-and-non-muslim-chronicles',
  '/posts/black-people-steal-when-hungry-is-there-any-racism-in-islam': '/posts/did-the-prophet-say-black-people-steal-when-hungry-a-hadith-refutation',
  '/posts/refuting-the-claim-that-the-prophet-peace-and-blessings-be-upon-him-borrowed-from-jabr-and-yasar': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-learn-from-two-christian-slaves-the-jabr-yasar-accusation-refuted',
  '/posts/killing-of-kinana-bin-al-rabi-bin-abi-al-haqiq': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-order-the-torture-of-kinanah-ibn-al-rabi-a-full-isnad-refutation-of-the-khaybar-slander',
  '/posts/wrestled-with-satan': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-really-wrestle-the-devil-refuting-the-missionary-doubt-with-their-own-bible',
  '/posts/update-2026-1490037128745189496': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-say-anakta-hā-the-maiz-hadith-arabic-usage-and-legal-clarity',
  '/posts/anekatah': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-say-anakta-hā-the-maiz-hadith-arabic-usage-and-legal-clarity',
  '/posts/existence-of-statues-or-pictures-of-jesus-son-of-mary-and-his-mother-in-the-kaaba': '/posts/did-the-prophet-صلى-الله-عليه-وسلم-spare-the-image-of-mary-jesus-in-the-kaaba-al-azraqis-narrations-examined-with-11-authentic-hadiths',
  '/posts/is-the-story-of-luqman-s-advice-to-his-son-transferred': '/posts/did-the-quran-borrow-luqmans-wisdom-from-ahiqar-full-refutation-of-the-claim',
  '/posts/the-quran-borrowed-the-story-of-solomon-and-the-hoopoe-from-targum-esther-ii': '/posts/did-the-quran-borrow-solomons-hoopoe-story-from-targum-sheni',
  '/posts/contradiction-in-the-quran-in-its-mention-of-the-words-of-god-almighty-to-moses-peace-be-upon-him': '/posts/did-the-quran-contradict-itself-about-allah-speaking-to-moses',
  '/posts/story-of-abraham-and-his-father-in-the-quran-was-quoted-from-the-haggadah': '/posts/did-the-quran-copy-abrahams-story-from-the-haggadah-a-complete-refutation-with-historical-evidence',
  '/posts/response-to-the-allegation-that-the-story-of-the-birth-of-christ-was-copied-from-the-apocryphal-go': '/posts/did-the-quran-copy-from-the-apocryphal-gospels-a-complete-refutation-with-academic-sources',
  '/posts/blowing-up-the-talmudic-traditions-in-the-quran': '/posts/did-the-quran-copy-the-talmud-a-complete-refutation-of-the-plagiarism-claim',
  '/posts/doubts-and-responses-to-allegations-of-distortion-of-the-holy-quran': '/posts/did-the-quran-get-distorted-scholarly-refutations-to-8-major-claims-al-hajjaj-ibn-masoud-surat-al-noorayn-more',
  '/posts/sunset': '/posts/did-the-quran-say-the-sun-literally-sets-in-a-muddy-spring-quran-18-86-explained',
  '/posts/the-anomalous-readings-of-ubayd-ikrimah-mujahid-saeed-alqamah-hattan-al-amash': '/posts/do-anomalous-tabiin-readings-disprove-the-qurans-preservation-chain-analysis-birmingham-manuscript-orientalist-testimony',
  '/posts/update-1369578720981155840': '/posts/do-muslims-worship-the-kaaba-the-qibla-accusation-refuted-with-christian-biblical-evidence',
  '/posts/allah-swt-misguides': '/posts/does-allah-misguide-people-quran-16-93-explained-with-tafsir-and-human-free-will',
  '/posts/refuting-the-christians-evidence-of-denying-the-good-news-of-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/prophet-muhammad-in-deuteronomy-18': '/posts/does-deuteronomy-18-18-prophesy-muhammad-the-prophet-like-moses-explained',
  '/posts/a-stupid-suspicion-about-the-hanafi-school-of-thought-the-religion-of-the-prophet-abraham-peace-be': '/posts/does-hanif-mean-pagan-refuting-the-christian-objection-against-abrahams-religion',
  '/posts/book-of-hosea': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/the-name-of-muhammad-in-hosea-96': '/posts/does-hosea-9-6-mention-muhammad-by-name-the-hebrew-word-machmas-explained',
  '/posts/does-isaiah-53-talk-about-the-crucifixion-and-resurrection-of-christ': '/posts/does-isaiah-53-prophesy-jesus-hebrew-and-septuagint-evidence-against-the-christian-claim',
  '/posts/deception-no-31-omar-the-companions-and-the-muslims-curse-the-infidels': '/posts/does-islam-allow-cursing-disbelievers',
  '/posts/the-lie-that-islam-attributes-the-child-of-adultery-to-the-husband': '/posts/does-islam-attribute-adultery-children-to-the-husband-refuting-the-child-belongs-to-the-bed',
  '/posts/a-response-to-the-accursed-enemies-of-religion-who-said-that-islam-permits-bestiality': '/posts/does-islam-permit-bestiality-classical-fiqh-refutation-of-a-false-claim',
  '/posts/bukhari-304-dumb-women': '/posts/does-islam-say-women-are-stupid-refuting-the-deficient-in-intelligence-hadith',
  '/posts/does-the-quran-acknowledge-jacobs-struggle-with-god': '/posts/does-israel-mean-wrestling-with-god-hebrew-lexicon-islamic-tafsir-rabbi-rashi-father-tadros-answer',
  '/posts/and-now-father-glorify-me-in-your-own-presence-with-the-glory-that-was-mine-john-17-5-does-this': '/posts/does-john-17-5-indicate-the-divinity-of-christ',
  '/posts/a-description-of-the-chests-of-the-houris': '/posts/does-kawāʿib-atrāban-mean-sexualized-maidens-refuting-the-surah-an-naba-78-33-claim',
  '/posts/contradiction-in-the-quran-regarding-swearing-by-places-and-times': '/posts/does-la-uqsimu-contradict-quranic-oaths',
  '/posts/does-the-title-lord-mean-the-divinity-of-christ-kyrios-and-the-specifications-of-the-messiah-a': '/posts/does-lord-prove-jesus-is-god-kyrios-explained-from-christian-sources',
  '/posts/nikkah-means-sex': '/posts/does-nikāḥ-mean-sex-in-the-quran-refuting-the-claim-with-arabic-and-quranic-usage',
  '/posts/surah-ahzab-53': '/posts/does-quran-33-53-prove-the-prophet-made-up-revelation',
  '/posts/trinity-exist-in-islam': '/posts/does-the-christian-trinity-exist-in-islam-a-complete-refutation',
  '/posts/the-response-to-the-doubt-and-he-made-the-moon-a-light-in-them': '/posts/does-the-moon-light-up-all-seven-heavens-surah-nuh-71-1516-explained-with-tafsir-arabic-grammar',
  '/posts/27-linguistic-errors-in-the-holy-quran': '/posts/does-the-quran-have-arabic-grammar-mistakes-every-objection-answered',
  '/posts/word-of-god-and-spirit-of-god': '/posts/does-the-quran-prove-jesus-is-god-the-word-of-god-missionary-deception-exposed',
  '/posts/distortion-of-the-text-of-ephesians-3-9-who-created-all-things-through-jesus-christ': '/posts/ephesians-3-9-exposed-how-through-jesus-christ-was-added-to-the-bible',
  '/posts/immortal-boys-youth': '/posts/eternal-youths-in-paradise-explained-refuting-the-false-claim-about-quran-76-19',
  '/posts/even-if-he-committed-adultery-and-even-if-he-stole': '/posts/even-if-he-committed-adultery-and-even-if-he-stole-does-islam-permit-major-sins',
  '/posts/deception-no-24-after-me-there-will-be-imams-who-will-not-be-guided-by-my-guidance-or-my-sunnah': '/posts/future-corrupt-rulers-in-sahih-muslim-hadith-explained',
  '/posts/embroyoloy': '/posts/hadith-of-42-nights-embryology-sex-differentiation-and-organ-formation-explained',
  '/posts/a-collection-of-historical-and-geographical-errors-in-the-gospel-of-mark-quote-from-the-book-of-sai': '/posts/historical-and-geographical-errors-in-the-gospel-of-mark-ninehams-evidence-explained',
  '/posts/has-science-proven-the-impossibility-of-diversification-from-two-pairs': '/posts/hla-gene-diversity-and-adam-eve-does-science-disprove-a-two-person-bottleneck',
  '/posts/abu-bakrs-method-in-collecting-the-quran': '/posts/how-abu-bakr-collected-the-quran-the-strict-method-that-preserved-the-mushaf',
  '/posts/the-response-to-the-doubt-about-how-god-created-every-animal-and-every-living-thing-from-water-whil': '/posts/how-can-allah-create-everything-from-water-if-jinn-were-created-from-fire-a-complete-response',
  '/posts/the-response-to-the-doubt-about-the-ant-conversation-with-solomon': '/posts/how-did-the-ant-speak-in-surah-an-naml-science-arabic-linguistics-biblical-parallels',
  '/posts/conditions-of-the-peoples-of-the-sasanian-empire-before-and-after-the-islamic-conquest': '/posts/how-islam-liberated-persia-from-sasanian-oppression-and-built-a-civilization',
  '/posts/angels-in-surah-al-imran-mary': '/posts/how-many-angels-gave-mary-glad-tidings-refuting-the-quran-contradiction-claim-2',
  '/posts/the-contradiction-in-the-number-of-angels-in-the-battle-of-badr': '/posts/how-many-angels-were-at-badr-resolving-the-1000-vs-3000-vs-5000-doubt-quran-tafsir-bible',
  '/posts/a-distortion-to-obliterate-the-good-tidings-on-the-tongue-of-christ': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/john-7-52-the-prophet-of-end-times': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/distortions-in-gospel-of-john-to-obliterate-the-prophecy-on-the-tongue-of-jesus': '/posts/how-scribes-removed-muhammads-prophecies-from-the-gospel-of-john',
  '/posts/doubts-about-the-compilation-of-the-holy-quran': '/posts/how-was-the-quran-compiled-dots-diacritics-the-two-collections-doubts-answered',
  '/posts/falsifying-the-genetic-similarity-between-humans-and-apes': '/posts/human-ape-dna-similarity-refuted-the-988-genetic-similarity-claim-examined',
  '/posts/distortion-of-the-word-samad-in-the-editions-of-ibn-kathirs-interpretation-or-vice-versa': '/posts/ibn-kathir-and-samad-refuting-the-claim-that-allahs-name-came-from-an-idol',
  '/posts/abraham-lied-1325421805514784820': '/posts/ibrahim-only-told-three-lies-what-did-the-prophet-صلى-الله-عليه-وسلم-mean-al-nawawi-ibn-al-jawzi-al-razi-explained',
  '/posts/if-jesus-is-god-because-he-forgave-sins-then-let-the-christian-worship-the-jewish-priest-because-he': '/posts/if-jesus-forgave-sins-does-that-prove-he-is-god-a-biblical-refutation',
  '/posts/a-day-with-god-a-thousand-years-or-50-thousand-years': '/posts/is-a-day-with-allah-1000-or-50000-years-refuting-the-quran-contradiction-claim',
  '/posts/a-womans-voice-is-shameful': '/posts/is-a-womans-voice-awrah-what-islam-actually-says-vs-what-the-bible-says',
  '/posts/moon-god': '/posts/is-allah-a-moon-god-the-claim-debunked-and-why-yahweh-has-a-bigger-problem',
  '/posts/david-is-also-the-christ-the-son-of-god-the-forgotten-fourth-divine-person': '/posts/is-david-also-the-christ-and-son-of-god-a-biblical-challenge-to-christian-title-based-divinity-claims',
  '/posts/s-jizyah-usury-refuting-the-quranic-contradiction-claim': '/posts/is-jizyah-usury-refuting-the-quranic-contradiction-claim',
  '/posts/is-the-prophet-descended-from-the-prostitute-and-fallen-grandmother-of-jesus-tamar': '/posts/is-prophet-muhammad-صلى-الله-عليه-وسلم-descended-from-tamar-refuting-the-zerah-genealogy-claim',
  '/posts/response-to-christan-lies': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/response-to-christan-lies-on-geneology-of-prophet': '/posts/is-prophet-muhammads-lineage-pure-responding-to-christian-missionary-claims-with-classical-evidence',
  '/posts/desire-of-nations': '/posts/is-the-desire-of-all-nations-in-haggai-2-7-a-prophecy-about-muhammad-the-hebrew-hmd-explained',
  '/posts/hadith-about-the-age-of-flies': '/posts/is-the-hadith-about-the-flys-lifespan-being-40-nights-authentic-full-isnad-analysis-scientific-proof',
  '/posts/is-the-word-waqi-distorted-in-the-quran-why-is-there-no-extension-of-the-alif-in-some-words-in': '/posts/is-the-word-wāqi-distorted-in-the-quran-the-truth-about-alif-in-ancient-manuscripts',
  '/posts/surah-nisa-34-domestic-abuse-quran-434': '/posts/islam-and-wife-beating-classical-scholars-on-quran-4-34-and-its-strict-limits',
  '/posts/captives-of-awtas': '/posts/islamic-rules-of-war-captives-the-rape-accusation-a-complete-refutation',
  '/posts/john-3-13': '/posts/john-3-13-who-is-in-heaven-a-divinity-proof-text-absent-from-the-two-oldest-papyri-sinaiticus-and-vaticanus',
  '/posts/the-story-of-the-angel-in-the-sinaiticus-manuscript-and-the-papal-lie-in-response-to-pope-shenouda': '/posts/john-5-34-and-the-angel-at-bethesda-missing-from-the-oldest-bible-manuscripts',
  '/posts/distortion-of-the-text-of-the-angel-of-blessing': '/posts/john-5-4-is-not-in-the-bible-manuscript-evidence-exposes-a-major-new-testament-distortion',
  '/posts/a-scribe-of-a-12th-century-new-testament-manuscript-added-a-proverb-to-the-text-because-it-fit-the-t': '/posts/john-7-4-a-12th-century-scribe-added-a-proverb-to-the-new-testament-text',
  '/posts/corruption-of-the-gospel-of-john-9-35': '/posts/john-9-35-son-of-man-or-son-of-god-how-one-word-change-turned-a-prophecy-verse-into-a-divinity-claim',
  '/posts/the-problem-of-distorting-luke-1-28': '/posts/luke-1-28-blessed-are-you-among-women-a-later-scribal-addition-rejected-by-all-major-critical-editions',
  '/posts/the-distortion-of-luke-1-28-blessed-are-you-among-women': '/posts/luke-1-28-blessed-are-you-among-women-a-later-scribal-addition-rejected-by-all-major-critical-editions',
  '/posts/distortion-of-the-text-of-luke-23-34-father-forgive-them-for-they-do-not-know-what-they-do': '/posts/luke-23-34-father-forgive-them-absent-from-oldest-manuscripts-and-bracketed-by-all-critical-editions',
  '/posts/the-distortion-of-luke-23-34-father-forgive-them': '/posts/luke-23-34-father-forgive-them-absent-from-oldest-manuscripts-and-bracketed-by-all-critical-editions',
  '/posts/the-distortion-of-luke-23-45-eclipse-or-darkness': '/posts/luke-23-45-eclipse-or-darkness-how-scribes-changed-the-original-greek-word-to-hide-an-astronomical-problem',
  '/posts/why-does-the-quran-describe-birds-as-speaking': '/posts/mantiq-al-tayr-did-the-quran-misuse-the-word-for-speech-the-linguistic-doubt-refuted',
  '/posts/marginalia': '/posts/marginalia-test',
  '/posts/mar-7-16-mark-9-44-mark-9-46': '/posts/mark-7-16-and-mark-9-44-46-verses-deleted-from-the-oldest-manuscripts-and-absent-from-all-critical-editions',
  '/posts/distortion-of-the-text-of-matthew-17-21': '/posts/matthew-17-21-prayer-and-fasting-entire-verse-absent-from-sinaiticus-vaticanus-and-all-major-critical-editions',
  '/posts/when-an-accidental-error-is-more-serious-than-a-deliberate-distortion-the-problem-of-matthew-27-35': '/posts/matthew-27-35-prophecy-fulfillment-addition-absent-from-the-five-most-important-manuscripts-and-rejected-by-all-critical-editions',
  '/posts/untitled-1319706055076220939': '/posts/mercy-of-prophet-muhammad',
  '/posts/the-prophet-as-mercy-towards-humanity': '/posts/mercy-of-prophet-muhammad',
  '/posts/mirza-ghulams-kufr': '/posts/mirza-ghulam-qadianis-blasphemy-in-his-own-words-kufr-false-prophethood-and-the-qadiani-claim-exposed',
  '/posts/moon-split': '/posts/moon-split-miracle-nasa-mayan-and-indian-evidence-that-critics-ignore',
  '/posts/deception-no-7-you-want-to-be-castrated-or-practice-temporary-marriage': '/posts/mutah-in-islam-was-temporary-marriage-later-forbidden',
  '/posts/as-for-my-cousin-he-violated-my-honor': '/posts/my-honor-was-violated-does-the-hadith-mean-the-prophet-صلى-الله-عليه-وسلم-was-assaulted',
  '/posts/a-clear-contradiction-in-hadith-with-quran': '/posts/no-contradiction-entering-paradise-by-deeds-and-allahs-mercy-in-quran-and-hadith',
  '/posts/a-muslim-shall-not-be-killed-for-killing-an-infidel': '/posts/no-muslim-killed-for-an-infidel-what-the-hadith-actually-means-and-what-critics-deliberately-ignore',
  '/posts/why-does-god-swear-by-his-creatures-and-not-by-his-divine-self': '/posts/oaths-in-the-quran-why-does-allah-swear-by-his-creation-the-eloquence-and-purpose-explained',
  '/posts/prophecies-of-the-end-time-b-prophet': '/posts/prophecies',
  '/posts/prophcies': '/posts/prophecies',
  '/posts/dt-33-2': '/posts/prophecy-in-deuteronomy-332',
  '/posts/bukhari-4428-poisoned': '/posts/prophet-muhammad-صلى-الله-عليه-وسلم-die-as-a-false-prophet-refuting-the-poison-and-aorta-arguments',
  '/posts/revision': '/posts/prophets-doubt-in-islam-what-does-yunus-94-really-mean',
  '/posts/psalms-120': '/posts/psalm-120-in-the-tents-of-kedar-and-the-meccan-persecution',
  '/posts/psalm-144-is-missing-6-paragraphs-is-this-a-distortion-or-not': '/posts/psalm-144-in-codex-sinaiticus-missing-verses-or-psalm-numbering-confusion',
  '/posts/as-if-it-is-ascending-to-the-sky': '/posts/quran-6-125-refutes-the-doubt-does-ascending-into-the-sky-really-mean-rising-upward',
  '/posts/31-common-contradiction-in-quran-refuted': '/posts/quran-contradictions-debunked-days-of-creation-intercession-alcohol-and-more',
  '/posts/bukhari-4557': '/posts/refuting-the-chains-around-their-necks-misinterpretation-in-sahih-al-bukhari-4557',
  '/posts/update-2026-1468269937515823264': '/posts/refuting-the-dirham-anachronism-how-the-quran-accurately-describes-ancient-currency',
  '/posts/why-is-there-repetition-in-quran': '/posts/repetition-in-the-quran-weakness-or-eloquence-a-complete-refutation',
  '/posts/bukhari-4697': '/posts/sahih-al-bukhari-4697-explained-context-and-correct-understanding',
  '/posts/deception-no-25-you-will-follow-the-ways-of-those-before-you-inch-by-inch': '/posts/sahih-bukhari-3197-following-previous-nations-explained',
  '/posts/deception-no-29-he-rudely-replies-to-muhammad-that-he-is-not-crazy': '/posts/sahih-bukhari-6115-anger-and-seeking-refuge-from-satan',
  '/posts/finally-saint-cyril-the-great-solved-the-problem-of-the-christians-orders-to-slaughter-infants-and': '/posts/saint-cyril-on-killing-children-the-biblical-problem-christians-cannot-escape',
  '/posts/inquiry-about-selling-the-mother-of-a-child-and-marrying-a-chaste-right-hand-slave-hadiths': '/posts/selling-umm-al-walad-sex-with-captives-and-khalid-ibn-al-walid-answering-three-major-misconceptions-about-islam',
  '/posts/slavery-and-concubinage-endorsed-by-the-bible-1354004700260733043': '/posts/slavery-concubines-and-war-captives-in-the-bible-the-christian-double-standard',
  '/posts/slavery-quick-version': '/posts/slavery-in-islam-islamic-law-vs-western-systems-explained',
  '/posts/from-islamophobes-nightmare-pdf': '/posts/slavery-in-islam-islamophobes',
  '/posts/slavery': '/posts/slavery-resources-only',
  '/posts/update-v2-0': '/posts/slavery-resources',
  '/posts/more-questions-asked-about-it-summary-of-debate': '/posts/surah-al-rum-prophecy-refuted-answering-the-badr-hadith-and-ghalabat-reading-doubt',
  '/posts/so-today-we-will-save-you-with-your-body-that-you-may-be-a-sign-to-those-who-come-after-you': '/posts/surah-yunus-92-and-the-mummy-of-ramses-ii-marine-sand-broken-bones-and-the-sign-that-endures',
  '/posts/a-woman-comes-in-the-form-of-a-devil': '/posts/tabarruj-in-islam-what-the-quran-hadith-and-classical-scholars-say-about-womens-modesty',
  '/posts/responding-to-the-allegation-of-similarity-between-the-birth-of-mithras-and-the-prophet-isa-peace': '/posts/the-birth-of-mithras-vs-the-birth-of-jesus-in-the-quran-a-refutation-of-the-similarity-claim',
  '/posts/age-argument-omar': '/posts/the-covenant-of-umar-explained-refuting-christian-polemics-against-islam',
  '/posts/muslim-2361': '/posts/the-date-palm-pollination-hadith-scholarly-positions',
  '/posts/where-is-the-rest-of-surat-al-ahzab': '/posts/the-doubt-about-the-missing-verses-of-surah-al-ahzab-a-full-response',
  '/posts/as-an-example-who-wrote-it-in-response-to-the-theological-defense-team': '/posts/the-epistle-to-the-hebrews-who-wrote-it',
  '/posts/20-evidences-that-lie-the-story': '/posts/the-false-attribution-of-the-story-of-david-and-uriahs-wife-to-the-quran',
  '/posts/then-bite-him-with-them-his-father-and-do-not-use-euphemisms-and-did-the-prophet-command-that-some': '/posts/the-fathers-penis-hadith-why-its-weak-misread-mistranslated-a-complete-response',
  '/posts/genealogy-of-muhammad': '/posts/the-genealogy-of-prophet-muhammad-صلى-الله-عليه-وسلم-from-ishmael-to-the-final-prophet',
  '/posts/the-writer-of-the-gospel-of-luke-the-unknown-person-condition-time-and-place-wrote-his-gospe': '/posts/the-gospel-of-luke-unknown-author-human-sources-and-late-dating-problems',
  '/posts/the-weak-one-who-has-no-support': '/posts/the-hadith-of-the-people-of-paradise-and-hell-meaning-of-zabr',
  '/posts/deception-no-15-men-who-extinguish-the-sunnah-and-create-innovation': '/posts/the-hadith-of-unjust-rulers-delaying-prayer-explained',
  '/posts/update-1340752533714501730': '/posts/the-hadith-on-gender-determination-a-scientific-analysis',
  '/posts/deception-no-10-the-companions-who-tried-to-kill-him-pbuh': '/posts/the-hypocrites-who-plotted-against-prophet-muhammad-after-tabuk',
  '/posts/aisha-broke-plates': '/posts/the-prophet-صلى-الله-عليه-وسلم-aishas-jealousy-and-the-bowl-incident-refuting-claims-of-lust-and-misconduct',
  '/posts/messenger-applied-light-and-turned-his-pubic-hair-with-his-hand': '/posts/the-prophet-صلى-الله-عليه-وسلم-and-depilatory-cream-hadith-analysis-refutation',
  '/posts/muhammad-peace-be-upon-him-wanted-to-tie-the-devils-demons-and-jinn-to-the-pillars-of-the-mosque': '/posts/the-prophet-صلى-الله-عليه-وسلم-and-the-jinn-at-the-mosque-the-hadith-of-tying-the-devil-explained',
  '/posts/the-noble-messenger-used-to-urinate-while-sitting-is-there-anyone-who-objects': '/posts/the-prophet-صلى-الله-عليه-وسلم-urinating-while-sitting-the-wisdom-the-evidence-and-the-modern-scientific-confirmation',
  '/posts/untitled-1319706865596371084': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/lslam-attitude-towards-non-muslim': '/posts/the-prophets-mercy-how-islam-treats-people-of-other-faiths',
  '/posts/the-suspicion-of-the-camels-mention-in-the-time-of-joseph-peace-be-upon-him-and-the-miracle': '/posts/the-quran-and-camels-in-josephs-time-a-historical-miracle-not-an-error',
  '/posts/the-danger-of-usury-testimonials-from-non-muslims': '/posts/the-quran-was-right-non-muslim-scholars-economists-us-senate-reports-on-the-harm-of-usury',
  '/posts/quran-n-hail': '/posts/the-qurans-mention-of-hail-and-snow',
  '/posts/response-to-the-evidence-on-the-recurrent-laryngeal-nerve': '/posts/the-recurrent-laryngeal-nerve-is-it-evidence-of-poor-design-a-scientific-rebuttal',
  '/posts/samaritan-error-archeological-error': '/posts/the-samaritan-anachronism-debunked-al-samiri-in-the-quran-and-the-true-origins-of-the-samaritans',
  '/posts/ajwa-dates': '/posts/the-seven-ajwa-dates-does-the-prophet-being-bewitched-disprove-the-hadith',
  '/posts/who-is-speaking-in-surat-al-fatihah': '/posts/the-shift-from-third-person-to-second-person-in-surah-al-fatihah-linguistic-error-or-rhetorical-mastery',
  '/posts/bond-women-awrah': '/posts/the-slave-girls-awrah-in-islamic-jurisprudence-a-complete-analysis',
  '/posts/women-rights': '/posts/the-status-of-women-among-islamic-jurists',
  '/posts/beginners-guide-to-hadeeth-sunnah': '/posts/the-sunnah-and-hadith-meaning-importance-and-preservation',
  '/posts/and-we-decreed-to-the-children-of-israel-in-the-scripture-you-will-surely-cause-corruption-on-the': '/posts/the-testament-of-moses-prophecy-did-it-predict-prophet-muhammad-صلى-الله-عليه-وسلمs-birth',
  '/posts/mutah-pleasure-marriage': '/posts/the-truth-about-mutah-temporary-marriage-permanently-forbidden-in-quran-sunnah-full-evidence',
  '/posts/he-fabricated-a-lie-against-ibn-abbas-may': '/posts/the-weak-chain-behind-the-claim-that-ikrimah-lied-against-ibn-abbas',
  '/posts/well-of-buda-dawood-67': '/posts/the-well-of-budhaah-hadith-does-islam-permit-ablution-with-filthy-water',
  '/posts/deception-no-11-there-are-12-hypocrites-among-my-companions': '/posts/twelve-hypocrites-vs-the-sahabah-a-refutation',
  '/posts/bukhari-2771': '/posts/understanding-the-hadith-of-the-man-accused-with-mariyah-bukhari-2771',
  '/posts/story-of-dhul-qarnayn-was-borrowed-from-syriac-sources': '/posts/was-dhul-qarnayn-borrowed-from-the-alexander-legend-a-refutation-of-the-syriac-source-theory',
  '/posts/is-hajj-a-pagan-ritual-taken-from-hindus': '/posts/was-islamic-hajj-borrowed-from-hinduism-full-refutation-of-the-hindu-ritual-claim',
  '/posts/is-pharaohs-divinity-in-the-quran-taken-from-the-madras': '/posts/was-pharaohs-divinity-in-the-quran-copied-from-the-midrash-a-chronological-refutation',
  '/posts/non-islamic-sources-regarding-the-prophet-muhammads-saw-being-unlettered': '/posts/was-prophet-muhammad-illiterate-non-islamic-sources-on-the-unlettered-prophet',
  '/posts/cave-story-borrowed': '/posts/was-the-cave-of-thawr-story-borrowed-from-saint-felix',
  '/posts/you-follow-none-but-a-man-bewitched-al-isra-47-negate-or-confirm-the-prophets-bewitchment': '/posts/was-the-prophet-صلى-الله-عليه-وسلم-really-bewitched-refuting-the-quran-hadith-contradiction-claim',
  '/posts/refuting-claims-that-the-quran-was-copied-from-zoroastrian-and-jewish-sources': '/posts/was-the-quran-copied-from-jewish-and-zoroastrian-sources-7-claims-refuted-with-historical-evidence',
  '/posts/either-believe-in-the-trinity-or-be-burned-this-is-how-the-church-spread-the-doctrine-of-the-trinit': '/posts/was-the-trinity-spread-by-proof-or-by-fire-the-story-of-michael-servetus',
  '/posts/update-1342464262139809902': '/posts/were-the-bones-created-first-or-the-flesh',
  '/posts/condition-of-peoples-and-countries-under-roman-and-persian-rule-before-the-islamic-conquest': '/posts/were-the-islamic-conquests-oppressive-how-rome-and-persia-actually-treated-egypt-syria-and-the-levant',
  '/posts/the-lie-that-the-prophet-ordered-the-sucking-of-genitals': '/posts/what-is-the-meaning-of-until-he-tastes-her-honey-in-the-halala-hadith-refuting-the-oral-sex-allegation-against-the-prophets-hadith',
  '/posts/testimonies-of-non-muslims': '/posts/what-non-muslims-said-about-prophet-muhammad-testimonies-from-historians-scholars',
  '/posts/allah-almighty-gave-good-tidings-to-abraham-peace-be-upon-him-of-a-forbearing-boy-and-in-anothe': '/posts/which-of-abrahams-two-sons-was-the-forbearing-boy-and-which-was-the-knowledgeable-boy',
  '/posts/burning-of-the-library-of-alexandria': '/posts/who-really-destroyed-the-library-of-alexandria-the-myth-against-muslims-exposed',
  '/posts/who-was-the-first-muslim-abraham-moses-or-the-magicians-quranic-contradiction-refuted': '/posts/who-was-the-first-muslim-refuting-the-quranic-contradiction-claim',
  '/posts/revelation-of-john-who-wrote-it-and-when-did-it-become-canonical-and-part-of-the-new-testament': '/posts/who-wrote-the-book-of-revelation-the-unknown-author-the-church-has-debated-for-centuries',
  '/posts/why-did-god-create-pigs-and-then-forbid-them-the-importance-of-harmful-and-harmful-animals': '/posts/why-did-god-create-pigs-if-theyre-forbidden-the-hidden-purpose-of-harmful-animals-in-islam',
  '/posts/and-then-sends-a-prophet': '/posts/why-did-god-leave-people-for-600-years-before-sending-prophet-muhammad',
  '/posts/anektaha': '/posts/why-did-prophet-muhammad-صلى-الله-عليه-وسلم-say-أنكتها-anektha-in-sahih-bukhari-a-linguistic-and-legal-refutation',
  '/posts/we-have-killed-the-messiah-jesus-the-son-of-mary-the-messenger-of-god': '/posts/why-did-the-jews-call-jesus-messiah-if-they-didnt-believe-in-him-the-quranic-answer-explained',
  '/posts/why-did-the-quran-mention-the-masculine-word-obedient-when-referring-to-the-wives-of-the-prophet': '/posts/why-did-the-quran-use-masculine-yaqnut-for-the-prophets-wives-full-linguistic-answer',
  '/posts/uthman-ibn-affan-and-the-holy-quran-revisited': '/posts/why-did-uthman-burn-other-quran-copies-the-uthmanic-codex-and-preservation-of-the-quran',
  '/posts/did-god-fail-to-preserve-the-previous-books': '/posts/why-didnt-allah-preserve-the-bible-and-torah-quran-15-9-and-the-trust-given-to-ahl-al-kitab',
  '/posts/circumcision-a-medical-and-legislative-miracle-in-the-final-message': '/posts/why-islam-prescribed-circumcision-modern-medicine-confirms-the-sunnah',
  '/posts/why-was-the-quran-not-compiled-during-the-era-of-the-prophet': '/posts/why-was-the-quran-not-compiled-during-the-prophets-lifetime-the-doubt-answered',
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
    pagefind(),
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
      [remarkInternalLinks, { base: '/' }],
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
        '@/config': fileURLToPath(new URL('./src/config.ts', import.meta.url)),
        '@/graph':  fileURLToPath(new URL('./src/graph', import.meta.url))
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
      exclude: ['astro:content'],
      include: ['d3-force', 'rough-notation']
    },
    exclude: ['**/_redirects']
  },
  build: {
    assets: '_assets'
  }
});
