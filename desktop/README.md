# Wakhreek Desktop (Windows)

Application Windows type « WhatsApp Desktop » pour Wakh Reek :
- reste dans la **barre des tâches** quand on ferme la fenêtre ;
- **sonne quand un appel arrive**, même fenêtre fermée (le PC doit être allumé) ;
- boutons **Répondre / Refuser** dans la notification.

## Fonctionnement

1. L'utilisateur ouvre l'app et se connecte une fois (la page `www.wakhreek.com`).
2. L'app lit la session et surveille les appels entrants toutes les 2 s.
3. Appel entrant → notification Windows + son + Répondre/Refuser.

## Développement local

```bash
cd desktop
npm install
npm start
```

## Construire l'installeur / version portable

```bash
cd desktop
npm run dist
```

Les fichiers `.exe` sont générés dans `desktop/dist/`.

## Note sur la veille

Comme WhatsApp Desktop, l'application sonne tant que le PC est **allumé**
(même écran éteint). Si le PC est **en veille complète / endormi**, aucun
logiciel ne peut le réveiller : réglez Windows sur « ne jamais mettre en veille »
si vous attendez des appels.
