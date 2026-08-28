/**
 * The golden corpus for the OWM DSL (`docs/adr/0012`, "a golden corpus,
 * checked in").
 *
 * A file Labre did NOT write is the only interesting case for a reader, and the
 * first of these is exactly that: it is the value chain a real session produced
 * through labre-mcp, copied byte for byte from
 * `Labre-mcp/tea-shop-2026-value-chain.owm`. Everything about it that is
 * awkward is awkward because a real file is:
 *
 * - names quoted, with spaces, commas, slashes and accents in them;
 * - an `anchor` with **no coordinate pair at all**, which is D4's inverted case
 *   and half the maps in the wild;
 * - links written between quoted names on both sides;
 * - blank lines grouping the statements, which no writer can give back.
 *
 * Kept as a TypeScript module rather than a `.owm` beside it so the suite reads
 * it with no loader and no build step — the bytes are the point, not the file
 * system.
 */

/** 26 components, one coordinate-less anchor, 30 links, one title. */
export const TEA_SHOP_OWM = `title Tea Shop moderne 2026 - chaine de valeur

anchor Client

component "Moment the premium, rapide et personnalise" [0.95, 0.86]
component "Confiance qualite, origine et sante" [0.91, 0.78]
component "Commande omnicanale sans friction" [0.88, 0.72]
component "Experience boutique et communaute" [0.84, 0.66]

component "Menu boissons chaudes/froides" [0.76, 0.66]
component "Personnalisation gout, sucre, lait, temperature" [0.72, 0.58]
component "Conseil expert et storytelling produit" [0.69, 0.44]
component "Vente retail thés, accessoires, coffrets" [0.66, 0.63]
component "Abonnements et recommandations" [0.62, 0.34]
component "Ateliers, tastings et evenements" [0.60, 0.27]

component "Preparation barista / tea master" [0.55, 0.50]
component "Recettes signature saisonnieres" [0.50, 0.30]
component "Sourcing thés premium et ingredients" [0.48, 0.42]
component "Traçabilite, certifications, allergenes" [0.45, 0.61]
component "Packaging durable et vente a emporter" [0.43, 0.64]
component "Gestion stock et fraicheur" [0.41, 0.68]

component "Application mobile / web ordering" [0.38, 0.71]
component "POS, paiements et fidelite" [0.35, 0.76]
component "CRM, segmentation et marketing automation" [0.32, 0.59]
component "Analytics demande, marge et prevision" [0.29, 0.48]
component "Integrations livraison / click-and-collect" [0.27, 0.73]
component "Formation equipe et playbooks operationnels" [0.25, 0.55]

component "Fournisseurs the, lait vegetal, patisserie" [0.20, 0.70]
component "Plateformes SaaS retail / restauration" [0.18, 0.82]
component "Logistique, energie, eau, hygiene" [0.15, 0.88]
component "Reglementation alimentaire et donnees clients" [0.12, 0.86]

Client->"Moment the premium, rapide et personnalise"
Client->"Confiance qualite, origine et sante"
Client->"Commande omnicanale sans friction"
Client->"Experience boutique et communaute"

"Moment the premium, rapide et personnalise"->"Menu boissons chaudes/froides"
"Moment the premium, rapide et personnalise"->"Personnalisation gout, sucre, lait, temperature"
"Moment the premium, rapide et personnalise"->"Preparation barista / tea master"
"Confiance qualite, origine et sante"->"Conseil expert et storytelling produit"
"Confiance qualite, origine et sante"->"Sourcing thés premium et ingredients"
"Confiance qualite, origine et sante"->"Traçabilite, certifications, allergenes"
"Commande omnicanale sans friction"->"Application mobile / web ordering"
"Commande omnicanale sans friction"->"POS, paiements et fidelite"
"Commande omnicanale sans friction"->"Integrations livraison / click-and-collect"
"Experience boutique et communaute"->"Ateliers, tastings et evenements"
"Experience boutique et communaute"->"Abonnements et recommandations"

"Menu boissons chaudes/froides"->"Recettes signature saisonnieres"
"Menu boissons chaudes/froides"->"Sourcing thés premium et ingredients"
"Personnalisation gout, sucre, lait, temperature"->"CRM, segmentation et marketing automation"
"Vente retail thés, accessoires, coffrets"->"Gestion stock et fraicheur"
"Abonnements et recommandations"->"CRM, segmentation et marketing automation"
"Recettes signature saisonnieres"->"Analytics demande, marge et prevision"
"Preparation barista / tea master"->"Formation equipe et playbooks operationnels"
"Gestion stock et fraicheur"->"Fournisseurs the, lait vegetal, patisserie"
"Application mobile / web ordering"->"Plateformes SaaS retail / restauration"
"POS, paiements et fidelite"->"Plateformes SaaS retail / restauration"
"CRM, segmentation et marketing automation"->"Plateformes SaaS retail / restauration"
"Analytics demande, marge et prevision"->"Plateformes SaaS retail / restauration"
"Packaging durable et vente a emporter"->"Fournisseurs the, lait vegetal, patisserie"
"Fournisseurs the, lait vegetal, patisserie"->"Logistique, energie, eau, hygiene"
"Plateformes SaaS retail / restauration"->"Reglementation alimentaire et donnees clients"
`;

/**
 * Everything the pack does NOT draw, in one file — the carried column of D1.
 *
 * Every line below is legal OWM that a real editor writes: the presentation
 * switches, the attitudes, the annotations with their own coordinate list, a
 * submap, a url, the axis-label overrides, the accelerators, a flow link, a
 * link carrying a `;` context, a `//` comment, and a `pipeline` with a
 * `{ … }` body. Mixed in with three statements the pack DOES draw, so the
 * suite can assert that carrying does not disturb mapping.
 */
export const KITCHEN_SINK_OWM = `title Everything at once
// a comment, which is also carried
style wardley
size [1000, 800]
evolution Genesis->Custom->Product->Commodity

anchor User [0.95, 0.20]
component Kettle [0.60, 0.40] label [12, -8] (build) inertia
market Suppliers [0.30, 0.70]
ecosystem Partners [0.25, 0.55]
note Watch this one [0.50, 0.30]

pipeline Kettle
{
  component Electric [0.42]
  component Gas [0.36]
}

evolve Kettle -> Electric kettle 0.75

annotation 1 [[0.43,0.49],[0.08,0.05]] Standardising power
annotations [0.60, 0.02]
pioneers [0.5, 0.5, 0.4, 0.4]
submap Detail [0.2, 0.2] url(detail)
url detail [https://example.test/detail]
accelerator Faster [0.30, 0.50]
presentation [0.9, 0.1]

User->Kettle
Kettle+>Suppliers
User->Partners; because they asked
`;
