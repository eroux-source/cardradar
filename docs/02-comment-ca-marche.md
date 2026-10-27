# Comment ça marche (en clair)

**Le site** répond à « où trouver tel produit Pokémon TCG en stock, maintenant ». Chaque produit a sa page (`/us/<produit>`), par ville (`/us/<produit>/<ville>`), chaque magasin a sa page, et chaque enseigne/ville a une page « quand ça réassortit » remplie avec les vrais réassorts enregistrés.

**Le robot** lit les magasins chaque minute, selon un budget par enseigne (réglable sans redéployer). Priorité : 1) ce que surveillent les clients payants, 2) les magasins qui réassortissent habituellement à cette heure-ci, 3) le reste, du plus ancien au plus récent.

**Ce qui évite les fausses alertes**
- « En stock » est publié tout de suite ; « épuisé » attend une 2e lecture.
- Un produit qui clignote 3 fois en 10 min est mis de côté 30 min.
- Un « magasin témoin » (celui resté en stock le plus longtemps) : s'il lit soudain « épuisé », c'est la source qui est cassée, pas le stock → on ignore les « épuisé » de cette source.

**Les alertes** : notification téléphone et Telegram en même temps ; l'email seulement si aucun des deux n'a marché, et au maximum un email par heure (le reste est regroupé, jamais perdu). Une copie de vérification repasse 60 s après, et chaque nuit le système revérifie les 24 h pour rattraper une alerte manquée. Une alerte ne peut jamais partir deux fois.

**Le paiement** : pas d'offre gratuite. Étapes : email → produit + lieu → comment te prévenir → formule → paiement Whop. L'email est gardé dès l'étape 1 : la personne qui abandonne reçoit **un seul** rappel 2 h après.

**Mesure** : aucun cookie à part celui de connexion. Les visites sont comptées par onglet ; tes pages Marketing lisent un résumé calculé chaque heure.

**Tes pages** (protégées) : `/owner/monitor` (un verdict en une phrase, l'état de chaque enseigne, les interrupteurs d'urgence, un rapport à copier pour Claude), `/owner/marketing` (entonnoir, sources de trafic dont ChatGPT, revenu par visite), `/owner/bakeoff` (test des enseignes avant d'augmenter la cadence).

**Pour ChatGPT** : chaque page a une phrase-réponse en haut, 3 réponses courtes, un bloc de faits (prix, canaux, vitesse **mesurée**), `llms.txt`, un sitemap, et un ping IndexNow à Bing à chaque réassort.
