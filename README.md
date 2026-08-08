# Backend Wakh Reek — mise en route

Ce dossier contient un vrai backend pour remplacer le prototype (localStorage +
chat simulé + boutons "j'ai payé" non vérifiés).

## Comment les paiements fonctionnent

- **Boutique → acheteur** (achat d'un produit) : chaque boutique affiche son
  propre QR code Wave (image stockée dans `qr_code_url`). L'acheteur scanne
  et paie directement au commerçant — la plateforme n'intervient pas dans
  cette transaction.
- **Boutique → toi** (abonnement mensuel 6000F, ou frais d'entrée chat 10F) :
  la boutique/l'acheteur paie sur ton compte Wave (ou ta carte prépayée pour
  l'étranger), envoie une capture d'écran comme preuve via
  `POST /api/payments`, et **toi tu valides manuellement** via
  `POST /api/payments/[id]/review` (protégé par `ADMIN_SECRET`).

## Étapes pour le mettre en ligne

### 1. Créer le projet Supabase (base de données — gratuit)
1. Va sur https://supabase.com → "New Project"
2. Ouvre l'onglet **SQL Editor**, colle le contenu de `schema.sql`, exécute-le.
3. Va dans **Project Settings → API → Legacy anon, service_role API keys** et note :
   - `Project URL` → variable `NEXT_PUBLIC_SUPABASE_URL`
   - clé `service_role` → variable `SUPABASE_SERVICE_ROLE_KEY`
4. Va dans **Storage**, crée un bucket nommé exactement `public`, et
   coche l'option pour le rendre **public** (pour que les QR codes et
   preuves de paiement soient visibles). C'est nécessaire pour que
   `/api/uploads` fonctionne.

Si tu avais déjà exécuté l'ancien `schema.sql`, ne le relance pas : exécute
uniquement `migration-existing-database.sql` pour ajouter les colonnes manquantes.

### 2. Choisir ton ADMIN_SECRET
Choisis une chaîne longue et aléatoire (ex: un mot de passe généré) et
mets-la dans la variable `ADMIN_SECRET`. C'est elle qui protège la
validation des paiements — ne la partage avec personne.

### 3. Configurer les variables d'environnement
Copie `.env.example` en `.env.local`, remplis toutes les valeurs.

### 4. Déployer sur Vercel
1. Pousse ce dossier sur un dépôt GitHub
2. Sur https://vercel.com, importe le dépôt
3. Dans **Environment Variables**, ajoute les mêmes variables que dans `.env.local`
4. Déploie.
5. Relie ton domaine `wakhreek.com` à ce projet Vercel.

### Parcours disponibles

- `/` : inscription acheteur, boutiques et chat après validation des 10 F.
- `/boutique` : création d'une boutique et preuve de l'abonnement de 6 000 F.
- `/marche` : catalogue, recherche, panier et création d'une commande.
- `/admin` : validation ou rejet des preuves avec `ADMIN_SECRET`.

Configure aussi `ADMIN_WAVE_NUMBER` et/ou `ADMIN_WAVE_QR_URL` dans Vercel. Sans
l'une de ces deux valeurs, l'envoi d'une preuve est volontairement bloqué afin
qu'un utilisateur ne puisse pas payer vers un compte inconnu.

## Important avant le lancement public

Cette version rend le parcours fonctionnel. Pour une ouverture à grande échelle,
ajoute ensuite Supabase Auth afin que chaque acheteur et chaque boutique possède
une session vérifiée, et remplace la validation manuelle Wave par une intégration
de paiement officielle lorsque ton compte marchand sera disponible.
