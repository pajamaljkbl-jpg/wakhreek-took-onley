# Wakh Reek — fondation membres

## Ce qui est ajouté

- Inscription Supabase avec **nom, e-mail, téléphone, mot de passe** et acceptation des règles.
- Session persistante : le navigateur garde la connexion jusqu'à une déconnexion volontaire.
- Page `/membres` : chercher un membre enregistré, démarrer une discussion, ajouter un ami (facultatif) ou bloquer.
- Messages privés entre membres : texte, image, vocal enregistré et courte vidéo enregistrée.
- Stories préparées en base : visibles uniquement par l'auteur et ses contacts, expiration après 24 heures.
- Signalements et signaux de modération : l'IA/administration peut aider à détecter, mais **aucune sanction automatique** n'est appliquée.

## À exécuter dans Supabase

1. Ouvre **SQL Editor**.
2. Crée une nouvelle requête.
3. Copie tout le contenu de `migration-social-foundation.sql`.
4. Clique sur **Run**. Le résultat attendu est `Success. No rows returned`.

## Déploiement

Après le commit GitHub, Vercel déploie automatiquement. Vérifie ensuite :

1. `https://www.wakhreek.com/compte` : créer un nouveau compte avec téléphone et accepter les règles.
2. Ferme puis rouvre le site : la session doit rester ouverte.
3. Ouvre `https://www.wakhreek.com/membres` avec deux comptes différents pour tester la recherche et les messages.

## Important pour les appels en direct

Les appels internes existants restent dans Wakh Reek. Pour une qualité fiable entre deux réseaux mobiles différents, la prochaine étape technique est un serveur TURN appartenant à Wakh Reek. Aucun lien externe ne sera montré aux membres.
