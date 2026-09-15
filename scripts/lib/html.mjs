// HTML layout, shared blocks and JSON-LD. Plain template strings; every
// dynamic value goes through esc().

import { ORIGIN, SITE_URL, SITE, AUTHOR, ORG, HUB, siblingsFor, TOOLS, CATEGORY_SLUG, CATEGORIES } from './site.mjs';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const url = (path = '') => `${SITE_URL}${path || '/'}`;
export const href = (path = '') => path || '/';

// ---------------------------------------------------------------------------
// Icons (24×24 stroke) for server-rendered markup

const ICONS = {
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  weight: 'M6 8h12l2 12H4zM9 8a3 3 0 1 1 6 0',
  beaker: 'M9 3h6M10 3v6L4 20h16L14 9V3M7 15h10',
  thermo: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0zM12 9v7',
  area: 'M4 4h16v16H4zM4 12h16M12 4v16',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M4 16h2M18 16h2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  disk: 'M4 5h16v14H4zM4 10h16M8 15h.01',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01',
  tire: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  arrow: 'M4 12h14M13 6l6 6-6 6',
  angle: 'M4 20h16M4 20 16 6M9 20a6 6 0 0 0-1.5-4',
  wave: 'M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-3 5-3',
  fuel: 'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M4 11h11M15 8l3 3v7a1.5 1.5 0 0 0 3 0V9l-3-3',
  cube: 'M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10',
  wrench: 'M14 7a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z',
  rocket: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a12 12 0 0 1 11-8 12 12 0 0 1-8 11l-3 1-1-1z',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01',
  coins: 'M9 13a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15.5 10.5a6 6 0 1 1-5 9.5M8 5v4M7 7h2',
  chain: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  whisk: 'M12 21v-6M9 3c-2 4-1 9 3 12 4-3 5-8 3-12M12 3v12',
  hash: 'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  auto: 'M12 21a9 9 0 1 0 0-18v18zM12 3a9 9 0 0 1 0 18',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  external: 'M14 4h6v6M20 4 10 14M18 14v6H4V6h6',
};

