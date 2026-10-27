# Les 5 enseignes : ce qui marche, ce qui reste à faire

| Enseigne | Comment on lit | État |
|---|---|---|
| Target | API publique du site (clé publique), magasin par magasin, avec la quantité | ✅ testé en direct |
| GameStop | Recherche Constructor + « magasins qui l'ont » par produit | ✅ testé en direct |
| Best Buy | API officielle (clé gratuite) | ⏳ attend ta clé |
| Pokémon Center | Pages produits (données intégrées) | ✅ testé, en ligne uniquement |
| Costco | Pages produits que tu ajoutes à la main (réglage `costco.urls`) | ✅ en ligne uniquement |

**Walmart : retiré** (bloque après une dizaine de lectures ; le stock en magasin demande une session par magasin). On pourra le rajouter plus tard : le code est gardé dans `src/sources/walmart.js`, il suffit de le réactiver dans `src/sources/index.js`.

**Avant d'augmenter les budgets** : lancer `/owner/bakeoff` depuis le site en ligne, avec et sans proxies. On ne monte la cadence qu'à 100 % de réussite sur plusieurs jours.
