# Ce que toi seul peux faire (dans cet ordre)

Tout le reste, c'est Claude. Compte ~2 h au total. Envoie-moi chaque clé dans la conversation (ou mets-la toi-même avec `wrangler secret put`).

1. **Choisir le nom et le domaine** — sans « Pokémon » dedans (règle du playbook : marque déposée, risque de saisie du domaine et de fermeture du compte de paiement). Le nom actuel « CardRadar » est provisoire.
2. **Cloudflare** — créer le compte, acheter le domaine dedans (Registrar), puis me donner un *API token* « Edit Workers + D1 + Queues ».
3. **GitHub** — créer un dépôt privé, y ajouter `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` (Settings › Secrets). Chaque mise en ligne passe par là, jamais à la main.
4. **Whop** — créer le compte vendeur, 2 produits : Solo 11,99 $ / 30 jours et Multi 29,99 $ / 30 jours (renouvelables, **pas** d'`initial_price`). Me donner : clé API, secret du webhook, les 2 identifiants de plan. Webhook à pointer sur `https://<domaine>/api/billing/webhook`.
5. **Un 2e moyen de paiement prêt** (Lemon Squeezy ou Paddle) — juste le compte, au cas où Whop coupe.
6. **Postmark** (codes de connexion, depuis le domaine principal) et **Resend** (alertes, depuis `alerts@notify.<domaine>`) — créer les comptes, ajouter les enregistrements DNS qu'ils donnent dans Cloudflare, me donner les 2 clés.
7. **Telegram** — dans Telegram, parler à @BotFather › /newbot. Me donner le jeton et le nom du bot.
8. **Best Buy** — demander une clé gratuite sur developer.bestbuy.com. Sans elle, Best Buy est désactivé.
9. **Proxies** — un abonnement « datacenter US » (Rayobyte, comme dans le playbook). Me donner la liste `ip:port:user:pass`. Utile pour Target et GameStop quand on augmente la cadence.
10. **Google** (bouton « Continuer avec Google ») — console.cloud.google.com › identifiants OAuth, URL de retour `https://<domaine>/auth/google/callback`.
11. **Cloudflare Access** sur `/owner/*` avec ton email : c'est ce qui protège tes pages Surveillance et Marketing.
12. **Après la mise en ligne** : Bing Webmaster Tools (le plus important : ChatGPT lit Bing), Google Search Console, Google Postmaster Tools, Better Stack (alerte si `/api/health` ne répond plus). Dans chacun : ajouter le site, soumettre `https://<domaine>/sitemap.xml`.

Jamais : acheter des comptes, poster avec de faux comptes sur Reddit, acheter à la place des clients.