export function svgIcon(name, size = 20, cls = '') {
  const d = ICONS[name] ?? ICONS.arrow;
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

export const MARK = `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="16" fill="var(--accent)"/><g fill="none" stroke="var(--accent-ink)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 24h32M39 16l8 8-8 8M49 40H17M25 32l-8 8 8 8"/></g><g stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round" opacity=".55"><path d="M22 24v4M29 24v4M36 24v4"/></g></svg>`;

// ---------------------------------------------------------------------------
// JSON-LD

const orgNode = () => ({
  '@type': 'Organization',
  '@id': ORG.id,
  name: ORG.name,
  alternateName: ORG.short,
  url: ORG.url,
  description: ORG.description,
  slogan: ORG.tagline,
  founder: { '@id': AUTHOR.id },
  sameAs: [ORG.url, HUB.url],
});

const personNode = () => ({
  '@type': 'Person',
  '@id': AUTHOR.id,
  name: AUTHOR.name,
  url: AUTHOR.url,
  jobTitle: AUTHOR.jobTitle,
  description: AUTHOR.bio,
  worksFor: { '@id': ORG.id },
  sameAs: [AUTHOR.url, AUTHOR.x],
  knowsAbout: ['Frontend engineering', 'Progressive web apps', 'Web3', 'Chrome extensions', 'Web analytics'],
});

const hubNode = () => ({
  '@type': 'WebSite',
  '@id': HUB.id,
  url: `${HUB.url}/`,
  name: HUB.name,
  alternateName: 'Lowkey Tools',
  publisher: { '@id': ORG.id },
  inLanguage: 'en',
});

const siteNode = () => ({
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: url(),
  name: SITE.name,
  description: SITE.description,
  publisher: { '@id': ORG.id },
  creator: { '@id': AUTHOR.id },
  isPartOf: { '@id': HUB.id },
  inLanguage: 'en',
});

export function appNode(buildDate) {
  return {
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#app`,
    name: SITE.name,
    alternateName: ['Convert Easy', 'ConvertEasy by OwlEye', 'lowkey.tools ConvertEasy'],
    url: url(),
    description: SITE.description,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Unit converter',
    operatingSystem: 'Any modern web browser (iOS, Android, macOS, Windows, Linux)',
    browserRequirements: 'Requires JavaScript. Installable as a progressive web app.',
    softwareVersion: SITE.version,
    datePublished: SITE.launched,
    dateModified: buildDate,
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    image: `${SITE_URL}/icons/og.png`,
    screenshot: `${SITE_URL}/icons/og.png`,
    featureList: [
      'Smart calculator that understands units: 1 cm + 1 m = 1.01 m',
      'Context-aware suggestions for units and operators as you type',
      '20 unit categories and 200+ units, including temperature, data and fuel economy',
      'Live currency rates for 150+ fiat currencies and 40+ cryptocurrencies',
      'Fiat to crypto and crypto to fiat conversion',
      'Exact crypto denominations: ETH, gwei, wei, BTC, sats, USDC base units, custom decimals',
      'Days between dates, add or subtract dates, Unix timestamps, time zones',
      'Cups to grams for 20+ baking ingredients',
      'Binary, octal, decimal, hexadecimal and Roman numerals',
      'Works offline and installs to the home screen',
      'No account, no cookies, no adverts',
    ],
    author: { '@id': AUTHOR.id },
    creator: { '@id': AUTHOR.id },
    maintainer: { '@id': AUTHOR.id },
    publisher: { '@id': ORG.id },
    provider: { '@id': ORG.id },
    copyrightHolder: { '@id': ORG.id },
    isPartOf: { '@id': HUB.id },
  };
}

/**
 * Build the page's JSON-LD graph.
 * @param {object} p page definition
 */
export function jsonld(p, buildDate) {
  const pageUrl = url(p.path);
  const graph = [
    {
      '@type': p.pageType ?? 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: p.title,
      headline: p.h1Text ?? p.title,
      description: p.description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: p.about ?? { '@id': `${SITE_URL}/#app` },
      mainEntity: p.faq?.length && p.faqMain ? { '@id': `${pageUrl}#faq` } : { '@id': `${SITE_URL}/#app` },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/icons/og.png`, width: 1200, height: 630 },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      datePublished: SITE.launched,
      dateModified: buildDate,
      author: { '@id': AUTHOR.id },
      publisher: { '@id': ORG.id },
      copyrightHolder: { '@id': ORG.id },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.answer'] },
      potentialAction: [{ '@type': 'UseAction', target: pageUrl, name: p.h1Text ?? p.title }],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: crumbs(p).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    },
    appNode(buildDate),
    orgNode(),
    personNode(),
    siteNode(),
    hubNode(),
  ];
  if (p.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      isPartOf: { '@id': `${pageUrl}#webpage` },
      mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) } })),
    });
  }
  if (p.howto) {
    graph.push({
      '@type': 'HowTo',
      '@id': `${pageUrl}#howto`,
      name: p.howto.name,
      description: p.howto.description,
      totalTime: 'PT1M',
      tool: { '@type': 'HowToTool', name: SITE.name },
      step: p.howto.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${pageUrl}#tool` })),
    });
  }
  if (p.definedTerms?.length) {
    graph.push({
      '@type': 'DefinedTermSet',
      '@id': `${pageUrl}#terms`,
      name: `${p.h1Text} units`,
      hasDefinedTerm: p.definedTerms.map((t) => ({ '@type': 'DefinedTerm', name: t.name, termCode: t.code, description: t.desc })),
    });
  }
  if (p.extraLd) graph.push(...p.extraLd);
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

