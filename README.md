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

## Ce qu'il reste à faire côté front-end

Le fichier React actuel doit être modifié pour :
- Appeler `GET /api/shops` au lieu du tableau codé en dur
- À la création d'une boutique, uploader son QR code via `POST /api/uploads`
  (folder: `qrcodes`) puis envoyer l'URL obtenue dans `POST /api/shops`
- Pour un paiement (abonnement ou frais d'entrée), uploader la capture de
  preuve via `POST /api/uploads` (folder: `proofs`) puis appeler
  `POST /api/payments` avec l'URL obtenue
- Construire une petite page admin (protégée par mot de passe = `ADMIN_SECRET`)
  qui appelle `GET /api/payments?status=pending`, affiche les preuves, et
  permet d'appeler `POST /api/payments/[id]/review` pour approuver/rejeter
- Appeler `GET/POST /api/messages` au lieu du chat simulé
