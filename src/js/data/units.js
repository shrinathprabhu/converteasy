// The unit database. One module feeds the converters, the smart calculator and
// the build step that pre-renders every SEO page, so a factor fixed here is
// fixed everywhere.
//
// Every unit carries a dimension vector and a factor to its SI (or chosen)
// base. Dimensions are what let the calculator decide that "3 m × 4 m" is an
// area while "1 kg + 1 m" is nonsense. Base dimensions:
//   L length (m)   M mass (kg)   T time (s)   K temperature (K)
//   A angle (rad)  D data (bit)  C money (USD, rates are live)
//
// Temperature and fuel economy are not proportional scales, so their units
// carry toBase/fromBase functions instead of a bare factor.
//
// Names are US spelling for display ("meter", "liter"); British spellings
// are accepted as aliases everywhere.

const PI = Math.PI;

/**
 * @param {string} id        stable id, also used in URLs and saved state
 * @param {string} symbol    display symbol
 * @param {string} name      singular display name
 * @param {number} factor    multiply by this to reach the category base unit
 * @param {object} [o]
 */
function u(id, symbol, name, factor, o = {}) {
  return {
    id,
    symbol,
    name,
    plural: o.plural ?? pluralize(name),
    factor,
    slug: o.slug ?? id,
    system: o.system ?? 'metric',
    popular: o.popular ?? false,
    symbols: o.symbols ?? [], // extra case-sensitive aliases
    names: o.names ?? [], // extra case-insensitive aliases
    desc: o.desc ?? '',
    toBase: o.toBase,
    fromBase: o.fromBase,
    deltaFactor: o.deltaFactor,
    binaryFactor: o.binaryFactor, // factor when bytes are counted in binary (1 KB = 1,024 B)
    uses: o.uses, // unit ids that naturally produce this unit (cm × cm → cm²)
    calc: o.calc ?? true,
  };
}

function pluralize(name) {
  if (/(inch|foot)$/.test(name)) return name.replace(/inch$/, 'inches').replace(/foot$/, 'feet');
  if (/(s|x|sh|ch)$/.test(name)) return name + 'es';
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + 'ies';
  return name + 's';
}

/** US and British spellings of the same word, both accepted. */
function spellings(name) {
  const out = new Set([name]);
  out.add(name.replace(/meter/g, 'metre').replace(/liter/g, 'litre'));
  return [...out];
}

