import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, getUnit, convert } from '../src/js/data/units.js';
import { shiftDecimal, parseDecimal } from '../src/js/core/decimal.js';
import { dateDiff, parseISODate, addToDate, toISODate, parseEpoch, zonedToInstant } from '../src/js/core/dates.js';
import { parseInBase, formatInBase, toRoman, fromRoman } from '../src/js/core/numbase.js';
import { fetchRates, fromCoinbase, fromCurrencyApi, fromFrankfurter } from '../src/js/core/rates.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('unit ids and slugs are unique', () => {
  const slugs = new Set();
  for (const c of CATEGORIES) {
    const ids = new Set();
    for (const u of c.units) {
      assert.ok(!ids.has(u.id), `duplicate id ${c.id}:${u.id}`);
      ids.add(u.id);
      assert.ok(!slugs.has(u.slug), `duplicate slug ${u.slug}`);
      slugs.add(u.slug);
    }
  }
});

test('exact legal definitions', () => {
  near(convert(1, getUnit('length', 'in'), getUnit('length', 'cm')), 2.54);
  near(convert(1, getUnit('mass', 'lb'), getUnit('mass', 'kg')), 0.45359237);
  near(convert(1, getUnit('volume', 'gal'), getUnit('volume', 'l')), 3.785411784);
  near(convert(1, getUnit('area', 'ac'), getUnit('area', 'sqft')), 43560);
  near(convert(100, getUnit('temperature', 'C'), getUnit('temperature', 'F')), 212);
  near(convert(-40, getUnit('temperature', 'F'), getUnit('temperature', 'C')), -40);
  near(convert(30, getUnit('fuel', 'mpg'), getUnit('fuel', 'l100km')), 7.840486, 1e-6);
  near(convert(1, getUnit('data', 'GiB'), getUnit('data', 'MB')), 1073.741824);
  near(convert(100, getUnit('datarate', 'Mbps'), getUnit('datarate', 'MBps')), 12.5);
});

test('crypto denominations are exact at 18+ decimals', () => {
  assert.equal(shiftDecimal('1.234567890123456789', 18, 0), '1234567890123456789');
  assert.equal(shiftDecimal('1', 0, 18), '0.000000000000000001');
  assert.equal(shiftDecimal('21000', 9, 18), '0.000021');
  assert.equal(shiftDecimal('2e-9', 18, 9), '2');
  assert.equal(shiftDecimal('1,000', 8, 0), '100000000000');
  assert.equal(shiftDecimal('1.1.1', 0, 0), null);
  assert.equal(parseDecimal('007').digits, '7');
});

test('calendar differences', () => {
  const d = dateDiff(parseISODate('2024-01-31'), parseISODate('2026-09-11'));
  assert.deepEqual([d.years, d.months, d.days, d.totalDays], [2, 7, 11, 954]);
  assert.equal(dateDiff(parseISODate('2026-09-07'), parseISODate('2026-09-14')).businessDays, 5);
  assert.equal(toISODate(addToDate(parseISODate('2024-01-31'), { months: 1 })), '2024-02-29');
  assert.equal(parseISODate('2026-02-30'), null);
});

test('epoch unit detection and zoned time', () => {
  assert.equal(parseEpoch('1788998551').unit, 's');
  assert.equal(parseEpoch('1788998551000').unit, 'ms');
  const t = zonedToInstant({ y: 2026, mo: 7, d: 1, h: 9, mi: 0 }, 'America/New_York');
  assert.equal(new Date(t).toISOString(), '2026-07-01T13:00:00.000Z');
});

test('number bases and Roman numerals', () => {
  const big = parseInBase('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
  assert.equal(formatInBase(big, 10, { group: false }), (2n ** 256n - 1n).toString());
  assert.throws(() => parseInBase('102', 2));
  assert.equal(toRoman(3999), 'MMMCMXCIX');
  assert.equal(fromRoman('mmxxvi'), 2026);
  assert.throws(() => fromRoman('IIII'));
});

test('rate payload parsers normalise to USD per unit', () => {
  near(fromCoinbase({ data: { rates: { EUR: '0.8', BTC: '0.00001' } } }).EUR, 1.25);
  near(fromCoinbase({ data: { rates: { BTC: '0.00001' } } }).BTC, 100000);
  near(fromCurrencyApi({ usd: { inr: 95 } }).INR, 1 / 95);
  near(fromFrankfurter({ rates: { GBP: 0.5 } }).GBP, 2);
});

test('rates fall back when the primary source fails', async () => {
  const fail = async () => {
    throw new Error('down');
  };
  const r = await fetchRates({
    coinbase: fail,
    coingecko: async () => ({ BTC: 70000 }),
    currencyapi: fail,
    frankfurter: async () => ({ USD: 1, EUR: 1.2, INR: 0.012, JPY: 0.0067 }),
  });
  assert.deepEqual(r.sources, ['coingecko', 'frankfurter']);
  assert.equal(r.rates.BTC, 70000);
  await assert.rejects(fetchRates({ coinbase: fail, coingecko: fail, currencyapi: fail, frankfurter: fail }));
});

test('byte counting modes: KB is 1,000 B or 1,024 B, bits stay decimal', async () => {
  const { effectiveFactor } = await import('../src/js/data/units.js');
  const d = (id) => getUnit('data', id);
  const r = (id) => getUnit('datarate', id);
  near(convert(1, d('KB'), d('B')), 1000);
  near(convert(1, d('KB'), d('B'), 'binary'), 1024);
  near(convert(1, d('GB'), d('MB'), 'binary'), 1024);
  near(convert(1, d('TB'), d('GB'), 'binary'), 1024);
  near(convert(1, d('GB'), d('GiB'), 'binary'), 1);
  near(convert(1, d('B'), d('bit'), 'binary'), 8);
  near(convert(1, d('kb'), d('bit'), 'binary'), 1000);
  near(convert(1, d('Mb'), d('kb'), 'binary'), 1000);
  near(convert(1, d('MiB'), d('KiB')), 1024);
  near(convert(1, r('MBps'), r('KBps'), 'binary'), 1024);
  near(convert(100, r('Mbps'), r('MBps'), 'binary'), 100e6 / 8 / 1024 ** 2);
  near(convert(1, r('Gbps'), r('Mbps'), 'binary'), 1000);
  assert.equal(effectiveFactor(getUnit('length', 'm'), 'binary'), 1);
});
