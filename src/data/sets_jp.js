// Japanese sets (they differ from English sets). Newest first.
// Source: pokemon-card.com/info + press, checked 27/10/2026. Add new ones here.
export const JP_SETS = [
  { slug: 'hadou-seeker', name: 'ハドウシーカー', type: '拡張パック', release: '2026-11-27' },
  { slug: 'special-deck-set-mega', name: 'スペシャルデッキセットMEGA', type: 'デッキ', release: '2026-11-13' },
  { slug: '30th-celebration', name: '30th CELEBRATION', type: '拡張パック', release: '2026-09-16' },
  { slug: 'storm-emeralda', name: 'ストームエメラルダ', type: '拡張パック', release: '2026-07-31' },
  { slug: 'abyss-eye', name: 'アビスアイ', type: '拡張パック', release: '2026-05-22' },
  { slug: 'ninja-spinner', name: 'ニンジャスピナー', type: '拡張パック', release: '2026-03-13' },
  { slug: 'munikis-zero', name: 'ムニキスゼロ', type: '拡張パック', release: '2026-01-23' },
  { slug: 'mega-dream-ex', name: 'MEGAドリームex', type: 'ハイクラスパック', release: '2025-11-28' },
  { slug: 'inferno-x', name: 'インフェルノX', type: '拡張パック', release: '2025-09-26' },
  { slug: 'mega-brave', name: 'メガブレイブ', type: '拡張パック', release: '2025-08-01' },
  { slug: 'mega-symphonia', name: 'メガシンフォニア', type: '拡張パック', release: '2025-08-01' },
];
const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
/** Finds the set mentioned in a Japanese title. */
export function jpSetOf(title) {
  const t = norm(title);
  return JP_SETS.find((s) => t.includes(norm(s.name))) ?? null;
}
export const jpSetBySlug = (slug) => JP_SETS.find((s) => s.slug === slug) ?? null;