export function stripTags(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function crumbs(p) {
  const list = [
    { name: 'lowkey.tools', url: `${ORIGIN}/` },
    { name: SITE.name, url: url() },
  ];
  for (const c of p.crumbs ?? []) list.push({ name: c.name, url: url(c.path) });
  return list;
}

// ---------------------------------------------------------------------------
// Blocks

function header(p) {
  const active = p.navActive;
  return `<header class="top">
  <div class="top-inner">
    <a class="brand" href="${href('')}" aria-label="${SITE.name} home">${MARK}<span>Convert<b>Easy</b></span></a>
    <nav class="nav" aria-label="Converters">
      ${TOOLS.map((t) => `<a href="${href(t.path)}"${active === t.id ? ' aria-current="page"' : ''}>${esc(t.nav)}</a>`).join('\n      ')}
    </nav>
    <div class="top-actions">
      <span class="offline-flag" role="status">Offline</span>
      <button type="button" class="search-btn" data-search aria-label="Search converters">${svgIcon('search', 16)}<span>Search</span><kbd>⌘K</kbd></button>
      <button type="button" class="btn ghost small install-btn" data-install hidden aria-label="Install ConvertEasy">${svgIcon('download', 16)}<span class="install-label">Install</span></button>
      <button type="button" class="icon-btn theme-btn" data-theme-toggle aria-label="Switch theme">${svgIcon('sun', 18, 't-sun')}${svgIcon('moon', 18, 't-moon')}${svgIcon('auto', 18, 't-auto')}</button>
    </div>
  </div>
  <div class="ruler-strip" aria-hidden="true"></div>
</header>`;
}

function breadcrumbHtml(p) {
  if (!p.crumbs?.length) return '';
  const items = [`<li><a href="${ORIGIN}/">lowkey.tools</a></li>`, `<li><a href="${href('')}">${SITE.name}</a></li>`];
  p.crumbs.forEach((c, i) => {
    const last = i === p.crumbs.length - 1;
    items.push(last ? `<li><span aria-current="page">${esc(c.name)}</span></li>` : `<li><a href="${href(c.path)}">${esc(c.name)}</a></li>`);
  });
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}

/** The creator cards: shipped on every page, above the footer. */
export function makers(p = {}) {
  const picks = siblingsFor(p.path ?? '');
  return `<aside class="makers" aria-label="Who makes ConvertEasy">
  <section class="maker maker-owleye" aria-labelledby="mk-owleye">
    <span class="maker-kicker">Built by</span>
    <h2 id="mk-owleye"><a href="${ORG.url}">OwlEye Analytics</a></h2>
    <p>${esc(ORG.description)} The same people, the same allergy to cookie banners.</p>
    <ul>
      <li>Cookie-free and privacy-preserving by design</li>
      <li>Funnels, dashboards and a dependency-free TypeScript SDK</li>
    </ul>
    <a class="btn accent" href="${ORG.url}">See how OwlEye measures a site ${svgIcon('arrow', 16)}</a>
  </section>
  <section class="maker" aria-labelledby="mk-author">
    <span class="maker-kicker">Designed and coded by</span>
    <h2 id="mk-author"><a href="${AUTHOR.url}" rel="author">Shrinath Prabhu</a></h2>
    <p>${esc(AUTHOR.bio)} ConvertEasy is one of his small, fast, private tools, written by hand with no framework.</p>
    <p class="maker-links">
      <a class="btn ghost" href="${AUTHOR.url}" rel="author">shrinath.me ${svgIcon('arrow', 16)}</a>
      <a class="btn ghost" href="${AUTHOR.x}" rel="me noopener">${xIcon()} Follow ${AUTHOR.handle}</a>
    </p>
  </section>
  <section class="maker maker-family" aria-labelledby="mk-more">
    <span class="maker-kicker">Part of <a href="${ORIGIN}">lowkey.tools</a></span>
    <h2 id="mk-more">One more useful detour</h2>
    <ul class="pitch-list">
      ${picks.map((sib) => `<li><a href="${sib.url}"><b>${esc(sib.name)}</b><span>${esc(sib.pitch)}</span></a></li>`).join('\n      ')}
    </ul>
    <a class="btn ghost" href="${ORIGIN}">View all 12 on lowkey.tools ${svgIcon('arrow', 16)}</a>
  </section>
</aside>`;
}

/** X (formerly Twitter) glyph, so the follow link is recognisable. */
function xIcon() {
  return `<svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.67l7.73-8.84L1.25 2.25h6.82l4.71 6.23zm-1.16 17.52h1.83L7.08 4.12H5.11z"/></svg>`;
}

function footer(p, popular) {
  const year = p.buildDate.slice(0, 4);
  const family = siblingsFor(p.path ?? '');
  return `<footer class="foot">
  <div class="foot-inner">
    <div class="foot-brand">
      <a class="brand" href="${href('')}">${MARK}<span>Convert<b>Easy</b></span></a>
      <p class="foot-line">
        <a class="strong" href="${ORIGIN}">Part of lowkey.tools</a> ·
        <a class="strong" href="${ORG.url}">Built by OwlEye Analytics</a> ·
        <a class="strong" href="${AUTHOR.url}" rel="author">shrinath.me</a>
      </p>
      <p>Units, live currency and crypto rates, exact crypto denominations, dates and a calculator that understands units. No account, no cookies, no adverts. Works offline.</p>
      <p><a class="x-follow" href="${AUTHOR.x}" rel="me noopener">${xIcon()} Follow ${AUTHOR.handle} for the next lowkey tool</a></p>
    </div>
    <nav aria-labelledby="ft-tools">
      <h2 id="ft-tools">Converters</h2>
      <ul>
        ${TOOLS.map((t) => `<li><a href="${href(t.path)}">${esc(t.name)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <nav aria-labelledby="ft-pop">
      <h2 id="ft-pop">Popular</h2>
      <ul>
        ${popular.map((x) => `<li><a href="${href(x.path)}">${esc(x.name)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <nav aria-labelledby="ft-family">
      <h2 id="ft-family">Also on lowkey.tools</h2>
      <ul>
        ${family.map((sib) => `<li><a href="${sib.url}" title="${esc(sib.desc)}">${esc(sib.name)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <nav aria-labelledby="ft-makers">
      <h2 id="ft-makers">Makers</h2>
      <ul>
        <li><a href="${ORG.url}">OwlEye Analytics</a></li>
        <li><a href="${ORG.url}">Cookie-free web analytics</a></li>
        <li><a href="${AUTHOR.url}" rel="author">Shrinath Prabhu</a></li>
        <li><a href="${AUTHOR.x}" rel="me noopener">${AUTHOR.handle} on X</a></li>
        <li><a href="${ORIGIN}">All 12 lowkey tools</a></li>
        <li><a href="${href('/llms.txt')}">llms.txt</a></li>
      </ul>
    </nav>
    <div class="foot-legal">
      <span>© ${year} <a href="${ORG.url}">OwlEye Analytics</a> · Made by <a href="${AUTHOR.url}" rel="author">Shrinath</a> (<a href="${AUTHOR.x}" rel="me noopener">${AUTHOR.handle}</a>) · A <a href="${ORIGIN}">lowkey.tools</a> app</span>
      <span>Rates: Coinbase, CoinGecko, currency-api, Frankfurter (ECB). Reference rates, not trading quotes.</span>
    </div>
  </div>
</footer>`;
}

// ---------------------------------------------------------------------------
// Layout

/**
 * @param {object} p  page definition (see pages.mjs)
 * @param {object} a  build assets: { js, css, theme, fonts: [] , buildDate, popular }
 */
export function layout(p, a) {
  const pageUrl = url(p.path);
  const data = Object.entries(p.data ?? {})
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` data-${k}="${esc(v)}"`)
    .join('');
  const robots = p.noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  const og = `${SITE_URL}/icons/og.png`;
  const keywords = p.keywords?.length ? `\n    <meta name="keywords" content="${esc(p.keywords.join(', '))}" />` : '';
  // p.toolHead: a visible title bar for the tool (the home page uses it to
  // make the smart calculator unmistakably the main feature).
  const head = p.toolHead
    ? `<header class="tool-head">
        <span class="tool-badge">${svgIcon(p.toolHead.icon ?? 'calc', 20)}</span>
        <div class="tool-head-text"><h2 id="tool-title">${esc(p.toolHead.title)}</h2><p>${p.toolHead.sub}</p></div>
        ${p.toolHead.link ? `<a class="btn ghost small tool-head-link" href="${href(p.toolHead.link.path)}">${esc(p.toolHead.link.text)} ${svgIcon('arrow', 16)}</a>` : ''}
      </header>`
    : '';
  const toolBlock = p.tool
    ? `<section class="tool${p.toolHead ? ' has-head' : ''}" data-kind="${esc(p.tool)}" ${p.toolHead ? 'aria-labelledby="tool-title"' : `aria-label="${esc(p.toolLabel ?? 'Converter')}"`}>
      ${head}
      <div class="tool-body" id="tool">
        <div class="tool-fallback" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
        <noscript><div class="noscript"><p><strong>The interactive ${esc(p.toolLabel ?? 'converter')} needs JavaScript.</strong> Everything below this box, including the formula and tables, works without it.</p></div></noscript>
      </div>
    </section>`
    : '';

  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(p.title)}</title>
    <meta name="description" content="${esc(p.description)}" />
    <link rel="canonical" href="${pageUrl}" />
    <meta name="robots" content="${robots}" />${keywords}
    <meta name="author" content="${AUTHOR.name}" />
    <meta name="creator" content="${AUTHOR.name}" />
    <meta name="publisher" content="${ORG.name}" />
    <meta name="application-name" content="${SITE.name}" />
    <meta name="apple-mobile-web-app-title" content="${SITE.name}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="${SITE.themeLight}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${SITE.themeDark}" media="(prefers-color-scheme: dark)" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE.name} · lowkey.tools" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${esc(p.ogTitle ?? p.title)}" />
    <meta property="og:description" content="${esc(p.description)}" />
    <meta property="og:image" content="${og}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="ConvertEasy: convert anything, calculate with units" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(p.ogTitle ?? p.title)}" />
    <meta name="twitter:description" content="${esc(p.description)}" />
    <meta name="twitter:image" content="${og}" />
    <meta name="twitter:image:alt" content="ConvertEasy: convert anything, calculate with units" />

    <link rel="author" href="${AUTHOR.url}" />
    <link rel="publisher" href="${ORG.url}" />
    <link rel="icon" href="${href('/icons/favicon.svg')}" type="image/svg+xml" />
    <link rel="icon" href="${href('/icons/favicon.ico')}" sizes="32x32" />
    <link rel="apple-touch-icon" href="${href('/icons/apple-touch-icon.png')}" />
    <link rel="manifest" href="${href('/manifest.webmanifest')}" />
    <link rel="search" type="application/opensearchdescription+xml" title="${SITE.name}" href="${href('/opensearch.xml')}" />
    <link rel="sitemap" type="application/xml" href="${href('/sitemap.xml')}" />
    <link rel="alternate" type="text/plain" title="llms.txt" href="${href('/llms.txt')}" />
    <link rel="alternate" type="text/plain" title="llms-full.txt" href="${href('/llms-full.txt')}" />
    ${a.fonts.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin />`).join('\n    ')}
    ${p.preconnect ? p.preconnect.map((o) => `<link rel="preconnect" href="${o}" crossorigin />`).join('\n    ') : ''}
    <link rel="stylesheet" href="${a.css}" />
    <link rel="modulepreload" href="${a.js}" />
    ${(a.preload?.[p.dataTool] ?? []).map((f) => `<link rel="modulepreload" href="${f}" />`).join('\n    ')}
    <script src="${a.theme}"></script>
    <script type="application/ld+json">${jsonld(p, a.buildDate)}</script>
  </head>
  <body class="${esc(p.bodyClass ?? '')}" data-tool="${esc(p.dataTool ?? '')}"${data}>
    <a class="skip" href="#main">Skip to content</a>
    ${header(p)}
    <main id="main">
      ${breadcrumbHtml(p)}
      <header class="page-head">
        ${p.eyebrow ? `<p class="eyebrow">${esc(p.eyebrow)}</p>` : ''}
        <h1>${p.h1}</h1>
        ${p.lede ? `<p class="lede">${p.lede}</p>` : ''}
        ${p.answer ? `<p class="answer">${p.answer}</p>` : ''}
      </header>
      ${toolBlock}
      ${p.main ?? ''}
      ${makers(p)}
    </main>
    ${footer({ ...p, buildDate: a.buildDate }, a.popular)}
    <script type="module" src="${a.js}"></script>
  </body>
</html>
`;
}

/** Reusable content pieces */

export function faqHtml(faq, heading = 'Questions and answers') {
  if (!faq?.length) return '';
  return `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">${esc(heading)}</h2>
${faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`).join('\n')}
</section>`;
}

export function linkPanel(title, links, cls = 'link-list') {
  if (!links.length) return '';
  return `<section class="panel"><h2>${esc(title)}</h2><ul class="${cls}">${links.map((l) => `<li><a href="${href(l.path)}">${esc(l.name)}</a></li>`).join('')}</ul></section>`;
}

export function categoryGrid(activeId) {
  return `<ul class="cat-grid">${CATEGORIES.map(
    (c) => `<li><a href="${href('/' + CATEGORY_SLUG[c.id])}"${c.id === activeId ? ' aria-current="page"' : ''}>${svgIcon(c.icon, 18)}${esc(c.name)}</a></li>`,
  ).join('')}</ul>`;
}

export function toolGrid(exclude) {
  return `<ul class="tool-grid">${TOOLS.filter((t) => t.id !== exclude)
    .map((t) => `<li><a class="tool-tile" href="${href(t.path)}"><span class="tile-icon">${svgIcon(t.icon, 20)}</span><span class="tile-name">${esc(t.name)}</span><span class="tile-desc">${esc(t.desc)}</span></a></li>`)
    .join('')}</ul>`;
}

export function table(caption, head, rows, { numericCols = [] } = {}) {
  return `<div class="table-wrap"><table class="table"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td${numericCols.includes(i) ? ' class="num"' : ''}>${c}</td>`)).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}