export const CATEGORIES = [
  {
    id: 'length',
    name: 'Length',
    noun: 'length',
    dims: { L: 1 },
    base: 'm',
    icon: 'ruler',
    pair: ['cm', 'in'],
    blurb: 'Meters, feet, inches, miles, kilometers and more, including height in feet and inches.',
    about:
      'Length measures distance in one dimension. The SI base unit is the meter, defined by the distance light travels in a vacuum in 1/299,792,458 of a second. Since the 1959 international yard and pound agreement, imperial and US customary lengths are defined exactly in meters: an inch is exactly 2.54 centimeters.',
    units: [
      u('nm', 'nm', 'nanometer', 1e-9, { slug: 'nanometers', desc: 'One billionth of a meter, used for wavelengths of light and semiconductor feature sizes.' }),
      u('um', 'µm', 'micrometer', 1e-6, { symbols: ['μm', 'um'], names: ['micron', 'microns'], slug: 'micrometers', desc: 'One millionth of a meter, also called a micron.' }),
      u('mm', 'mm', 'millimeter', 1e-3, { popular: true, slug: 'mm', desc: 'One thousandth of a meter. Ten millimeters make a centimeter.' }),
      u('cm', 'cm', 'centimeter', 1e-2, { popular: true, slug: 'cm', symbols: ['cms'], desc: 'One hundredth of a meter. An inch is exactly 2.54 centimeters.' }),
      u('dm', 'dm', 'decimeter', 1e-1, { slug: 'decimeters', desc: 'One tenth of a meter.' }),
      u('m', 'm', 'meter', 1, { popular: true, slug: 'meters', symbols: ['mtr', 'mtrs'], desc: 'The SI base unit of length, defined by the speed of light.' }),
      u('km', 'km', 'kilometer', 1e3, { popular: true, slug: 'km', symbols: ['kms'], desc: 'One thousand meters. A mile is about 1.609 kilometers.' }),
      u('in', 'in', 'inch', 0.0254, { system: 'imperial', popular: true, slug: 'inches', symbols: ['″', '"', "''"], desc: 'Exactly 2.54 centimeters. Twelve inches make a foot.' }),
      u('ft', 'ft', 'foot', 0.3048, { system: 'imperial', popular: true, slug: 'feet', symbols: ['′', "'"], names: ['feet'], desc: 'Exactly 0.3048 meters, or 12 inches. Three feet make a yard.' }),
      u('yd', 'yd', 'yard', 0.9144, { system: 'imperial', popular: true, slug: 'yards', symbols: ['yds'], desc: 'Exactly 0.9144 meters, or 3 feet.' }),
      u('mi', 'mi', 'mile', 1609.344, { system: 'imperial', popular: true, slug: 'miles', desc: 'Exactly 1,609.344 meters, or 5,280 feet.' }),
      u('nmi', 'nmi', 'nautical mile', 1852, { system: 'other', slug: 'nautical-miles', symbols: ['NM'], desc: 'Exactly 1,852 meters. Used in air and sea navigation; one knot is one nautical mile per hour.' }),
      u('mil', 'mil', 'mil', 2.54e-5, { system: 'imperial', slug: 'mils', names: ['thou'], desc: 'One thousandth of an inch, used for wire and sheet thickness.' }),
      u('hand', 'hh', 'hand', 0.1016, { system: 'imperial', slug: 'hands', desc: 'Four inches, traditionally used to measure the height of horses.' }),
      u('fathom', 'ftm', 'fathom', 1.8288, { system: 'imperial', slug: 'fathoms', desc: 'Six feet, used for water depth.' }),
      u('furlong', 'fur', 'furlong', 201.168, { system: 'imperial', slug: 'furlongs', desc: 'An eighth of a mile, or 660 feet, still used in horse racing.' }),
      u('angstrom', 'Å', 'ångström', 1e-10, { system: 'other', slug: 'angstroms', names: ['angstrom', 'angstroms'], desc: 'One ten-billionth of a meter, used for atomic scales.' }),
      u('au', 'au', 'astronomical unit', 149597870700, { system: 'other', slug: 'astronomical-units', symbols: ['AU'], desc: 'Exactly 149,597,870,700 meters, roughly the mean Earth to Sun distance.' }),
      u('ly', 'ly', 'light-year', 9460730472580800, { system: 'other', slug: 'light-years', names: ['light year', 'light years', 'lightyear', 'lightyears'], desc: 'The distance light travels in one Julian year: exactly 9,460,730,472,580,800 meters.' }),
      u('pc', 'pc', 'parsec', 3.0856775814913673e16, { system: 'other', slug: 'parsecs', desc: 'About 3.26 light-years, defined from the astronomical unit and one arcsecond of parallax.' }),
    ],
  },
  {
    id: 'mass',
    name: 'Weight & mass',
    short: 'Weight',
    noun: 'weight',
    dims: { M: 1 },
    base: 'kg',
    icon: 'weight',
    pair: ['kg', 'lb'],
    blurb: 'Kilograms, pounds, grams, ounces, stone, tonnes, carats and tola.',
    about:
      'Mass is the amount of matter in an object; in everyday speech it is called weight. The SI base unit is the kilogram, defined since 2019 through the Planck constant. The international avoirdupois pound is defined as exactly 0.45359237 kilograms.',
    units: [
      u('ug', 'µg', 'microgram', 1e-9, { symbols: ['μg', 'ug', 'mcg'], slug: 'micrograms', desc: 'One millionth of a gram, common on supplement labels as mcg.' }),
      u('mg', 'mg', 'milligram', 1e-6, { popular: true, slug: 'mg', desc: 'One thousandth of a gram.' }),
      u('g', 'g', 'gram', 1e-3, { popular: true, slug: 'grams', symbols: ['gm', 'gms'], names: ['gramme', 'grammes'], desc: 'One thousandth of a kilogram.' }),
      u('kg', 'kg', 'kilogram', 1, { popular: true, slug: 'kg', symbols: ['kgs', 'kilo', 'kilos'], names: ['kilogramme', 'kilogrammes'], desc: 'The SI base unit of mass, defined through the Planck constant. About 2.20462 pounds.' }),
      u('t', 't', 'tonne', 1e3, { popular: true, slug: 'tonnes', names: ['metric ton', 'metric tons', 'metric tonne', 'metric tonnes'], desc: 'A metric ton: exactly 1,000 kilograms.' }),
      u('quintal', 'q', 'quintal', 100, { slug: 'quintals', desc: 'One hundred kilograms, widely used for crops and produce in India and parts of Europe.' }),
      u('ct', 'ct', 'carat', 2e-4, { system: 'other', slug: 'carats', desc: 'Exactly 200 milligrams, used for gemstones. Not the same as the karat purity scale for gold.' }),
      u('tola', 'tola', 'tola', 0.0116638038, { system: 'other', slug: 'tola', names: ['tolas', 'tolah'], desc: 'A traditional South Asian unit of 180 grains, about 11.66 grams, still used for gold and silver.' }),
      u('gr', 'gr', 'grain', 6.479891e-5, { system: 'imperial', slug: 'grains', desc: 'Exactly 64.79891 milligrams; 7,000 grains make a pound.' }),
      u('oz', 'oz', 'ounce', 0.028349523125, { system: 'imperial', popular: true, slug: 'ounces', symbols: ['ozs'], desc: 'An avoirdupois ounce: exactly 28.349523125 grams, or 1/16 of a pound.' }),
      u('ozt', 'ozt', 'troy ounce', 0.0311034768, { system: 'imperial', slug: 'troy-ounces', symbols: ['oz t', 'toz'], desc: 'Exactly 31.1034768 grams, the standard unit for precious metals.' }),
      u('lb', 'lb', 'pound', 0.45359237, { system: 'imperial', popular: true, slug: 'lbs', symbols: ['lbs', '#'], desc: 'The avoirdupois pound: exactly 0.45359237 kilograms, or 16 ounces.' }),
      u('st', 'st', 'stone', 6.35029318, { system: 'imperial', popular: true, slug: 'stone', plural: 'stone', names: ['stones'], desc: 'Fourteen pounds, about 6.35 kilograms, commonly used for body weight in the UK and Ireland.' }),
      u('ton', 'ton', 'US ton', 907.18474, { system: 'imperial', slug: 'us-tons', names: ['short ton', 'short tons', 'tons', 'ton'], desc: 'The US short ton: exactly 2,000 pounds.' }),
      u('longton', 'LT', 'imperial ton', 1016.0469088, { system: 'imperial', slug: 'imperial-tons', names: ['long ton', 'long tons', 'uk ton', 'uk tons'], desc: 'The imperial long ton: exactly 2,240 pounds.' }),
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    noun: 'volume',
    dims: { L: 3 },
    base: 'm3',
    icon: 'beaker',
    pair: ['l', 'gal'],
    blurb: 'Liters, milliliters, US and imperial gallons, cups, tablespoons, fluid ounces.',
    about:
      'Volume is the space a substance occupies. The SI unit is the cubic meter, but the liter (one cubic decimeter) is used far more often. US and imperial units share names but not sizes: a US gallon is 3.785 liters while an imperial gallon is 4.546 liters.',
    units: [
      u('ul', 'µL', 'microliter', 1e-9, { symbols: ['μl', 'μL', 'ul', 'uL', 'µl'], slug: 'microliters' }),
      u('ml', 'mL', 'milliliter', 1e-6, { popular: true, slug: 'ml', symbols: ['ml', 'ML'], desc: 'One thousandth of a liter, the same volume as one cubic centimeter.' }),
      u('cl', 'cL', 'centiliter', 1e-5, { slug: 'cl', symbols: ['cl'], desc: 'One hundredth of a liter, used on drink labels in Europe.' }),
      u('dl', 'dL', 'deciliter', 1e-4, { slug: 'dl', symbols: ['dl'] }),
      u('l', 'L', 'liter', 1e-3, { popular: true, slug: 'liters', symbols: ['l', 'ltr', 'ltrs', 'lt'], desc: 'One cubic decimeter, or 1,000 milliliters.' }),
      u('kl', 'kL', 'kiloliter', 1, { slug: 'kiloliters', symbols: ['kl'] }),
      u('m3', 'm³', 'cubic meter', 1, { popular: true, slug: 'cubic-meters', symbols: ['m3', 'm^3', 'cu m', 'cbm'], names: ['cubic meter', 'cubic meters', 'cubic metre', 'cubic metres'], uses: ['m'], desc: 'The SI unit of volume, equal to 1,000 liters.' }),
      u('cm3', 'cm³', 'cubic centimeter', 1e-6, { slug: 'cubic-cm', symbols: ['cm3', 'cm^3', 'cc', 'ccs'], names: ['cubic centimeter', 'cubic centimeters', 'cubic centimetre', 'cubic centimetres'], uses: ['cm'], desc: 'The same volume as one milliliter. Engine displacement is often given in cc.' }),
      u('mm3', 'mm³', 'cubic millimeter', 1e-9, { slug: 'cubic-mm', symbols: ['mm3', 'mm^3'], uses: ['mm'] }),
      u('in3', 'in³', 'cubic inch', 1.6387064e-5, { system: 'imperial', slug: 'cubic-inches', symbols: ['in3', 'in^3', 'cu in'], names: ['cubic inch', 'cubic inches'], uses: ['in'] }),
      u('ft3', 'ft³', 'cubic foot', 0.028316846592, { system: 'imperial', slug: 'cubic-feet', symbols: ['ft3', 'ft^3', 'cu ft', 'cft'], names: ['cubic foot', 'cubic feet'], uses: ['ft'], desc: 'Exactly 28.316846592 liters.' }),
      u('yd3', 'yd³', 'cubic yard', 0.764554857984, { system: 'imperial', slug: 'cubic-yards', symbols: ['yd3', 'yd^3', 'cu yd'], names: ['cubic yard', 'cubic yards'], uses: ['yd'] }),
      u('tsp', 'tsp', 'teaspoon', 4.92892159375e-6, { system: 'us', popular: true, slug: 'tsp', names: ['teaspoons', 'tea spoon'], desc: 'A US teaspoon: 1/6 US fluid ounce, about 4.93 milliliters.' }),
      u('tbsp', 'tbsp', 'tablespoon', 1.478676478125e-5, { system: 'us', popular: true, slug: 'tbsp', symbols: ['Tbsp', 'tbs', 'Tbs', 'T'], names: ['tablespoons', 'table spoon'], desc: 'A US tablespoon: three teaspoons, about 14.79 milliliters.' }),
      u('floz', 'fl oz', 'US fluid ounce', 2.95735295625e-5, { system: 'us', popular: true, slug: 'fl-oz', symbols: ['floz', 'fl. oz.', 'fl.oz', 'fl oz'], names: ['fluid ounce', 'fluid ounces', 'us fluid ounce', 'us fluid ounces'], desc: 'One 128th of a US gallon, about 29.57 milliliters.' }),
      u('cup', 'cup', 'US cup', 2.365882365e-4, { system: 'us', popular: true, slug: 'cups', names: ['cup', 'cups', 'us cup', 'us cups'], desc: 'A US customary cup: 8 US fluid ounces, about 236.6 milliliters.' }),
      u('pt', 'pt', 'US pint', 4.73176473e-4, { system: 'us', slug: 'pints', names: ['pint', 'pints', 'us pint', 'us pints'], desc: 'Two US cups, about 473 milliliters.' }),
      u('qt', 'qt', 'US quart', 9.46352946e-4, { system: 'us', slug: 'quarts', names: ['quart', 'quarts', 'us quart', 'us quarts'], desc: 'Two US pints, about 946 milliliters.' }),
      u('gal', 'gal', 'US gallon', 3.785411784e-3, { system: 'us', popular: true, slug: 'gallons', names: ['gallon', 'gallons', 'us gallon', 'us gallons'], desc: 'Exactly 231 cubic inches, about 3.785 liters.' }),
      u('impfloz', 'imp fl oz', 'imperial fluid ounce', 2.84130625e-5, { system: 'imperial', slug: 'imperial-fl-oz', names: ['imperial fluid ounce', 'imperial fluid ounces', 'uk fluid ounce', 'uk fluid ounces'] }),
      u('imppt', 'imp pt', 'imperial pint', 5.6826125e-4, { system: 'imperial', slug: 'imperial-pints', names: ['imperial pint', 'imperial pints', 'uk pint', 'uk pints'], desc: 'Twenty imperial fluid ounces, about 568 milliliters: the British pint of beer.' }),
      u('impgal', 'imp gal', 'imperial gallon', 4.54609e-3, { system: 'imperial', slug: 'imperial-gallons', names: ['imperial gallon', 'imperial gallons', 'uk gallon', 'uk gallons'], desc: 'Exactly 4.54609 liters, used in the UK and some Commonwealth countries.' }),
      u('mcup', 'metric cup', 'metric cup', 2.5e-4, { slug: 'metric-cups', names: ['metric cup', 'metric cups'], desc: 'Exactly 250 milliliters, used in Australia, New Zealand and Canada.' }),
      u('bbl', 'bbl', 'oil barrel', 0.158987294928, { system: 'us', slug: 'barrels', names: ['barrel', 'barrels', 'oil barrel', 'oil barrels'], desc: 'Exactly 42 US gallons, about 159 liters, the standard for crude oil.' }),
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    noun: 'temperature',
    dims: { K: 1 },
    base: 'K',
    icon: 'thermo',
    pair: ['C', 'F'],
    blurb: 'Celsius, Fahrenheit, Kelvin and Rankine, including temperature differences.',
    about:
      'Temperature scales do not share a zero, so converting between them needs an offset as well as a factor. Water freezes at 0 °C, 32 °F and 273.15 K. A change of one degree Celsius equals a change of one kelvin and 1.8 degrees Fahrenheit.',
    units: [
      u('C', '°C', 'degree Celsius', 1, {
        popular: true,
        slug: 'celsius',
        plural: 'degrees Celsius',
        symbols: ['℃', 'C', 'c', 'degC', '° C'],
        names: ['celsius', 'centigrade', 'degrees celsius', 'degree celsius', 'deg c'],
        toBase: (v) => v + 273.15,
        fromBase: (v) => v - 273.15,
        deltaFactor: 1,
        desc: 'Water freezes at 0 °C and boils at 100 °C at sea level. A step of one degree equals one kelvin.',
      }),
      u('F', '°F', 'degree Fahrenheit', 1, {
        system: 'imperial',
        popular: true,
        slug: 'fahrenheit',
        plural: 'degrees Fahrenheit',
        symbols: ['℉', 'F', 'f', 'degF', '° F'],
        names: ['fahrenheit', 'degrees fahrenheit', 'degree fahrenheit', 'deg f'],
        toBase: (v) => ((v + 459.67) * 5) / 9,
        fromBase: (v) => (v * 9) / 5 - 459.67,
        deltaFactor: 5 / 9,
        desc: 'Water freezes at 32 °F and boils at 212 °F at sea level. Used for everyday temperatures in the US.',
      }),
      u('K', 'K', 'kelvin', 1, {
        popular: true,
        slug: 'kelvin',
        plural: 'kelvins',
        names: ['kelvin', 'kelvins', 'degrees kelvin'],
        toBase: (v) => v,
        fromBase: (v) => v,
        deltaFactor: 1,
        desc: 'The SI base unit of temperature. Zero kelvin is absolute zero; the step size matches the Celsius degree.',
      }),
      u('R', '°R', 'degree Rankine', 1, {
        system: 'imperial',
        slug: 'rankine',
        plural: 'degrees Rankine',
        symbols: ['°Ra', 'R'],
        names: ['rankine', 'degrees rankine'],
        toBase: (v) => (v * 5) / 9,
        fromBase: (v) => (v * 9) / 5,
        deltaFactor: 5 / 9,
        desc: 'An absolute scale with Fahrenheit-sized degrees, used in some US engineering work.',
      }),
    ],
  },
  {
    id: 'area',
    name: 'Area',
    noun: 'area',
    dims: { L: 2 },
    base: 'm2',
    icon: 'area',
    pair: ['sqft', 'm2'],
    blurb: 'Square feet, square meters, acres, hectares and square miles for land and property.',
    about:
      'Area measures a two-dimensional surface. The SI unit is the square meter. Property is often measured in square feet, while land uses acres or hectares: one hectare is 10,000 square meters, about 2.471 acres.',
    units: [
      u('mm2', 'mm²', 'square millimeter', 1e-6, { slug: 'sq-mm', symbols: ['mm2', 'mm^2', 'sq mm'], names: ['square millimeter', 'square millimeters', 'square millimetre', 'square millimetres'], uses: ['mm'] }),
      u('cm2', 'cm²', 'square centimeter', 1e-4, { slug: 'sq-cm', symbols: ['cm2', 'cm^2', 'sq cm'], names: ['square centimeter', 'square centimeters', 'square centimetre', 'square centimetres'], uses: ['cm'] }),
      u('m2', 'm²', 'square meter', 1, { popular: true, slug: 'sq-m', symbols: ['m2', 'm^2', 'sq m', 'sqm', 'sq.m'], names: ['square meter', 'square meters', 'square metre', 'square metres'], uses: ['m'], desc: 'The SI unit of area: a square one meter on each side, about 10.764 square feet.' }),
      u('are', 'a', 'are', 100, { slug: 'ares', names: ['ares'], desc: 'One hundred square meters.' }),
      u('ha', 'ha', 'hectare', 1e4, { popular: true, slug: 'hectares', desc: 'Ten thousand square meters, about 2.471 acres.' }),
      u('km2', 'km²', 'square kilometer', 1e6, { popular: true, slug: 'sq-km', symbols: ['km2', 'km^2', 'sq km'], names: ['square kilometer', 'square kilometers', 'square kilometre', 'square kilometres'], uses: ['km'] }),
      u('in2', 'in²', 'square inch', 6.4516e-4, { system: 'imperial', slug: 'sq-in', symbols: ['in2', 'in^2', 'sq in'], names: ['square inch', 'square inches'], uses: ['in'] }),
      u('sqft', 'ft²', 'square foot', 0.09290304, { system: 'imperial', popular: true, slug: 'sq-ft', symbols: ['ft2', 'ft^2', 'sq ft', 'sqft', 'sq.ft', 'sf'], names: ['square foot', 'square feet'], uses: ['ft'], desc: 'A square one foot on each side: exactly 0.09290304 square meters.' }),
      u('yd2', 'yd²', 'square yard', 0.83612736, { system: 'imperial', slug: 'sq-yd', symbols: ['yd2', 'yd^2', 'sq yd'], names: ['square yard', 'square yards'], uses: ['yd'] }),
      u('ac', 'ac', 'acre', 4046.8564224, { system: 'imperial', popular: true, slug: 'acres', desc: 'Exactly 43,560 square feet, about 4,047 square meters.' }),
      u('mi2', 'mi²', 'square mile', 2589988.110336, { system: 'imperial', slug: 'sq-mi', symbols: ['mi2', 'mi^2', 'sq mi'], names: ['square mile', 'square miles'], uses: ['mi'], desc: 'Exactly 640 acres, about 2.59 square kilometers.' }),
    ],
  },
  {
    id: 'speed',
    name: 'Speed',
    noun: 'speed',
    dims: { L: 1, T: -1 },
    base: 'mps',
    icon: 'gauge',
    pair: ['kmh', 'mph'],
    blurb: 'Kilometers per hour, miles per hour, meters per second, knots and Mach.',
    about:
      'Speed is distance travelled per unit of time. The SI unit is the meter per second. Road speeds use km/h or mph, and a knot is one nautical mile per hour.',
    units: [
      u('mps', 'm/s', 'meter per second', 1, { uses: ['m', 's'], popular: true, slug: 'm-s', plural: 'meters per second', symbols: ['mps', 'm s-1'], names: ['meter per second', 'meters per second', 'metre per second', 'metres per second'], desc: 'The SI unit of speed. One meter per second is 3.6 km/h.' }),
      u('kmh', 'km/h', 'kilometer per hour', 1 / 3.6, { uses: ['km', 'h'], popular: true, slug: 'kmh', plural: 'kilometers per hour', symbols: ['kph', 'kmph', 'kmh', 'km/hr', 'kmh-1'], names: ['kilometer per hour', 'kilometers per hour', 'kilometre per hour', 'kilometres per hour', 'km per hour'], desc: 'The road speed unit in most of the world.' }),
      u('mph', 'mph', 'mile per hour', 0.44704, { uses: ['mi', 'h'], system: 'imperial', popular: true, slug: 'mph', plural: 'miles per hour', symbols: ['mi/h', 'mi/hr', 'MPH'], names: ['mile per hour', 'miles per hour'], desc: 'Exactly 0.44704 meters per second, the road speed unit in the US and UK.' }),
      u('fps', 'ft/s', 'foot per second', 0.3048, { uses: ['ft', 's'], system: 'imperial', slug: 'ft-s', plural: 'feet per second', symbols: ['fps', 'ft/sec'], names: ['foot per second', 'feet per second'] }),
      u('kn', 'kn', 'knot', 1852 / 3600, { system: 'other', popular: true, slug: 'knots', symbols: ['kt', 'kts', 'kn'], desc: 'One nautical mile per hour, about 1.852 km/h. Used at sea and in aviation.' }),
      u('kms', 'km/s', 'kilometer per second', 1000, { uses: ['km', 's'], slug: 'km-s', plural: 'kilometers per second', names: ['kilometer per second', 'kilometers per second', 'kilometre per second', 'kilometres per second'] }),
      u('mach', 'Mach', 'Mach', 340.29, { system: 'other', slug: 'mach', plural: 'Mach', symbols: ['Ma'], names: ['mach'], desc: 'The speed of sound. This converter uses 340.29 m/s, its value in dry air at 15 °C at sea level; the real figure changes with temperature.' }),
      u('c', 'c', 'speed of light', 299792458, { system: 'other', slug: 'speed-of-light', plural: 'times the speed of light', names: ['speed of light', 'lightspeed'], desc: 'Exactly 299,792,458 meters per second.' }),
    ],
  },
  {
    id: 'time',
    name: 'Time & duration',
    short: 'Time',
    noun: 'time',
    dims: { T: 1 },
    base: 's',
    icon: 'clock',
    pair: ['h', 'min'],
    blurb: 'Seconds, minutes, hours, days, weeks, months, years, decades and centuries.',
    about:
      'The second is the SI base unit of time, defined by the caesium-133 atom. Months and years vary in length, so this converter uses Gregorian averages: a year of 365.2425 days and a month of 30.436875 days. For exact calendar spans between two dates, use the date calculator.',
    units: [
      u('ns', 'ns', 'nanosecond', 1e-9, { slug: 'nanoseconds' }),
      u('us', 'µs', 'microsecond', 1e-6, { slug: 'microseconds', symbols: ['μs', 'us'] }),
      u('ms', 'ms', 'millisecond', 1e-3, { popular: true, slug: 'milliseconds', symbols: ['msec'], desc: 'One thousandth of a second.' }),
      u('s', 's', 'second', 1, { popular: true, slug: 'seconds', symbols: ['sec', 'secs'], desc: 'The SI base unit of time, defined by 9,192,631,770 cycles of the caesium-133 hyperfine transition.' }),
      u('min', 'min', 'minute', 60, { popular: true, slug: 'minutes', symbols: ['mins'], desc: 'Sixty seconds.' }),
      u('h', 'h', 'hour', 3600, { popular: true, slug: 'hours', symbols: ['hr', 'hrs'], desc: 'Sixty minutes, or 3,600 seconds.' }),
      u('d', 'd', 'day', 86400, { popular: true, slug: 'days', desc: 'Twenty-four hours, or 86,400 seconds.' }),
      u('wk', 'wk', 'week', 604800, { popular: true, slug: 'weeks', symbols: ['wks'], desc: 'Seven days.' }),
      u('fortnight', 'fortnight', 'fortnight', 1209600, { slug: 'fortnights', desc: 'Fourteen days.' }),
      u('mo', 'mo', 'month', 2629746, { popular: true, slug: 'months', symbols: ['mos', 'mth', 'mths'], desc: 'An average Gregorian month of 30.436875 days (one twelfth of 365.2425 days).' }),
      u('yr', 'yr', 'year', 31556952, { popular: true, slug: 'years', symbols: ['yrs', 'y'], desc: 'An average Gregorian year of 365.2425 days.' }),
      u('decade', 'decade', 'decade', 315569520, { slug: 'decades', desc: 'Ten years.' }),
      u('century', 'century', 'century', 3155695200, { slug: 'centuries', plural: 'centuries', desc: 'One hundred years.' }),
      u('millennium', 'millennium', 'millennium', 31556952000, { slug: 'millennia', plural: 'millennia', names: ['millenniums'], desc: 'One thousand years.' }),
    ],
  },
  {
    id: 'data',
    name: 'Data storage',
    short: 'Data',
    noun: 'file size',
    dims: { D: 1 },
    base: 'bit',
    icon: 'disk',
    pair: ['GB', 'MB'],
    blurb: 'Bytes, KB, MB, GB, TB and bits, with both decimal (1000) and binary (1024) prefixes.',
    about:
      'Digital storage is counted in bits and bytes (1 byte = 8 bits). There are two ways to count bytes. Decimal (SI) prefixes step by 1,000: 1 KB = 1,000 B and 1 GB = 1,000 MB, which is how drive makers, macOS, iOS and Android report sizes. Binary prefixes step by 1,024: 1 KB = 1,024 B and 1 GB = 1,024 MB, which is how Windows and RAM count (the IEC names for these are KiB, MiB and GiB). Bits are always decimal: 1 Kb = 1,000 b.',
    units: [
      u('bit', 'bit', 'bit', 1, { popular: true, slug: 'bits', symbols: ['b', 'bits'], desc: 'A single binary digit, 0 or 1.' }),
      u('nibble', 'nibble', 'nibble', 4, { slug: 'nibbles', desc: 'Four bits, one hexadecimal digit.' }),
      u('B', 'B', 'byte', 8, { popular: true, slug: 'bytes', symbols: ['byte', 'bytes'], desc: 'Eight bits.' }),
      u('kb', 'kb', 'kilobit', 1e3, { slug: 'kilobits', symbols: ['kbit', 'Kb', 'Kbit'], desc: 'One thousand bits.' }),
      u('KB', 'KB', 'kilobyte', 8e3, { binaryFactor: 8 * 1024, popular: true, slug: 'kb', symbols: ['kB', 'KB', 'kilobytes'], names: ['kilobyte'], desc: 'In decimal (SI) mode 1,000 bytes; in binary mode 1,024 bytes, as Windows and RAM count. The unambiguous binary name is kibibyte (KiB).' }),
      u('Mb', 'Mb', 'megabit', 1e6, { slug: 'megabits', symbols: ['Mbit'], desc: 'One million bits. Internet speeds are sold in megabits per second.' }),
      u('MB', 'MB', 'megabyte', 8e6, { binaryFactor: 8 * 1024 ** 2, popular: true, slug: 'mb', symbols: ['mb', 'mB', 'Mbyte'], desc: 'In decimal mode 1,000,000 bytes (1,000 KB); in binary mode 1,048,576 bytes (1,024 KB).' }),
      u('Gb', 'Gb', 'gigabit', 1e9, { slug: 'gigabits', symbols: ['Gbit'] }),
      u('GB', 'GB', 'gigabyte', 8e9, { binaryFactor: 8 * 1024 ** 3, popular: true, slug: 'gb', symbols: ['gb', 'gB', 'Gbyte', 'gig', 'gigs'], desc: 'In decimal mode 1,000,000,000 bytes (1,000 MB); in binary mode 1,073,741,824 bytes (1,024 MB).' }),
      u('Tb', 'Tb', 'terabit', 1e12, { slug: 'terabits', symbols: ['Tbit'] }),
      u('TB', 'TB', 'terabyte', 8e12, { binaryFactor: 8 * 1024 ** 4, popular: true, slug: 'tb', symbols: ['tb', 'tB'], desc: 'In decimal mode 1,000 GB, which is how drives are sold; in binary mode 1,024 GB.' }),
      u('PB', 'PB', 'petabyte', 8e15, { binaryFactor: 8 * 1024 ** 5, slug: 'pb', symbols: ['pb'], desc: 'In decimal mode 1,000 TB; in binary mode 1,024 TB.' }),
      u('EB', 'EB', 'exabyte', 8e18, { binaryFactor: 8 * 1024 ** 6, slug: 'exabytes' }),
      u('KiB', 'KiB', 'kibibyte', 8 * 1024, { slug: 'kib', symbols: ['kib'], desc: 'Exactly 1,024 bytes (binary prefix).' }),
      u('MiB', 'MiB', 'mebibyte', 8 * 1024 ** 2, { slug: 'mib', symbols: ['mib'], desc: 'Exactly 1,048,576 bytes, or 1,024 KiB.' }),
      u('GiB', 'GiB', 'gibibyte', 8 * 1024 ** 3, { slug: 'gib', symbols: ['gib'], desc: 'Exactly 1,073,741,824 bytes, or 1,024 MiB. What Windows displays as GB.' }),
      u('TiB', 'TiB', 'tebibyte', 8 * 1024 ** 4, { slug: 'tib', symbols: ['tib'], desc: 'Exactly 1,024 GiB.' }),
      u('PiB', 'PiB', 'pebibyte', 8 * 1024 ** 5, { slug: 'pib' }),
    ],
  },
  {
    id: 'datarate',
    name: 'Data transfer rate',
    short: 'Bandwidth',
    noun: 'bandwidth',
    dims: { D: 1, T: -1 },
    base: 'bps',
    icon: 'wifi',
    pair: ['Mbps', 'MBps'],
    blurb: 'Mbps vs MB/s, Gbps, kbps and more: internet speed versus download speed.',
    about:
      'Network speeds are sold in bits per second, which are always decimal (1 Mbps = 1,000 kbps). Download dialogs show bytes per second, which some apps count in decimal (1 MB/s = 1,000 KB/s) and others in binary (1 MB/s = 1,024 KB/s). Because a byte is 8 bits, a 100 Mbps connection tops out around 12.5 MB/s (11.9 binary MB/s) before protocol overhead.',
    units: [
      u('bps', 'bps', 'bit per second', 1, { uses: ['bit', 's'], slug: 'bps', plural: 'bits per second', symbols: ['bit/s', 'b/s'], names: ['bits per second'] }),
      u('kbps', 'kbps', 'kilobit per second', 1e3, { uses: ['kb', 's'], slug: 'kbps', plural: 'kilobits per second', symbols: ['Kbps', 'kbit/s', 'kb/s'], names: ['kilobits per second'] }),
      u('Mbps', 'Mbps', 'megabit per second', 1e6, { uses: ['Mb', 's'], popular: true, slug: 'mbps', plural: 'megabits per second', symbols: ['mbps', 'Mbit/s', 'Mb/s'], names: ['megabits per second'], desc: 'One million bits per second, the usual unit for broadband and Wi-Fi speeds.' }),
      u('Gbps', 'Gbps', 'gigabit per second', 1e9, { uses: ['Gb', 's'], popular: true, slug: 'gbps', plural: 'gigabits per second', symbols: ['gbps', 'Gbit/s', 'Gb/s'], names: ['gigabits per second'] }),
      u('Tbps', 'Tbps', 'terabit per second', 1e12, { slug: 'tbps', plural: 'terabits per second', symbols: ['Tbit/s', 'Tb/s'] }),
      u('Bps', 'B/s', 'byte per second', 8, { uses: ['B', 's'], slug: 'bytes-per-second', plural: 'bytes per second', symbols: ['Bps'], names: ['bytes per second'] }),
      u('KBps', 'KB/s', 'kilobyte per second', 8e3, { binaryFactor: 8 * 1024, uses: ['KB', 's'], popular: true, slug: 'kb-s', plural: 'kilobytes per second', symbols: ['kB/s', 'KBps', 'kBps'], names: ['kilobytes per second'] }),
      u('MBps', 'MB/s', 'megabyte per second', 8e6, { binaryFactor: 8 * 1024 ** 2, uses: ['MB', 's'], popular: true, slug: 'mb-s', plural: 'megabytes per second', symbols: ['MBps', 'MB/sec'], names: ['megabytes per second'], desc: 'One million bytes per second, how browsers and download managers show speed.' }),
      u('GBps', 'GB/s', 'gigabyte per second', 8e9, { binaryFactor: 8 * 1024 ** 3, uses: ['GB', 's'], slug: 'gb-s', plural: 'gigabytes per second', symbols: ['GBps'], names: ['gigabytes per second'] }),
      u('MiBps', 'MiB/s', 'mebibyte per second', 8 * 1024 ** 2, { uses: ['MiB', 's'], slug: 'mib-s', plural: 'mebibytes per second', symbols: ['MiBps'] }),
    ],
  },
  {
    id: 'pressure',
    name: 'Pressure',
    noun: 'pressure',
    dims: { M: 1, L: -1, T: -2 },
    base: 'Pa',
    icon: 'tire',
    pair: ['psi', 'bar'],
    blurb: 'PSI, bar, kPa, atmospheres, mmHg and inHg for tires, weather and gauges.',
    about:
      'Pressure is force per unit area. The SI unit is the pascal, one newton per square meter. Tire pressures are given in psi or bar, weather in hectopascals or millibars, and blood pressure in millimeters of mercury.',
    units: [
      u('Pa', 'Pa', 'pascal', 1, { uses: ['N', 'm2'], slug: 'pascals', symbols: ['pa'], desc: 'The SI unit of pressure: one newton per square meter.' }),
      u('hPa', 'hPa', 'hectopascal', 100, { slug: 'hpa', symbols: ['hpa'], desc: 'One hundred pascals, identical to the millibar. Used in weather reports.' }),
      u('kPa', 'kPa', 'kilopascal', 1e3, { popular: true, slug: 'kpa', symbols: ['kpa'], desc: 'One thousand pascals.' }),
      u('MPa', 'MPa', 'megapascal', 1e6, { slug: 'mpa', symbols: ['mpa'], desc: 'One million pascals, used for material strength.' }),
      u('bar', 'bar', 'bar', 1e5, { popular: true, slug: 'bar', plural: 'bar', names: ['bars'], desc: 'Exactly 100,000 pascals, close to atmospheric pressure at sea level.' }),
      u('mbar', 'mbar', 'millibar', 100, { slug: 'mbar', symbols: ['mb.'] }),
      u('atm', 'atm', 'standard atmosphere', 101325, { popular: true, slug: 'atm', names: ['atmosphere', 'atmospheres'], desc: 'Exactly 101,325 pascals, average sea-level pressure.' }),
      u('psi', 'psi', 'pound per square inch', 6894.757293168361, { uses: ['lbf', 'in2'], system: 'imperial', popular: true, slug: 'psi', plural: 'pounds per square inch', symbols: ['PSI', 'lbf/in2', 'lb/in2'], names: ['pounds per square inch'], desc: 'About 6.895 kilopascals, the usual unit for US tire pressure.' }),
      u('mmHg', 'mmHg', 'millimeter of mercury', 133.322387415, { system: 'other', slug: 'mmhg', plural: 'millimeters of mercury', symbols: ['mmhg'], desc: 'About 133.3 pascals, still the unit for blood pressure.' }),
      u('torr', 'Torr', 'torr', 101325 / 760, { system: 'other', slug: 'torr', plural: 'torr', symbols: ['torr'] }),
      u('inHg', 'inHg', 'inch of mercury', 3386.389, { system: 'imperial', slug: 'inhg', plural: 'inches of mercury', symbols: ['inhg'] }),
    ],
  },
  {
    id: 'energy',
    name: 'Energy',
    noun: 'energy',
    dims: { M: 1, L: 2, T: -2 },
    base: 'J',
    icon: 'bolt',
    pair: ['kcal', 'kJ'],
    blurb: 'Joules, calories, kilocalories, kWh, BTU and electronvolts.',
    about:
      'Energy is the capacity to do work. The SI unit is the joule. Food energy is labelled in kilocalories (Calories with a capital C) or kilojoules, electricity is billed in kilowatt-hours, and heating often uses BTU or therms.',
    units: [
      u('J', 'J', 'joule', 1, { uses: ['W', 's'], popular: true, slug: 'joules', desc: 'The SI unit of energy: one newton acting over one meter.' }),
      u('kJ', 'kJ', 'kilojoule', 1e3, { popular: true, slug: 'kj', symbols: ['kj'], desc: 'One thousand joules. Food labels in Australia and Europe show kJ alongside kcal.' }),
      u('MJ', 'MJ', 'megajoule', 1e6, { slug: 'mj' }),
      u('cal', 'cal', 'calorie', 4.184, { popular: true, slug: 'calories', desc: 'The small (thermochemical) calorie: exactly 4.184 joules.' }),
      u('kcal', 'kcal', 'kilocalorie', 4184, { popular: true, slug: 'kcal', symbols: ['Cal', 'Kcal'], names: ['food calorie', 'food calories', 'kilocalories'], desc: 'One thousand calories, the "Calorie" printed on food labels.' }),
      u('Wh', 'Wh', 'watt-hour', 3600, { uses: ['W', 'h'], slug: 'wh', symbols: ['wh'], names: ['watt hour', 'watt hours'] }),
      u('kWh', 'kWh', 'kilowatt-hour', 3.6e6, { uses: ['kW', 'h'], popular: true, slug: 'kwh', symbols: ['kwh', 'KWh', 'kW h', 'kW·h'], names: ['kilowatt hour', 'kilowatt hours', 'unit of electricity'], desc: 'Exactly 3.6 megajoules: the "unit" on an electricity bill.' }),
      u('MWh', 'MWh', 'megawatt-hour', 3.6e9, { uses: ['MW', 'h'], slug: 'mwh', names: ['megawatt hour', 'megawatt hours'] }),
      u('eV', 'eV', 'electronvolt', 1.602176634e-19, { system: 'other', slug: 'electronvolts', names: ['electron volt', 'electron volts'], desc: 'Exactly 1.602176634 × 10⁻¹⁹ joules, used in atomic and particle physics.' }),
      u('BTU', 'BTU', 'British thermal unit', 1055.05585262, { system: 'imperial', slug: 'btu', symbols: ['Btu', 'btu'], names: ['british thermal unit', 'british thermal units'], desc: 'About 1,055 joules (International Table value), used for heating and cooling.' }),
      u('therm', 'thm', 'therm', 105480400, { system: 'imperial', slug: 'therms', desc: 'The US therm: 100,000 BTU, used for natural gas billing.' }),
      u('ftlbf', 'ft·lbf', 'foot-pound', 1.3558179483314004, { system: 'imperial', slug: 'foot-pounds', symbols: ['ft-lbf', 'ft lbf', 'ftlbf'], names: ['foot pound', 'foot pounds', 'foot-pound', 'foot-pounds'] }),
      u('erg', 'erg', 'erg', 1e-7, { system: 'other', slug: 'ergs' }),
    ],
  },
  {
    id: 'power',
    name: 'Power',
    noun: 'power',
    dims: { M: 1, L: 2, T: -3 },
    base: 'W',
    icon: 'plug',
    pair: ['hp', 'kW'],
    blurb: 'Watts, kilowatts, horsepower (mechanical and metric), BTU/h and tons of cooling.',
    about:
      'Power is the rate at which energy is used or produced. The SI unit is the watt, one joule per second. Engines are rated in horsepower or kilowatts, and air conditioners in BTU per hour or tons of refrigeration.',
    units: [
      u('mW', 'mW', 'milliwatt', 1e-3, { slug: 'milliwatts' }),
      u('W', 'W', 'watt', 1, { uses: ['J', 's'], popular: true, slug: 'watts', symbols: ['w'], desc: 'The SI unit of power: one joule per second.' }),
      u('kW', 'kW', 'kilowatt', 1e3, { uses: ['kJ', 's'], popular: true, slug: 'kw', symbols: ['kw', 'KW'], desc: 'One thousand watts, about 1.341 mechanical horsepower.' }),
      u('MW', 'MW', 'megawatt', 1e6, { slug: 'mw' }),
      u('GW', 'GW', 'gigawatt', 1e9, { slug: 'gw' }),
      u('hp', 'hp', 'horsepower', 745.69987158227022, { system: 'imperial', popular: true, slug: 'hp', plural: 'horsepower', symbols: ['HP', 'bhp'], names: ['horsepower', 'mechanical horsepower'], desc: 'Mechanical (imperial) horsepower: 550 foot-pounds per second, about 745.7 watts.' }),
      u('PS', 'PS', 'metric horsepower', 735.49875, { slug: 'metric-hp', plural: 'metric horsepower', symbols: ['cv', 'CV', 'ch'], names: ['metric horsepower', 'pferdestarke'], desc: 'Exactly 735.49875 watts, used for car engines in Europe and Asia.' }),
      u('BTUh', 'BTU/h', 'BTU per hour', 0.29307107017, { system: 'imperial', slug: 'btu-h', plural: 'BTU per hour', symbols: ['BTU/hr', 'Btu/h', 'btu/h', 'BTUh'], names: ['btu per hour'] }),
      u('TR', 'TR', 'ton of refrigeration', 3516.8528420667, { system: 'imperial', slug: 'tons-of-refrigeration', plural: 'tons of refrigeration', symbols: ['RT'], names: ['ton of refrigeration', 'tons of refrigeration', 'ac ton'], desc: '12,000 BTU per hour, about 3.517 kilowatts; used to size air conditioners.' }),
    ],
  },
  {
    id: 'force',
    name: 'Force',
    noun: 'force',
    dims: { M: 1, L: 1, T: -2 },
    base: 'N',
    icon: 'arrow',
    pair: ['N', 'lbf'],
    blurb: 'Newtons, kilonewtons, pound-force, kilogram-force and dynes.',
    about: 'Force changes the motion of a mass. The SI unit is the newton: the force that accelerates one kilogram by one meter per second squared.',
    units: [
      u('N', 'N', 'newton', 1, { uses: ['kg'], popular: true, slug: 'newtons', desc: 'The SI unit of force: 1 kg·m/s².' }),
      u('kN', 'kN', 'kilonewton', 1e3, { popular: true, slug: 'kilonewtons', symbols: ['kn'] }),
      u('dyn', 'dyn', 'dyne', 1e-5, { system: 'other', slug: 'dynes' }),
      u('lbf', 'lbf', 'pound-force', 4.4482216152605, { uses: ['lb'], system: 'imperial', popular: true, slug: 'lbf', symbols: ['lbf'], names: ['pound force', 'pounds force', 'pound-force'], desc: 'The force of gravity on one pound at standard gravity: about 4.448 newtons.' }),
      u('kgf', 'kgf', 'kilogram-force', 9.80665, { system: 'other', popular: true, slug: 'kgf', symbols: ['kp'], names: ['kilogram force', 'kilograms force', 'kilopond'], desc: 'The force of gravity on one kilogram at standard gravity: exactly 9.80665 newtons.' }),
      u('ozf', 'ozf', 'ounce-force', 0.27801385095378125, { system: 'imperial', slug: 'ozf', names: ['ounce force'] }),
      u('kip', 'kip', 'kip', 4448.2216152605, { system: 'imperial', slug: 'kips', desc: 'One thousand pound-force.' }),
    ],
  },
  {
    id: 'angle',
    name: 'Angle',
    noun: 'angle',
    dims: { A: 1 },
    base: 'rad',
    icon: 'angle',
    pair: ['deg', 'rad'],
    blurb: 'Degrees, radians, gradians, turns, arcminutes and arcseconds.',
    about: 'A full turn is 360 degrees, 2π radians or 400 gradians. The radian is the SI derived unit: the angle that subtends an arc equal in length to the radius.',
    units: [
      u('deg', '°', 'degree', PI / 180, { popular: true, slug: 'degrees', symbols: ['deg', 'degs', '°'], desc: 'One 360th of a full turn.' }),
      u('rad', 'rad', 'radian', 1, { popular: true, slug: 'radians', symbols: ['rads'], desc: 'The angle whose arc equals the radius: about 57.2958 degrees.' }),
      u('grad', 'grad', 'gradian', PI / 200, { slug: 'gradians', symbols: ['gon', 'gons', 'grads'], desc: 'One 400th of a full turn, so a right angle is 100 gradians.' }),
      u('mrad', 'mrad', 'milliradian', 1e-3, { slug: 'milliradians', symbols: ['mil.'] }),
      u('arcmin', 'arcmin', 'arcminute', PI / 10800, { slug: 'arcminutes', names: ['arc minute', 'arc minutes', 'minute of arc'] }),
      u('arcsec', 'arcsec', 'arcsecond', PI / 648000, { slug: 'arcseconds', names: ['arc second', 'arc seconds', 'second of arc'] }),
      u('turn', 'turn', 'turn', 2 * PI, { popular: true, slug: 'turns', symbols: ['rev', 'revs', 'rotation', 'rotations'], names: ['revolution', 'revolutions'] }),
    ],
  },
  {
    id: 'frequency',
    name: 'Frequency',
    noun: 'frequency',
    dims: { T: -1 },
    base: 'Hz',
    icon: 'wave',
    pair: ['Hz', 'rpm'],
    blurb: 'Hertz, kHz, MHz, GHz, RPM and beats per minute.',
    about: 'Frequency counts cycles per second. One hertz is one cycle per second, so 60 RPM is exactly 1 Hz.',
    units: [
      u('Hz', 'Hz', 'hertz', 1, { uses: ['s'], popular: true, slug: 'hz', plural: 'hertz', symbols: ['hz'], desc: 'One cycle per second.' }),
      u('kHz', 'kHz', 'kilohertz', 1e3, { popular: true, slug: 'khz', plural: 'kilohertz', symbols: ['khz'] }),
      u('MHz', 'MHz', 'megahertz', 1e6, { popular: true, slug: 'mhz', plural: 'megahertz', symbols: ['mhz'] }),
      u('GHz', 'GHz', 'gigahertz', 1e9, { popular: true, slug: 'ghz', plural: 'gigahertz', symbols: ['ghz'] }),
      u('THz', 'THz', 'terahertz', 1e12, { slug: 'thz', plural: 'terahertz' }),
      u('rpm', 'rpm', 'revolution per minute', 1 / 60, { popular: true, slug: 'rpm', plural: 'revolutions per minute', symbols: ['RPM', 'r/min'], names: ['revolutions per minute'], desc: 'One turn per minute, one sixtieth of a hertz.' }),
      u('bpm', 'bpm', 'beat per minute', 1 / 60, { slug: 'bpm', plural: 'beats per minute', symbols: ['BPM'], names: ['beats per minute'] }),
    ],
  },
  {
    id: 'fuel',
    name: 'Fuel economy',
    short: 'Fuel',
    noun: 'fuel economy',
    dims: { L: -2 },
    base: 'kmpl',
    icon: 'fuel',
    pair: ['mpg', 'l100km'],
    calc: false,
    blurb: 'MPG (US and UK), liters per 100 km and km per liter.',
    about:
      'Fuel economy is either distance per volume (mpg, km/L), where higher is better, or volume per distance (L/100 km), where lower is better. Converting between the two families is an inversion, not a multiplication. US and UK mpg differ because their gallons differ.',
    units: [
      u('kmpl', 'km/L', 'kilometer per liter', 1, { popular: true, slug: 'km-l', plural: 'kilometers per liter', symbols: ['kmpl', 'km/l', 'kpl'], names: ['kilometers per liter', 'kilometres per litre'], toBase: (v) => v, fromBase: (v) => v, calc: false }),
      u('l100km', 'L/100 km', 'liter per 100 km', 1, { popular: true, slug: 'l-100km', plural: 'liters per 100 km', symbols: ['L/100km', 'l/100km', 'l/100 km'], names: ['liters per 100 km', 'litres per 100 km'], toBase: (v) => 100 / v, fromBase: (v) => 100 / v, calc: false, desc: 'Liters of fuel used to drive 100 kilometers. Lower is better.' }),
      u('mpg', 'mpg', 'mile per US gallon', 1, { system: 'us', popular: true, slug: 'mpg', plural: 'miles per US gallon', symbols: ['MPG', 'mpg US'], names: ['miles per gallon', 'us mpg'], toBase: (v) => (v * 1.609344) / 3.785411784, fromBase: (v) => (v * 3.785411784) / 1.609344, calc: false, desc: 'Miles driven per US gallon, the fuel economy figure on US window stickers.' }),
      u('mpguk', 'mpg (UK)', 'mile per imperial gallon', 1, { system: 'imperial', popular: true, slug: 'mpg-uk', plural: 'miles per imperial gallon', symbols: ['mpg UK', 'mpg imp'], names: ['uk mpg', 'imperial mpg'], toBase: (v) => (v * 1.609344) / 4.54609, fromBase: (v) => (v * 4.54609) / 1.609344, calc: false, desc: 'Miles per imperial gallon, used in the UK. About 20% higher than the US figure for the same car.' }),
      u('mpl', 'mi/L', 'mile per liter', 1, { slug: 'mi-l', plural: 'miles per liter', toBase: (v) => v * 1.609344, fromBase: (v) => v / 1.609344, calc: false }),
    ],
  },
  {
    id: 'density',
    name: 'Density',
    noun: 'density',
    dims: { M: 1, L: -3 },
    base: 'kgm3',
    icon: 'cube',
    pair: ['gcm3', 'kgm3'],
    blurb: 'kg/m³, g/cm³, g/mL, lb/ft³ and lb/gal.',
    about: 'Density is mass per unit volume. Water is about 1 g/cm³, or 1,000 kg/m³.',
    units: [
      u('kgm3', 'kg/m³', 'kilogram per cubic meter', 1, { uses: ['kg', 'm3'], popular: true, slug: 'kg-m3', plural: 'kilograms per cubic meter', symbols: ['kg/m3', 'kg/m^3'] }),
      u('gcm3', 'g/cm³', 'gram per cubic centimeter', 1000, { uses: ['g', 'cm3'], popular: true, slug: 'g-cm3', plural: 'grams per cubic centimeter', symbols: ['g/cm3', 'g/cc', 'g/cm^3'] }),
      u('gml', 'g/mL', 'gram per milliliter', 1000, { uses: ['g', 'ml'], slug: 'g-ml', plural: 'grams per milliliter', symbols: ['g/ml'] }),
      u('gl', 'g/L', 'gram per liter', 1, { uses: ['g', 'l'], slug: 'g-l', plural: 'grams per liter', symbols: ['g/l'] }),
      u('kgl', 'kg/L', 'kilogram per liter', 1000, { uses: ['kg', 'l'], slug: 'kg-l', plural: 'kilograms per liter', symbols: ['kg/l'] }),
      u('lbft3', 'lb/ft³', 'pound per cubic foot', 16.018463373960138, { uses: ['lb', 'ft3'], system: 'imperial', popular: true, slug: 'lb-ft3', plural: 'pounds per cubic foot', symbols: ['lb/ft3', 'pcf'] }),
      u('lbin3', 'lb/in³', 'pound per cubic inch', 27679.904710203125, { system: 'imperial', slug: 'lb-in3', plural: 'pounds per cubic inch', symbols: ['lb/in3'] }),
      u('lbgal', 'lb/gal', 'pound per US gallon', 119.82642731689663, { system: 'us', slug: 'lb-gal', plural: 'pounds per US gallon', symbols: ['ppg'] }),
    ],
  },
  {
    id: 'torque',
    name: 'Torque',
    noun: 'torque',
    dims: { M: 1, L: 2, T: -2 },
    base: 'Nm',
    icon: 'wrench',
    pair: ['Nm', 'lbft'],
    blurb: 'Newton-meters, pound-feet, pound-inches and kilogram-force meters.',
    about: 'Torque is rotational force. It shares dimensions with energy but describes something different, so it has its own units: the newton-meter, and pound-foot in the US.',
    units: [
      u('Nm', 'N·m', 'newton-meter', 1, { uses: ['N', 'm'], popular: true, slug: 'newton-meters', plural: 'newton-meters', symbols: ['Nm', 'N m', 'N-m', 'N.m'], names: ['newton meter', 'newton meters', 'newton metre', 'newton metres'] }),
      u('kNm', 'kN·m', 'kilonewton-meter', 1e3, { slug: 'knm', plural: 'kilonewton-meters', symbols: ['kNm', 'kN m'] }),
      u('lbft', 'lb·ft', 'pound-foot', 1.3558179483314004, { uses: ['lbf', 'ft'], system: 'imperial', popular: true, slug: 'lb-ft', plural: 'pound-feet', symbols: ['lbft', 'lb-ft', 'lb ft', 'lbf·ft', 'lbf-ft', 'lbf ft'], names: ['pound foot', 'pound feet', 'pound-feet'] }),
      u('lbin', 'lb·in', 'pound-inch', 0.1129848290276167, { system: 'imperial', slug: 'lb-in', plural: 'pound-inches', symbols: ['lbin', 'lb-in', 'in-lb', 'in·lb', 'lbf·in'], names: ['pound inch', 'pound inches', 'inch pounds', 'inch-pounds'] }),
      u('kgfm', 'kgf·m', 'kilogram-force meter', 9.80665, { slug: 'kgf-m', plural: 'kilogram-force meters', symbols: ['kgfm', 'kgf m', 'kgm'] }),
    ],
  },
  {
    id: 'acceleration',
    name: 'Acceleration',
    noun: 'acceleration',
    dims: { L: 1, T: -2 },
    base: 'mps2',
    icon: 'rocket',
    pair: ['g0', 'mps2'],
    blurb: 'm/s², standard gravity (g), ft/s² and gal.',
    about: 'Acceleration is change in speed per unit time. Standard gravity, g, is defined as exactly 9.80665 m/s².',
    units: [
      u('mps2', 'm/s²', 'meter per second squared', 1, { uses: ['m', 's'], popular: true, slug: 'm-s2', plural: 'meters per second squared', symbols: ['m/s2', 'm/s^2'] }),
      u('fps2', 'ft/s²', 'foot per second squared', 0.3048, { uses: ['ft', 's'], system: 'imperial', popular: true, slug: 'ft-s2', plural: 'feet per second squared', symbols: ['ft/s2', 'ft/s^2'] }),
      u('g0', 'g', 'standard gravity', 9.80665, { popular: true, slug: 'g-force', plural: 'g', symbols: ['gn', 'G', 'g0'], names: ['g-force', 'g force', 'standard gravity'], calc: false, desc: 'Exactly 9.80665 m/s².' }),
      u('gal', 'Gal', 'gal', 0.01, { system: 'other', slug: 'gals', symbols: ['Gal'], calc: false }),
    ],
  },
  {
    id: 'flow',
    name: 'Flow rate',
    noun: 'flow rate',
    dims: { L: 3, T: -1 },
    base: 'm3s',
    icon: 'drop',
    pair: ['lpm', 'gpm'],
    blurb: 'Liters per minute, gallons per minute, m³/h and CFM.',
    about: 'Volumetric flow rate is volume per unit time, used for pumps, taps, HVAC and ventilation.',
    units: [
      u('mlmin', 'mL/min', 'milliliter per minute', 1e-6 / 60, { uses: ['ml', 'min'], slug: 'ml-min', plural: 'milliliters per minute', symbols: ['ml/min'] }),
      u('ls', 'L/s', 'liter per second', 1e-3, { uses: ['l', 's'], slug: 'l-s', plural: 'liters per second', symbols: ['l/s', 'lps'] }),
      u('lpm', 'L/min', 'liter per minute', 1e-3 / 60, { uses: ['l', 'min'], popular: true, slug: 'l-min', plural: 'liters per minute', symbols: ['l/min', 'lpm', 'LPM'] }),
      u('lph', 'L/h', 'liter per hour', 1e-3 / 3600, { uses: ['l', 'h'], slug: 'l-h', plural: 'liters per hour', symbols: ['l/h', 'lph'] }),
      u('m3s', 'm³/s', 'cubic meter per second', 1, { uses: ['m3', 's'], slug: 'm3-s', plural: 'cubic meters per second', symbols: ['m3/s', 'cumec'] }),
      u('m3h', 'm³/h', 'cubic meter per hour', 1 / 3600, { uses: ['m3', 'h'], popular: true, slug: 'm3-h', plural: 'cubic meters per hour', symbols: ['m3/h', 'cmh'] }),
      u('gpm', 'gpm', 'US gallon per minute', 3.785411784e-3 / 60, { uses: ['gal', 'min'], system: 'us', popular: true, slug: 'gpm', plural: 'US gallons per minute', symbols: ['GPM', 'gal/min'], names: ['gallons per minute'] }),
      u('cfm', 'CFM', 'cubic foot per minute', 0.028316846592 / 60, { uses: ['ft3', 'min'], system: 'imperial', popular: true, slug: 'cfm', plural: 'cubic feet per minute', symbols: ['cfm', 'ft3/min'], names: ['cubic feet per minute'] }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Indexes

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** unit key "category:id" → unit, and back-reference to its category */
export const UNIT_BY_KEY = new Map();
for (const cat of CATEGORIES) {
  for (const unit of cat.units) {
    unit.category = cat.id;
    unit.dims = cat.dims;
    unit.key = `${cat.id}:${unit.id}`;
    if (cat.calc === false) unit.calc = false;
    UNIT_BY_KEY.set(unit.key, unit);
  }
}

export function getUnit(categoryId, unitId) {
  return UNIT_BY_KEY.get(`${categoryId}:${unitId}`);
}

/** Every alias a unit answers to, split by how strictly case must match. */
export function aliasesOf(unit) {
  const exact = new Set([unit.symbol, unit.id, ...unit.symbols]);
  const loose = new Set();
  for (const n of [unit.name, unit.plural, ...unit.names]) {
    for (const s of spellings(n.toLowerCase())) loose.add(s);
  }
  return { exact: [...exact], loose: [...loose] };
}

export function isAffine(unit) {
  return typeof unit.toBase === 'function';
}

/**
 * How bytes are counted. Decimal (SI): 1 KB = 1,000 B. Binary (JEDEC, as
 * Windows and RAM count): 1 KB = 1,024 B. Only byte-based units with a
 * binaryFactor change; bits and the IEC units (KiB, MiB…) never do.
 */
export const DATA_MODES = ['decimal', 'binary'];

export function effectiveFactor(unit, mode) {
  return mode === 'binary' && unit.binaryFactor ? unit.binaryFactor : unit.factor;
}

const BYTE_LOWER = { KB: 'B', MB: 'KB', GB: 'MB', TB: 'GB', PB: 'TB', EB: 'PB', KBps: 'B/s', MBps: 'KB/s', GBps: 'MB/s' };

/** "1,024 KB" for MB in binary mode: what one step of this unit is worth. */
export function sizeHint(unit, mode) {
  const lower = BYTE_LOWER[unit.id];
  return lower ? `${mode === 'binary' ? '1,024' : '1,000'} ${lower}` : '';
}

/** Picker group for data units, so bytes, bits and IEC units read apart. */
export function dataGroup(unit, mode) {
  if (unit.category !== 'data' && unit.category !== 'datarate') return null;
  if (/iB(ps)?$/.test(unit.id)) return 'IEC binary · always 1,024';
  if (unit.binaryFactor || unit.id === 'B' || unit.id === 'Bps') return `Bytes · ${mode === 'binary' ? '1,024' : '1,000'}-based`;
  return 'Bits · always 1,000';
}

const GROUP_RANK = (g) => (g.startsWith('Bytes') ? 0 : g.startsWith('Bits') ? 1 : 2);

/** Data units ordered bytes, bits, IEC, keeping their size order inside each group. */
export function sortDataUnits(units, mode) {
  return [...units].sort((a, b) => GROUP_RANK(dataGroup(a, mode)) - GROUP_RANK(dataGroup(b, mode)) || a.factor - b.factor);
}

/** Whether the byte counting mode changes anything for this category. */
export function hasDataModes(category) {
  return category.units.some((u) => u.binaryFactor);
}

/** Convert a plain number between two units of the same category. */
export function convert(value, from, to, mode) {
  if (from === to) return value;
  const base = from.toBase ? from.toBase(value) : value * effectiveFactor(from, mode);
  return to.fromBase ? to.fromBase(base) : base / effectiveFactor(to, mode);
}

/** Linear factor "1 from = k to", or null for offset / inverse scales. */
export function linearFactor(from, to, mode) {
  if (from.toBase || to.toBase) return null;
  return effectiveFactor(from, mode) / effectiveFactor(to, mode);
}
