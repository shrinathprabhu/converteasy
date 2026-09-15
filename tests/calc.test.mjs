import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, tokenize } from '../src/js/core/calc.js';
import { suggest } from '../src/js/core/suggest.js';

const rates = { USD: 1, EUR: 1.165, INR: 1 / 95.11, GBP: 1.357, BTC: 77000, ETH: 2400 };
const ctx = { money: (c) => rates[c] ?? null, currencies: () => Object.keys(rates) };
const calc = (s) => calculate(s, ctx);
const text = (s) => {
  const r = calc(s);
  assert.ok(r.ok, `${s} → ${r.error}`);
  return r.text;
};

test('the headline example: 1cm + 1 metre = 1.01 m, or 101 cm', () => {
  assert.equal(text('1cm + 1 metre'), '1.01 m');
  assert.equal(text('1 cm + 1 m to cm'), '101 cm');
});

test('number forms: 1, 1.1, 001, 0.01 are valid; 1.1.1 is not', () => {
  assert.equal(text('1 + 1.1'), '2.1');
  assert.equal(text('001 + 0.01'), '1.01');
  assert.equal(text('.5 + 1,000'), '1,000.5');
  const bad = calc('1.1.1 + 2');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /1\.1\.1/);
});

test('every operator from the spec', () => {
  assert.equal(text('7 - 2 * 3'), '1');
  assert.equal(text('6 × 7'), '42');
  assert.equal(text('8 ÷ 2'), '4');
  assert.equal(text('8 / 2'), '4');
  assert.equal(text('(1 + 2) * 3'), '9');
  assert.equal(text('π'), '3.14159');
  assert.equal(text('2π'), '6.28318');
  assert.equal(text('√16 + 9'), '13');
  assert.equal(text('√(16 + 9)'), '5');
  assert.equal(text('2^10'), '1,024');
  assert.equal(text('-2^2'), '−4');
  assert.equal(text('5!'), '120');
  assert.equal(text('50%'), '0.5');
  assert.equal(text('200 g + 10%'), '220 g');
  assert.equal(text('10% of 200'), '20');
  assert.equal(text('10 % 3'), '1');
  assert.equal(text('2 + 3 ='), '5');
  assert.equal(text('1 km = 1000 m'), 'True');
  assert.equal(text('1 kg ≠ 1 lb'), 'True');
  assert.equal(text('1 kg != 1000 g'), 'False');
});

test('units must be the same kind to add', () => {
  const r = calc('1 kg + 1 m');
  assert.equal(r.ok, false);
  assert.match(r.error, /weight and a length/);
});

test('dimensions carry through multiplication and division', () => {
  assert.equal(text('3 m × 4 m'), '12 m²');
  assert.equal(text('5 cm * 5 cm'), '25 cm²');
  assert.equal(text('100 km / 2 h'), '50 km/h');
  assert.equal(text('5 kW * 3 h'), '15 kWh');
  assert.equal(text('10 kg * 9.8 m/s^2'), '98 N');
  assert.equal(text('1 km / 100 m'), '10');
});

test('compound quantities and split results', () => {
  assert.equal(text('5 ft 11 in to cm'), '180.34 cm');
  assert.equal(text(`5'11" to cm`), '180.34 cm');
  assert.equal(text('180 cm to ft in'), '5 ft 10.866 in');
  assert.equal(text('72 in to ft in'), '6 ft 0 in');
  assert.equal(text('100000 s to d h min s'), '1 d 3 h 46 min 40 s');
  assert.equal(text('2 h 30 min to min'), '150 min');
});

test('temperatures convert with offsets and subtract to differences', () => {
  assert.equal(text('98.6 F to C'), '37 °C');
  assert.equal(text('20 °C + 5 °C'), '25 °C');
  const diff = calc('30 °C - 20 °C to F');
  assert.equal(diff.text, '18 °F');
  assert.equal(diff.note, 'temperature difference');
});

