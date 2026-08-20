// Wakh Reek — les 6 filières officielles du marché.
// Chaque boutique choisit UNE filière. Utilisé sur l'accueil, le marché
// et le formulaire de création de boutique.
export const CATEGORIES = [
  { id: 'medecine-traditionnelle', label: 'Médecine traditionnelle', emoji: '🌿' },
  { id: 'tourisme', label: 'Tourisme', emoji: '🏖️' },
  { id: 'artisanats-marocain', label: 'Artisanats Marocain', emoji: '🏺' },
  { id: 'shop-shopify', label: 'Shop Shopify', emoji: '🛍️' },
  { id: 'khamsa-freelance', label: 'Khamsa Freelance', emoji: '💼' },
  { id: 'autres-commercants', label: 'Autres commerçants', emoji: '🏪' },
];

export const CATEGORY_ALL = { id: 'toutes', label: 'Toutes', emoji: '✨' };

// Vérifie si la catégorie libre d'une boutique correspond à une filière.
export function categoryMatches(shopCategory, categoryLabel) {
  const a = String(shopCategory || '').trim().toLowerCase();
  const b = String(categoryLabel || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
