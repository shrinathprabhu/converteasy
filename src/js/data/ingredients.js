// Cup ↔ gram conversion needs a density, because a cup of flour weighs about
// half a cup of honey. Figures are grams per US cup (236.6 mL) for the usual
// spoon-and-level method, rounded as common baking references print them.
// Real values vary with brand, sifting and packing, so the UI says so.

export const INGREDIENTS = [
  { id: 'flour', name: 'All-purpose flour', gPerCup: 120, slug: 'flour', group: 'Flours & starches' },
  { id: 'bread-flour', name: 'Bread flour', gPerCup: 127, slug: 'bread-flour', group: 'Flours & starches' },
  { id: 'cake-flour', name: 'Cake flour', gPerCup: 114, slug: 'cake-flour', group: 'Flours & starches' },
  { id: 'wholewheat', name: 'Whole wheat flour', gPerCup: 120, slug: 'whole-wheat-flour', group: 'Flours & starches' },
  { id: 'almond-flour', name: 'Almond flour', gPerCup: 96, slug: 'almond-flour', group: 'Flours & starches' },
  { id: 'cornstarch', name: 'Cornstarch', gPerCup: 128, slug: 'cornstarch', group: 'Flours & starches' },
  { id: 'cocoa', name: 'Cocoa powder', gPerCup: 85, slug: 'cocoa-powder', group: 'Flours & starches' },
  { id: 'sugar', name: 'Granulated sugar', gPerCup: 200, slug: 'sugar', group: 'Sugars & syrups' },
  { id: 'brown-sugar', name: 'Brown sugar (packed)', gPerCup: 220, slug: 'brown-sugar', group: 'Sugars & syrups' },
  { id: 'powdered-sugar', name: 'Powdered sugar', gPerCup: 120, slug: 'powdered-sugar', group: 'Sugars & syrups' },
  { id: 'honey', name: 'Honey', gPerCup: 340, slug: 'honey', group: 'Sugars & syrups' },
  { id: 'maple-syrup', name: 'Maple syrup', gPerCup: 322, slug: 'maple-syrup', group: 'Sugars & syrups' },
  { id: 'butter', name: 'Butter', gPerCup: 227, slug: 'butter', group: 'Fats & dairy' },
  { id: 'oil', name: 'Vegetable oil', gPerCup: 218, slug: 'oil', group: 'Fats & dairy' },
  { id: 'milk', name: 'Milk', gPerCup: 244, slug: 'milk', group: 'Fats & dairy' },
  { id: 'cream', name: 'Heavy cream', gPerCup: 238, slug: 'heavy-cream', group: 'Fats & dairy' },
  { id: 'yogurt', name: 'Plain yogurt', gPerCup: 245, slug: 'yogurt', group: 'Fats & dairy' },
  { id: 'water', name: 'Water', gPerCup: 236.6, slug: 'water', group: 'Liquids' },
  { id: 'rice', name: 'Rice (uncooked, white)', gPerCup: 185, slug: 'rice', group: 'Grains & more' },
  { id: 'oats', name: 'Rolled oats', gPerCup: 90, slug: 'oats', group: 'Grains & more' },
  { id: 'salt', name: 'Table salt', gPerCup: 292, slug: 'salt', group: 'Grains & more' },
  { id: 'choc-chips', name: 'Chocolate chips', gPerCup: 170, slug: 'chocolate-chips', group: 'Grains & more' },
  { id: 'peanut-butter', name: 'Peanut butter', gPerCup: 258, slug: 'peanut-butter', group: 'Grains & more' },
];

export const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export const US_CUP_ML = 236.5882365;

/** Grams per milliliter. */
export function density(ing) {
  return ing.gPerCup / US_CUP_ML;
}

/** Volume units offered in the cooking converter (volume category ids). */
export const COOK_VOLUME = ['cup', 'mcup', 'tbsp', 'tsp', 'floz', 'ml', 'l'];
/** Mass units offered (mass category ids). */
export const COOK_MASS = ['g', 'kg', 'oz', 'lb'];
