// "Compare elsewhere" links on product pages, ready for affiliate ids.
// Each link works without an id (a plain search); with an id set as a Worker variable it earns a commission:
//   AFF_AMAZON_<CC>   Amazon Associates tag per country (e.g. AFF_AMAZON_US = mytag-20, AFF_AMAZON_DE = mytag-21)
//   AFF_EBAY_CAMPID   eBay Partner Network campaign id (one for every country)
//   AFF_TCGPLAYER     TCGplayer affiliate link template, {url} = the encoded product search (US)
//   AFF_CARDMARKET    Cardmarket affiliate link template, {url} = the encoded product search (Europe)
// Links are rel="sponsored nofollow" and clicks are counted as "buy_out" events.
import { escapeHtml as e } from '../lib/util.js';

const AMAZON = { us: 'amazon.com', uk: 'amazon.co.uk', ca: 'amazon.ca', au: 'amazon.com.au', de: 'amazon.de', fr: 'amazon.fr', nl: 'amazon.nl', it: 'amazon.it', es: 'amazon.es' };
const EBAY = { us: ['ebay.com', '711-53200-19255-0'], uk: ['ebay.co.uk', '710-53481-19255-0'], ca: ['ebay.ca', '706-53473-19255-0'], au: ['ebay.com.au', '705-53470-19255-0'],
  de: ['ebay.de', '707-53477-19255-0'], fr: ['ebay.fr', '709-53476-19255-0'], nl: ['ebay.nl', '1346-53482-19255-0'], it: ['ebay.it', '724-53478-19255-0'], es: ['ebay.es', '1185-53479-19255-0'] };
const CM_LANG = { de: 'de', fr: 'fr', it: 'it', es: 'es', nl: 'en', uk: 'en' };
const wrap = (tpl, url) => (tpl && tpl.includes('{url}') ? tpl.replace('{url}', encodeURIComponent(url)) : url);

export function affiliateLinks(env, cc, name) {
  const q = `Pokemon ${name}`.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const links = [];
  if (AMAZON[cc]) {
    const tag = env[`AFF_AMAZON_${cc.toUpperCase()}`];
    links.push({ id: 'amazon', label: 'Amazon', url: `https://www.${AMAZON[cc]}/s?k=${encodeURIComponent(q)}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}` });
  }
  if (EBAY[cc]) {
    const [host, rot] = EBAY[cc]; const camp = env.AFF_EBAY_CAMPID;
    links.push({ id: 'ebay', label: 'eBay', url: `https://www.${host}/sch/i.html?_nkw=${encodeURIComponent(q)}${camp ? `&mkcid=1&mkrid=${rot}&siteid=0&campid=${encodeURIComponent(camp)}&toolid=10001&mkevt=1` : ''}` });
  }
  if (cc === 'us' || cc === 'ca') links.push({ id: 'tcgplayer', label: 'TCGplayer', url: wrap(env.AFF_TCGPLAYER, `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(name)}`) });
  if (CM_LANG[cc]) links.push({ id: 'cardmarket', label: 'Cardmarket', url: wrap(env.AFF_CARDMARKET, `https://www.cardmarket.com/${CM_LANG[cc]}/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}`) });
  return links;
}

const TITLE = { en: 'Also compare on', fr: 'Comparer aussi sur', de: 'Auch vergleichen bei', it: 'Confronta anche su', es: 'Compara también en', nl: 'Vergelijk ook op', ja: '他のショップ' };

export function affiliateBlock(env, T, cc, k) {
  const links = affiliateLinks(env, cc, k.name);
  if (!links.length) return '';
  return `<div class="compare-out"><span class="fine">${e(TITLE[T.cc.lang] ?? TITLE.en)}</span>${links.map((l) => `<a class="btn dark small" href="${e(l.url)}" rel="nofollow noopener sponsored" target="_blank" data-ev="buy_out" data-shop="${l.id}" data-sku="${e(k.slug)}">${e(l.label)} ↗</a>`).join('')}</div>`;
}
