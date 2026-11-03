// Launch mode: alerts are free (Worker var FREE_ALERTS = "1") while affiliate links are set up.
// Instant alerts on every channel, several products, no checkout. Turn it off by removing the var:
// alerts created now keep working as the free daily email (alerts.free = 1).
export const freeMode = (env) => env.FREE_ALERTS === '1';

const W = {
  en: { side: 'Free during our launch: an instant alert by email the moment it is back in stock.', cta: 'Free during our launch. No card needed.',
    facts: 'Free during our launch: live stock pages and instant alerts, no card needed.', plan: 'Free during our launch', planDesc: 'Instant alerts, up to 20 products', btn: 'Turn on my alert',
    pricing: 'Alerts are free during our launch: instant alerts by email, up to 20 products, no card needed.' },
  fr: { side: 'Gratuit pendant le lancement : une alerte instantanée par e-mail dès le retour en stock.', cta: 'Gratuit pendant le lancement. Sans carte bancaire.',
    facts: 'Gratuit pendant le lancement : pages de stock en direct et alertes instantanées, sans carte bancaire.', plan: 'Gratuit pendant le lancement', planDesc: 'Alertes instantanées, jusqu\'à 20 produits', btn: 'Activer mon alerte',
    pricing: 'Les alertes sont gratuites pendant le lancement : alertes instantanées par e-mail, jusqu\'à 20 produits, sans carte bancaire.' },
  de: { side: 'Kostenlos zum Start: sofortiger Alarm per E-Mail, sobald es wieder da ist.', cta: 'Kostenlos zum Start. Keine Karte nötig.',
    facts: 'Kostenlos zum Start: Live-Bestand und Sofort-Alarme, keine Karte nötig.', plan: 'Kostenlos zum Start', planDesc: 'Sofort-Alarme, bis zu 20 Produkte', btn: 'Alarm aktivieren',
    pricing: 'Alarme sind zum Start kostenlos: Sofort-Alarme per E-Mail, bis zu 20 Produkte, keine Karte nötig.' },
  it: { side: 'Gratis durante il lancio: avviso immediato via email appena torna disponibile.', cta: 'Gratis durante il lancio. Nessuna carta richiesta.',
    facts: 'Gratis durante il lancio: disponibilità live e avvisi immediati, nessuna carta richiesta.', plan: 'Gratis durante il lancio', planDesc: 'Avvisi immediati, fino a 20 prodotti', btn: 'Attiva il mio avviso',
    pricing: 'Gli avvisi sono gratis durante il lancio: avvisi immediati via email, fino a 20 prodotti, nessuna carta richiesta.' },
  es: { side: 'Gratis durante el lanzamiento: alerta inmediata por email en cuanto vuelva a haber stock.', cta: 'Gratis durante el lanzamiento. Sin tarjeta.',
    facts: 'Gratis durante el lanzamiento: stock en directo y alertas inmediatas, sin tarjeta.', plan: 'Gratis durante el lanzamiento', planDesc: 'Alertas inmediatas, hasta 20 productos', btn: 'Activar mi alerta',
    pricing: 'Las alertas son gratis durante el lanzamiento: alertas inmediatas por email, hasta 20 productos, sin tarjeta.' },
  nl: { side: 'Gratis tijdens de lancering: direct een melding per e-mail zodra het terug is.', cta: 'Gratis tijdens de lancering. Geen kaart nodig.',
    facts: 'Gratis tijdens de lancering: live voorraad en directe meldingen, geen kaart nodig.', plan: 'Gratis tijdens de lancering', planDesc: 'Directe meldingen, tot 20 producten', btn: 'Melding aanzetten',
    pricing: 'Meldingen zijn gratis tijdens de lancering: directe meldingen per e-mail, tot 20 producten, geen kaart nodig.' },
  ja: { side: 'ローンチ期間中は無料：再販・抽選をすぐにメール・LINEでお知らせします。', cta: 'ローンチ期間中は無料。カード不要。',
    facts: 'ローンチ期間中は無料：最新情報と即時通知、カード不要。', plan: 'ローンチ期間中は無料', planDesc: '即時通知、20件まで', btn: '通知をオンにする',
    pricing: 'ローンチ期間中は通知が無料です：メール・LINEで即時にお知らせ、20件まで、カード不要。' },
};
export const freeWords = (T) => W[T.cc.lang] ?? W.en;
export const FREE_MAX_ALERTS = 20;
