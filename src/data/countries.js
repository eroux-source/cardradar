// Prices: set against local competitors found 27/10/2026 (UK £4–5, EU TCGRadar €7.99, CA PokeToolz C$11.99,
// AU A$10–12.50, JP: only free sites). US stays on the playbook's tested price.
// Countries served. Each has its own URL prefix, language, currency, prices,
// cities (each polled around a postal code) and retailers (sources declare their
// `country`). A country with no live retailer yet is shown as "coming soon" and
// kept out of the sitemap (no thin pages, §7).
//
// Metro ids are unique across countries: US ids are the plain slug (history),
// other countries use "<cc>-<slug>". URLs always show the plain slug.
import { metros as US_METROS } from './metros.js';

const m = (cc, list) => list.map(([slug, name, region, zip]) => ({ id: cc === 'us' ? slug : `${cc}-${slug}`, slug, name, state: region, zip, country: cc }));

export const COUNTRIES = {
  us: { code: 'us', name: 'United States', lang: 'en', locale: 'en-US', currency: 'USD', prices: { solo: '6.99', multi: '14.99' }, tz: 'America/New_York',
    metros: US_METROS.map((x) => ({ ...x, id: x.slug, country: 'us' })) },
  uk: { code: 'uk', name: 'United Kingdom', lang: 'en', locale: 'en-GB', currency: 'GBP', prices: { solo: '4.99', multi: '11.99' }, tz: 'Europe/London',
    metros: m('uk', [['london', 'London', 'ENG', 'WC2N 5DU'], ['birmingham', 'Birmingham', 'ENG', 'B2 4QA'], ['manchester', 'Manchester', 'ENG', 'M1 1AD'], ['leeds', 'Leeds', 'ENG', 'LS1 4DY'], ['glasgow', 'Glasgow', 'SCT', 'G1 3SL'], ['liverpool', 'Liverpool', 'ENG', 'L1 1JQ'], ['newcastle', 'Newcastle', 'ENG', 'NE1 7RU'], ['sheffield', 'Sheffield', 'ENG', 'S1 2HE'], ['bristol', 'Bristol', 'ENG', 'BS1 4DJ'], ['nottingham', 'Nottingham', 'ENG', 'NG1 2BU'], ['leicester', 'Leicester', 'ENG', 'LE1 5YA'], ['edinburgh', 'Edinburgh', 'SCT', 'EH1 1YZ'], ['cardiff', 'Cardiff', 'WLS', 'CF10 1EP'], ['belfast', 'Belfast', 'NIR', 'BT1 5GS'], ['southampton', 'Southampton', 'ENG', 'SO14 7DU']]) },
  ca: { code: 'ca', name: 'Canada', lang: 'en', locale: 'en-CA', currency: 'CAD', prices: { solo: '11.99', multi: '29.99' }, tz: 'America/Toronto',
    metros: m('ca', [['toronto', 'Toronto', 'ON', 'M5H 2N2'], ['montreal', 'Montreal', 'QC', 'H3B 4W8'], ['vancouver', 'Vancouver', 'BC', 'V6B 1A1'], ['calgary', 'Calgary', 'AB', 'T2P 1J9'], ['edmonton', 'Edmonton', 'AB', 'T5J 0N3'], ['ottawa', 'Ottawa', 'ON', 'K1P 1J1'], ['winnipeg', 'Winnipeg', 'MB', 'R3C 0V8'], ['quebec-city', 'Quebec City', 'QC', 'G1R 4S9'], ['hamilton', 'Hamilton', 'ON', 'L8P 4R5'], ['kitchener', 'Kitchener', 'ON', 'N2G 4G7'], ['london-on', 'London', 'ON', 'N6A 3N7'], ['halifax', 'Halifax', 'NS', 'B3J 3A5']]) },
  au: { code: 'au', name: 'Australia', lang: 'en', locale: 'en-AU', currency: 'AUD', prices: { solo: '11.99', multi: '29.99' }, tz: 'Australia/Sydney',
    metros: m('au', [['sydney', 'Sydney', 'NSW', '2000'], ['melbourne', 'Melbourne', 'VIC', '3000'], ['brisbane', 'Brisbane', 'QLD', '4000'], ['perth', 'Perth', 'WA', '6000'], ['adelaide', 'Adelaide', 'SA', '5000'], ['gold-coast', 'Gold Coast', 'QLD', '4217'], ['newcastle-nsw', 'Newcastle', 'NSW', '2300'], ['canberra', 'Canberra', 'ACT', '2601'], ['sunshine-coast', 'Sunshine Coast', 'QLD', '4558'], ['wollongong', 'Wollongong', 'NSW', '2500'], ['hobart', 'Hobart', 'TAS', '7000'], ['geelong', 'Geelong', 'VIC', '3220']]) },
  jp: { code: 'jp', name: '日本', lang: 'ja', locale: 'ja-JP', currency: 'JPY', prices: { solo: '680', multi: '1480' }, tz: 'Asia/Tokyo', mode: 'lottery',
    metros: m('jp', [['tokyo', '東京', '東京都', '100-0005'], ['osaka', '大阪', '大阪府', '530-0001'], ['nagoya', '名古屋', '愛知県', '450-0002'], ['yokohama', '横浜', '神奈川県', '220-0011'], ['fukuoka', '福岡', '福岡県', '812-0012'], ['sapporo', '札幌', '北海道', '060-0806'], ['kobe', '神戸', '兵庫県', '650-0021'], ['kyoto', '京都', '京都府', '600-8216'], ['sendai', '仙台', '宮城県', '980-0021'], ['hiroshima', '広島', '広島県', '732-0822']]) },
  de: { code: 'de', name: 'Deutschland', lang: 'de', locale: 'de-DE', currency: 'EUR', prices: { solo: '5.99', multi: '13.99' }, tz: 'Europe/Berlin',
    metros: m('de', [['berlin', 'Berlin', 'BE', '10117'], ['hamburg', 'Hamburg', 'HH', '20095'], ['muenchen', 'München', 'BY', '80331'], ['koeln', 'Köln', 'NW', '50667'], ['frankfurt', 'Frankfurt', 'HE', '60311'], ['stuttgart', 'Stuttgart', 'BW', '70173'], ['duesseldorf', 'Düsseldorf', 'NW', '40213'], ['dortmund', 'Dortmund', 'NW', '44137'], ['essen', 'Essen', 'NW', '45127'], ['leipzig', 'Leipzig', 'SN', '04109'], ['bremen', 'Bremen', 'HB', '28195'], ['hannover', 'Hannover', 'NI', '30159'], ['nuernberg', 'Nürnberg', 'BY', '90402'], ['dresden', 'Dresden', 'SN', '01067']]) },
  fr: { code: 'fr', name: 'France', lang: 'fr', locale: 'fr-FR', currency: 'EUR', prices: { solo: '5.99', multi: '13.99' }, tz: 'Europe/Paris',
    metros: m('fr', [['paris', 'Paris', 'IDF', '75001'], ['marseille', 'Marseille', 'PACA', '13001'], ['lyon', 'Lyon', 'ARA', '69001'], ['toulouse', 'Toulouse', 'OCC', '31000'], ['nice', 'Nice', 'PACA', '06000'], ['nantes', 'Nantes', 'PDL', '44000'], ['montpellier', 'Montpellier', 'OCC', '34000'], ['strasbourg', 'Strasbourg', 'GES', '67000'], ['bordeaux', 'Bordeaux', 'NAQ', '33000'], ['lille', 'Lille', 'HDF', '59000'], ['rennes', 'Rennes', 'BRE', '35000'], ['grenoble', 'Grenoble', 'ARA', '38000']]) },
  nl: { code: 'nl', name: 'Nederland', lang: 'nl', locale: 'nl-NL', currency: 'EUR', prices: { solo: '5.99', multi: '13.99' }, tz: 'Europe/Amsterdam',
    metros: m('nl', [['amsterdam', 'Amsterdam', 'NH', '1012 JS'], ['rotterdam', 'Rotterdam', 'ZH', '3011 AD'], ['den-haag', 'Den Haag', 'ZH', '2511 BT'], ['utrecht', 'Utrecht', 'UT', '3511 LX'], ['eindhoven', 'Eindhoven', 'NB', '5611 AH'], ['groningen', 'Groningen', 'GR', '9711 LV'], ['tilburg', 'Tilburg', 'NB', '5038 AA'], ['almere', 'Almere', 'FL', '1315 HZ']]) },
  it: { code: 'it', name: 'Italia', lang: 'it', locale: 'it-IT', currency: 'EUR', prices: { solo: '5.99', multi: '13.99' }, tz: 'Europe/Rome',
    metros: m('it', [['roma', 'Roma', 'LAZ', '00184'], ['milano', 'Milano', 'LOM', '20121'], ['napoli', 'Napoli', 'CAM', '80133'], ['torino', 'Torino', 'PIE', '10121'], ['palermo', 'Palermo', 'SIC', '90133'], ['genova', 'Genova', 'LIG', '16121'], ['bologna', 'Bologna', 'EMR', '40121'], ['firenze', 'Firenze', 'TOS', '50123'], ['bari', 'Bari', 'PUG', '70121'], ['catania', 'Catania', 'SIC', '95124']]) },
  es: { code: 'es', name: 'España', lang: 'es', locale: 'es-ES', currency: 'EUR', prices: { solo: '5.99', multi: '13.99' }, tz: 'Europe/Madrid',
    metros: m('es', [['madrid', 'Madrid', 'MD', '28013'], ['barcelona', 'Barcelona', 'CT', '08002'], ['valencia', 'Valencia', 'VC', '46002'], ['sevilla', 'Sevilla', 'AN', '41004'], ['zaragoza', 'Zaragoza', 'AR', '50001'], ['malaga', 'Málaga', 'AN', '29015'], ['murcia', 'Murcia', 'MC', '30004'], ['palma', 'Palma', 'IB', '07001'], ['bilbao', 'Bilbao', 'PV', '48001'], ['alicante', 'Alicante', 'VC', '03002']]) },
};

export const countryList = Object.values(COUNTRIES);
/** Every metro of every country, by id. */
export const metroById = Object.fromEntries(countryList.flatMap((c) => c.metros.map((x) => [x.id, x])));
/** A metro inside a country, by the slug shown in URLs. */
export const metroInCountry = (cc, slug) => COUNTRIES[cc]?.metros.find((x) => x.slug === slug) ?? null;
export const countryOfMetro = (id) => metroById[id]?.country ?? null;

export function money(cc, amount) {
  const c = COUNTRIES[cc] ?? COUNTRIES.us;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: c.currency === 'JPY' ? 0 : 2 }).format(Number(amount));
}
