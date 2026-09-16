// Fiat currencies, crypto assets and crypto denominations.
//
// Fiat names come from Intl.DisplayNames at runtime, so the list only carries
// what Intl cannot: a display symbol and, for crypto, the CoinGecko id used
// for the fallback price feed.

/** Active ISO 4217 codes worth offering. */
export const FIAT_CODES = `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL
BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP
GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD
KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK
NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP
STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF
YER ZAR ZMW ZWL`.split(/\s+/);

export const POPULAR_FIAT = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'AED', 'HKD', 'NZD', 'SEK', 'KRW', 'BRL', 'MXN', 'ZAR'];

/** Symbols for display. Codes absent here display their code. */
export const SYMBOL = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩', RUB: '₽', TRY: '₺', VND: '₫', THB: '฿',
  NGN: '₦', PHP: '₱', UAH: '₴', ILS: '₪', CRC: '₡', PYG: '₲', GHS: '₵', KZT: '₸', MNT: '₮', AZN: '₼', GEL: '₾',
  CAD: 'C$', AUD: 'A$', NZD: 'NZ$', HKD: 'HK$', SGD: 'S$', BRL: 'R$', MXN: 'MX$', TWD: 'NT$', PLN: 'zł', ZAR: 'R',
  CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', CZK: 'Kč', HUF: 'Ft', IDR: 'Rp', MYR: 'RM', PKR: '₨', LKR: 'Rs',
  NPR: 'Rs', BDT: '৳', EGP: 'E£', SAR: 'SAR', AED: 'AED', BTC: '₿', ETH: 'Ξ',
};

/**
 * Prefix symbols the calculator accepts ("$20 + €15"). Only unambiguous or
 * overwhelmingly common readings: "$" is USD, "¥" is JPY.
 */
export const PREFIX_SYMBOLS = {
  $: 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', '₩': 'KRW', '₽': 'RUB', '₺': 'TRY',
  '₫': 'VND', '฿': 'THB', '₦': 'NGN', '₱': 'PHP', '₴': 'UAH', '₪': 'ILS', '₿': 'BTC', Ξ: 'ETH', 'C$': 'CAD',
  'CA$': 'CAD', 'A$': 'AUD', 'AU$': 'AUD', 'NZ$': 'NZD', 'HK$': 'HKD', 'S$': 'SGD', 'R$': 'BRL', 'Rs': 'INR',
  'Rs.': 'INR', 'NT$': 'TWD', 'MX$': 'MXN',
};

/** Currency words the calculator understands, lowercased. */
export const CURRENCY_WORDS = {
  dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD', euro: 'EUR', euros: 'EUR', rupee: 'INR',
  rupees: 'INR', yen: 'JPY', yuan: 'CNY', renminbi: 'CNY', 'pound sterling': 'GBP', sterling: 'GBP', quid: 'GBP',
  franc: 'CHF', francs: 'CHF', won: 'KRW', ruble: 'RUB', rubles: 'RUB', rouble: 'RUB', roubles: 'RUB',
  lira: 'TRY', peso: 'MXN', pesos: 'MXN', real: 'BRL', reais: 'BRL', dirham: 'AED', dirhams: 'AED',
  riyal: 'SAR', riyals: 'SAR', baht: 'THB', ringgit: 'MYR', rand: 'ZAR', dong: 'VND', naira: 'NGN',
  bitcoin: 'BTC', bitcoins: 'BTC', ether: 'ETH', ethereum: 'ETH', solana: 'SOL', dogecoin: 'DOGE',
};

/**
 * Lowercase codes accepted in the calculator. Excludes codes that are also
 * everyday words ("all", "top", "try", "cup", "pen", "mad", "sol").
 */
export const LOOSE_CODES = new Set(
  `usd eur gbp inr jpy cny aud cad chf sgd aed hkd nzd sek nok dkk krw brl mxn zar rub thb idr myr php pkr
  bdt lkr npr sar qar kwd bhd omr egp ngn kes pln czk huf ron ils twd vnd uah ars clp cop btc eth usdt usdc
  doge xrp ada bnb dot ltc trx avax link xlm`.split(/\s+/),
);

