# Hosting ConvertEasy and linking it from lowkey.tools

ConvertEasy runs at **https://converteasy.lowkey.tools/** on
[Cloudflare Workers](cloudflare-workers.md). All assets, converters and PWA
files are served from the root. The hub links directly to the app subdomain;
no proxy rewrites are needed.

`wrangler.jsonc` declares the Custom Domain. See the Workers guide for build,
deployment and DNS setup. Native headers and redirects live in `src/static/`.

## Hub card and structured data

The following are examples for the hub repository, not changes applied there.
Copy `docs/hub/converteasy-icon.svg` into the hub's static assets and link the
card directly to the app:

```html
<a class="tool" href="https://converteasy.lowkey.tools/">
  <img src="/converteasy-icon.svg" width="20" height="20" alt="" loading="lazy" />
  <span class="tool-name">ConvertEasy</span>
  <span class="tool-path">converteasy.lowkey.tools</span>
  <span class="tool-desc">Convert units, currencies, crypto denominations, dates and calculations from one intelligent interface.</span>
</a>
```

Use this entity in the hub's tool list, adjusting the position and count there:

```json
{
  "@type": "WebApplication",
  "@id": "https://converteasy.lowkey.tools/#app",
  "name": "ConvertEasy",
  "url": "https://converteasy.lowkey.tools/",
  "description": "Free unit, currency and crypto converter with a smart calculator that understands units.",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Any web browser",
  "isAccessibleForFree": true,
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "publisher": { "@id": "https://owleye.dev/#organization" }
}
```

## SEO and answer-engine discovery

The build generates canonical URLs, Open Graph and Twitter metadata, JSON-LD,
`sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, OpenSearch and
`security.txt` for the app subdomain. The existing 1200×630 social image is
rendered from `scripts/og.html` and ships as `/icons/og.png`.

The app's own root `robots.txt` advertises its sitemap. Keep the hub sitemap
focused on hub URLs. The hub can link to the app in its `llms.txt`:

```markdown
- [ConvertEasy](https://converteasy.lowkey.tools/): Convert units, currencies, crypto denominations, dates and calculations. Full reference: https://converteasy.lowkey.tools/llms-full.txt
```

## Verify after deployment

- Submit `https://converteasy.lowkey.tools/sitemap.xml` in Search Console and
  Bing Webmaster Tools using a property covering the subdomain.
- Check `/`, `/cm-to-inches` and `/usd-to-inr` return the intended pages with
  canonical URLs on `converteasy.lowkey.tools`.
- Check `/icons/og.png`, `/robots.txt`, `/llms.txt` and `/manifest.webmanifest`.
- Check `/sw.js` revalidates and its allowed scope is `/`.
- Confirm hashed assets have immutable caching and unknown paths return 404.
- Test installation and offline use on real devices, and inspect a shared URL's
  social preview. Local checks do not verify production deployment or indexing.

Each app subdomain has separate browser storage and service workers. Data from
a previous origin is not automatically transferred to this origin.
