# Checklist publication Play Console

1. Vérifier la version Android
- versionCode: 2
- versionName: 1.0.1

2. Générer le bundle AAB release
- Commande: .\\android\\gradlew.bat -p .\\android bundleRelease --no-daemon
- Fichier attendu: android/app/build/outputs/bundle/release/app-release.aab

3. Compléter la fiche Play Store
- Utiliser les textes dans play-console/store-listing-fr.md

4. Compléter Data Safety
- Utiliser play-console/data-safety-fr.md

5. Politique de confidentialité
- Publier le contenu de PRIVACY_POLICY.md sur une URL publique
- Renseigner cette URL dans Play Console

6. Captures d'écran
- Préparer au moins 2 captures smartphone Android

7. Test interne
- Créer une release en test interne
- Ajouter des testeurs
- Installer l'app depuis le lien Play pour validation

8. Lancement progressif
- Passer en production après validation interne