/**
 * Curated crypto assets. `cg` is the CoinGecko id for the fallback feed.
 * Order is roughly by market prominence and drives list order in pickers.
 */
export const CRYPTO = [
  { code: 'BTC', name: 'Bitcoin', cg: 'bitcoin' },
  { code: 'ETH', name: 'Ethereum', cg: 'ethereum' },
  { code: 'USDT', name: 'Tether', cg: 'tether' },
  { code: 'USDC', name: 'USD Coin', cg: 'usd-coin' },
  { code: 'BNB', name: 'BNB', cg: 'binancecoin' },
  { code: 'SOL', name: 'Solana', cg: 'solana' },
  { code: 'XRP', name: 'XRP', cg: 'ripple' },
  { code: 'DOGE', name: 'Dogecoin', cg: 'dogecoin' },
  { code: 'ADA', name: 'Cardano', cg: 'cardano' },
  { code: 'TRX', name: 'TRON', cg: 'tron' },
  { code: 'TON', name: 'Toncoin', cg: 'the-open-network' },
  { code: 'AVAX', name: 'Avalanche', cg: 'avalanche-2' },
  { code: 'LINK', name: 'Chainlink', cg: 'chainlink' },
  { code: 'DOT', name: 'Polkadot', cg: 'polkadot' },
  { code: 'XLM', name: 'Stellar', cg: 'stellar' },
  { code: 'SUI', name: 'Sui', cg: 'sui' },
  { code: 'BCH', name: 'Bitcoin Cash', cg: 'bitcoin-cash' },
  { code: 'LTC', name: 'Litecoin', cg: 'litecoin' },
  { code: 'HBAR', name: 'Hedera', cg: 'hedera-hashgraph' },
  { code: 'SHIB', name: 'Shiba Inu', cg: 'shiba-inu' },
  { code: 'DAI', name: 'Dai', cg: 'dai' },
  { code: 'XMR', name: 'Monero', cg: 'monero' },
  { code: 'UNI', name: 'Uniswap', cg: 'uniswap' },
  { code: 'NEAR', name: 'NEAR Protocol', cg: 'near' },
  { code: 'APT', name: 'Aptos', cg: 'aptos' },
  { code: 'ICP', name: 'Internet Computer', cg: 'internet-computer' },
  { code: 'POL', name: 'Polygon', cg: 'polygon-ecosystem-token' },
  { code: 'ETC', name: 'Ethereum Classic', cg: 'ethereum-classic' },
  { code: 'ATOM', name: 'Cosmos', cg: 'cosmos' },
  { code: 'FIL', name: 'Filecoin', cg: 'filecoin' },
  { code: 'ARB', name: 'Arbitrum', cg: 'arbitrum' },
  { code: 'OP', name: 'Optimism', cg: 'optimism' },
  { code: 'ALGO', name: 'Algorand', cg: 'algorand' },
  { code: 'XTZ', name: 'Tezos', cg: 'tezos' },
  { code: 'AAVE', name: 'Aave', cg: 'aave' },
  { code: 'INJ', name: 'Injective', cg: 'injective-protocol' },
  { code: 'TIA', name: 'Celestia', cg: 'celestia' },
  { code: 'SEI', name: 'Sei', cg: 'sei-network' },
  { code: 'KAS', name: 'Kaspa', cg: 'kaspa' },
  { code: 'ZEC', name: 'Zcash', cg: 'zcash' },
  { code: 'PEPE', name: 'Pepe', cg: 'pepe' },
  { code: 'WIF', name: 'dogwifhat', cg: 'dogwifcoin' },
  { code: 'WBTC', name: 'Wrapped Bitcoin', cg: 'wrapped-bitcoin' },
];

export const CRYPTO_BY_CODE = new Map(CRYPTO.map((c) => [c.code, c]));
export const POPULAR_CRYPTO = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'XRP', 'DOGE', 'BNB'];

export function isCrypto(code) {
  return CRYPTO_BY_CODE.has(code);
}