test('money uses live rates and symbols', () => {
  assert.equal(text('100 INR to USD'), '1.05 USD');
  assert.equal(text('$20 + €15 in INR'), '3,564.25 INR');
  assert.equal(text('1 BTC to USD'), '77,000.00 USD');
  const offline = calculate('10 USD to EUR');
  assert.equal(offline.ok, false);
});

test('formats, bases and scale words', () => {
  assert.equal(text('255 to hex'), '0xFF');
  assert.equal(text('0xff + 1'), '256');
  assert.equal(text('2026 to roman'), 'MMXXVI');
  assert.equal(text('2 lakh + 50k'), '250,000');
  assert.equal(text('1 GB to MiB'), '953.6743164 MiB');
});

test('incomplete input is reported softly', () => {
  assert.equal(calc('5 +').incomplete, true);
  assert.equal(calc('(2 + 3').incomplete, true);
  assert.equal(calc('2 g + 5').incomplete, true);
});

test('"in" is inches after a number and "to" elsewhere', () => {
  const kinds = tokenize('5 in in cm').map((t) => t.t);
  assert.deepEqual(kinds, ['num', 'unit', 'to', 'unit']);
});

test('suggestions only offer units of the kind already in play', () => {
  const s = suggest('2 g + 5', ctx);
  const units = s.items.filter((i) => i.kind === 'unit').map((i) => i.label);
  assert.ok(units.includes('kg') && units.includes('lb') && units.includes('oz'));
  assert.ok(!units.includes('m') && !units.includes('cm'));
  const after = suggest('1 cm + 1 m to ', ctx);
  assert.equal(after.context, 'target');
  assert.ok(after.items.some((i) => i.label === 'in'));
  const partial = suggest('1 cm + 1 metre', ctx);
  assert.equal(partial.items[0].label, 'm');
});

test('the calculator follows the byte counting mode', () => {
  assert.equal(text('1 GB to MB'), '1,000 MB');
  assert.equal(calculate('1 GB to MB', { ...ctx, dataMode: 'binary' }).text, '1,024 MB');
  assert.equal(calculate('1 KB to B', { ...ctx, dataMode: 'binary' }).text, '1,024 B');
  assert.equal(calculate('1 Kb to bit', { ...ctx, dataMode: 'binary' }).text, '1,000 bit');
  assert.equal(calculate('1 B to bit', { ...ctx, dataMode: 'binary' }).text, '8 bit');
  assert.equal(calculate('512 MB + 512 MB to GB', { ...ctx, dataMode: 'binary' }).text, '1 GB');
});

test('B and T scale numbers when attached, and stay units in context', () => {
  assert.equal(text('5B'), '5,000,000,000');
  assert.equal(text('2T'), '2,000,000,000,000');
  assert.equal(text('1.2T / 8B'), '150');
  assert.equal(text('3b'), '3,000,000,000');
  assert.equal(text('2 tn'), '2,000,000,000,000');
  assert.equal(text('$2.5B + $800M'), '3,300,000,000.00 USD');
  assert.deepEqual(calc('5B').alt.map((a) => a.text), ['5 billion', '500 crore']);
  assert.equal(text('5 B'), '5 B');
  assert.equal(text('2 T'), '2 tbsp');
  assert.equal(text('512B + 1 KB'), '1.512 KB');
  assert.equal(text('2T + 1 tbsp'), '3 tbsp');
  assert.equal(text('5B/s'), '5 B/s');
});

test('suggestions: scale chip, conversion keyword and byte sizes', () => {
  assert.equal(suggest('5B', ctx).items[0].label, 'B = billion');
  const to = suggest('5 GB to', ctx);
  assert.equal(to.context, 'target');
  assert.ok(to.items.some((i) => i.label === 'MB'));
  const bin = suggest('5 GB to ', { ...ctx, dataMode: 'binary' }).items.find((i) => i.label === 'MB');
  assert.equal(bin.hint, 'megabyte · 1,024 KB');
  const dec = suggest('5 GB to ', ctx).items.find((i) => i.label === 'MB');
  assert.equal(dec.hint, 'megabyte · 1,000 KB');
});
