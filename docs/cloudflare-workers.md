# Deploying ConvertEasy on Cloudflare Workers

ConvertEasy uses **Workers Static Assets** to serve `dist/` at
**https://converteasy.lowkey.tools/**. It has no Worker script, server bindings
or backend. Cloudflare Workers is the deployment target.

## Workers Builds settings

Create or connect the `converteasy` Worker to the repository under
**Workers & Pages**. Use these [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/):

| Setting | Value |
| --- | --- |
| Worker name | `converteasy` |
| Production branch | Your release branch |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable `NODE_VERSION` | `22.18.0` (also pinned in `.node-version`) |
| Static assets directory | `./dist`, configured in `wrangler.jsonc` |

Workers Builds installs dependencies; commit `package-lock.json` and keep
build-time development dependencies enabled. Optional build variable:
`COINGECKO_DEMO_KEY` for a public CoinGecko Demo key. This value is compiled
into the browser bundle, not configured as a Worker runtime secret.

## Configuration and domain

`wrangler.jsonc` specifies:

- `assets.directory: "./dist"` to upload the generated site.
- `assets.html_handling: "drop-trailing-slash"` for paths like `/cm-to-inches`.
- `assets.not_found_handling: "404-page"` for real 404 responses.
- A Custom Domain route for `converteasy.lowkey.tools`.

The homepage remains `/`. Canonical, Open Graph, JSON-LD, sitemap and LLM
references keep the custom subdomain even in previews. No proxy rewrites
or SPA catch-all are used. See [Workers Static Assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

The `lowkey.tools` zone must be available in the deploying Cloudflare account.
If this hostname is already connected to another host, remove the old
hosting association and resolve conflicting DNS records when switching it
to the Worker's Custom Domain. Deploying the configured route associates
the domain with the Worker; editing this repository alone does not change DNS.
See [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Local preview and deployment

```bash
npm ci
npm run preview:workers
```

The preview builds first and starts `wrangler dev`. The existing
`npm run dev` command still uses the lightweight local server.

```bash
npx wrangler login
npm run deploy:workers
```

The deploy script builds first, then runs `wrangler deploy`. For a local
configuration and packaging check without publishing:

```bash
npm run deploy:workers -- --dry-run
```

Use the dashboard's separate build and deploy commands from the table to
avoid building twice. The old Pages commands and configuration have been
replaced; this follows Cloudflare's [Pages-to-Workers migration](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

## Shared headers and redirects

Each build copies `src/static/_headers` and `src/static/_redirects` into
`dist/`. These native files define security headers, HTML revalidation, immutable hashed
assets, font CORS, crawler content types and root service-worker scope.
The header rules remove inherited values before setting specific overrides so
Workers does not concatenate conflicting policies. See [Workers headers](https://developers.cloudflare.com/workers/static-assets/headers/).

The redirect file normalizes `/index`, `/index.html`, `/index/` and trailing
slashes on converter URLs. Workers handles HTML extension normalization.
Edit the source files in `src/static/`, not the output files in `dist/`.

## Verification

Run `npm run build && npm test`, then check Wrangler's local responses for
`/`, `/cm-to-inches`, `/sw.js`, `/icons/og.png`, crawler files, redirects with
query strings, and an unknown path. Confirm headers on HTML, JavaScript,
fonts and icons, and check the service worker's allowed scope is `/`.

After deployment, verify the custom domain's DNS, TLS, actual response
headers and offline installation. Local checks do not verify production.