/**
 * Denomination ladders. `exp` is the power of ten of base units in each
 * denomination, so converting is a decimal point move (see core/decimal.js).
 */
export const LADDERS = {
  ETH: {
    name: 'Ethereum',
    units: [
      { id: 'wei', label: 'wei', exp: 0 },
      { id: 'kwei', label: 'kwei (babbage)', exp: 3 },
      { id: 'mwei', label: 'mwei (lovelace)', exp: 6 },
      { id: 'gwei', label: 'gwei (shannon)', exp: 9 },
      { id: 'szabo', label: 'szabo (microether)', exp: 12 },
      { id: 'finney', label: 'finney (milliether)', exp: 15 },
      { id: 'ETH', label: 'ETH (ether)', exp: 18 },
    ],
  },
  BTC: {
    name: 'Bitcoin',
    units: [
      { id: 'sat', label: 'sat (satoshi)', exp: 0 },
      { id: 'uBTC', label: 'μBTC (bits)', exp: 2 },
      { id: 'mBTC', label: 'mBTC (millibitcoin)', exp: 5 },
      { id: 'BTC', label: 'BTC', exp: 8 },
    ],
  },
};

/**
 * Quick presets. Each maps a whole-coin amount to its base (smallest) unit, or
 * between two named denominations of a ladder.
 */
