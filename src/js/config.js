// Build-time configuration. scripts/build.mjs replaces this module's values
// from environment variables; the defaults below are what ships without any.
//
// COINGECKO_DEMO_KEY: optional free Demo key from coingecko.com/en/api. It is
// sent from the browser, so only ever use a free Demo key here, never a paid
// Pro key. Without it the keyless public tier is used, which is fine because
// CoinGecko is only a fallback behind Coinbase.
export const COINGECKO_DEMO_KEY = '';