export const PRESETS = [
  { id: 'usdc', label: 'USDC', big: 'USDC', small: 'base units', decimals: 6, note: 'USDC uses 6 decimals on Ethereum, Solana, Base, Arbitrum and most chains. Bridged USDC on BNB Chain uses 18.' },
  { id: 'usdt', label: 'USDT', big: 'USDT', small: 'base units', decimals: 6, note: 'USDT uses 6 decimals on Ethereum and Tron. BEP-20 USDT on BNB Chain uses 18.' },
  { id: 'gwei', label: 'ETH ↔ gwei', big: 'ETH', small: 'gwei', decimals: 9, ladder: 'ETH', from: 'ETH', to: 'gwei', note: 'Gas prices are quoted in gwei: 1 gwei is 10⁻⁹ ETH, or 1,000,000,000 wei.' },
  { id: 'wei', label: 'ETH ↔ wei', big: 'ETH', small: 'wei', decimals: 18, ladder: 'ETH', from: 'ETH', to: 'wei', note: 'Wei is the smallest unit of ether. Every ERC-20 amount on-chain is an integer of base units like this.' },
  { id: 'gwei-wei', label: 'gwei ↔ wei', big: 'gwei', small: 'wei', decimals: 9, ladder: 'ETH', from: 'gwei', to: 'wei', note: '1 gwei is exactly 1,000,000,000 wei.' },
  { id: 'sat', label: 'BTC ↔ sats', big: 'BTC', small: 'sats', decimals: 8, ladder: 'BTC', from: 'BTC', to: 'sat', note: 'One satoshi is 10⁻⁸ BTC, the smallest amount the Bitcoin protocol records.' },
  { id: 'mbtc', label: 'BTC ↔ mBTC', big: 'BTC', small: 'mBTC', decimals: 3, ladder: 'BTC', from: 'BTC', to: 'mBTC', note: 'A millibitcoin is one thousandth of a bitcoin, or 100,000 sats.' },
  { id: 'ubtc', label: 'BTC ↔ μBTC', big: 'BTC', small: 'μBTC (bits)', decimals: 6, ladder: 'BTC', from: 'BTC', to: 'uBTC', note: 'A microbitcoin, also called a bit, is one millionth of a bitcoin, or 100 sats.' },
  { id: 'lamports', label: 'SOL ↔ lamports', big: 'SOL', small: 'lamports', decimals: 9, note: 'A lamport is 10⁻⁹ SOL. Solana fees and rent are charged in lamports.' },
  { id: 'doge', label: 'DOGE ↔ koinu', big: 'DOGE', small: 'koinu', decimals: 8, note: 'Dogecoin, like Bitcoin, has 8 decimal places.' },
  { id: 'ltc', label: 'LTC ↔ litoshi', big: 'LTC', small: 'litoshi', decimals: 8 },
  { id: 'xrp', label: 'XRP ↔ drops', big: 'XRP', small: 'drops', decimals: 6, note: 'One drop is one millionth of an XRP.' },
  { id: 'ada', label: 'ADA ↔ lovelace', big: 'ADA', small: 'lovelace', decimals: 6 },
  { id: 'trx', label: 'TRX ↔ sun', big: 'TRX', small: 'sun', decimals: 6 },
  { id: 'dot', label: 'DOT ↔ planck', big: 'DOT', small: 'planck', decimals: 10, note: 'Polkadot moved to 10 decimals in its 2020 redenomination.' },
  { id: 'atom', label: 'ATOM ↔ uatom', big: 'ATOM', small: 'uatom', decimals: 6 },
  { id: 'near', label: 'NEAR ↔ yocto', big: 'NEAR', small: 'yoctoNEAR', decimals: 24 },
  { id: 'sui', label: 'SUI ↔ MIST', big: 'SUI', small: 'MIST', decimals: 9 },
  { id: 'apt', label: 'APT ↔ octas', big: 'APT', small: 'octas', decimals: 8 },
  { id: 'ton', label: 'TON ↔ nanoton', big: 'TON', small: 'nanoton', decimals: 9 },
  { id: 'avax', label: 'AVAX ↔ wei', big: 'AVAX', small: 'wei', decimals: 18, note: 'AVAX on the C-Chain uses 18 decimals like ETH. On the X- and P-Chains it uses 9 (nAVAX).' },
  { id: 'bnb', label: 'BNB ↔ wei', big: 'BNB', small: 'wei', decimals: 18 },
  { id: 'pol', label: 'POL ↔ wei', big: 'POL', small: 'wei', decimals: 18 },
  { id: 'xlm', label: 'XLM ↔ stroops', big: 'XLM', small: 'stroops', decimals: 7 },
  { id: 'xtz', label: 'XTZ ↔ mutez', big: 'XTZ', small: 'mutez', decimals: 6 },
  { id: 'algo', label: 'ALGO ↔ microAlgo', big: 'ALGO', small: 'microAlgos', decimals: 6 },
  { id: 'hbar', label: 'HBAR ↔ tinybars', big: 'HBAR', small: 'tinybars', decimals: 8 },
  { id: 'fil', label: 'FIL ↔ attoFIL', big: 'FIL', small: 'attoFIL', decimals: 18 },
  { id: 'icp', label: 'ICP ↔ e8s', big: 'ICP', small: 'e8s', decimals: 8 },
  { id: 'kas', label: 'KAS ↔ sompi', big: 'KAS', small: 'sompi', decimals: 8 },
  { id: 'xmr', label: 'XMR ↔ piconero', big: 'XMR', small: 'piconero', decimals: 12 },
  { id: 'wbtc', label: 'WBTC', big: 'WBTC', small: 'base units', decimals: 8 },
  { id: 'dai', label: 'DAI', big: 'DAI', small: 'base units', decimals: 18 },
  { id: 'custom', label: 'Custom decimals', big: 'Token', small: 'base units', decimals: 18, custom: true },
];

export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

/** Region code for a flag emoji, or '' when the currency is not national. */
export function flagOf(code) {
  if (!code || code.length !== 3 || code[0] === 'X') return code === 'EUR' ? '🇪🇺' : '';
  const cc = code === 'EUR' ? 'EU' : code.slice(0, 2);
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let fiatNames;
const nameCache = new Map();
/** English name for a fiat code via Intl, falling back to the code. */
export function currencyName(code) {
  const crypto = CRYPTO_BY_CODE.get(code);
  if (crypto) return crypto.name;
  if (nameCache.has(code)) return nameCache.get(code);
  try {
    fiatNames ??= new Intl.DisplayNames(['en'], { type: 'currency' });
    const name = fiatNames.of(code) || code;
    nameCache.set(code, name);
    return name;
  } catch {
    return code;
  }
}
