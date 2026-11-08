# Tempo Tracker (local)

Application web locale pour suivre la consommation EDF Tempo et le coût:
- journalier,
- mensuel,
- annuel.

Les données sont lues depuis les exports CSV Linky placés dans `data/raw`.

## Fonctionnalités

- Lecture multi-fichiers CSV Tempo.
- Gestion des lignes `NC` en recalculant la consommation via les index (différence avec le jour précédent).
- Calcul des coûts avec les tarifs Tempo fournis.
- Tableaux de bord:
  - indicateurs globaux,
  - courbe journalière (kWh + coût),
  - histogramme mensuel des coûts.
- Filtrage par année et par mois.

## Lancer en local

Depuis le dossier du projet:

```powershell
python -m http.server 8080
```

Puis ouvrir:

- http://localhost:8080

## Remarques sur les tarifs

Les tarifs intégrés sont ceux fournis à partir du 1er août 2026:
- Bleu HP: 0.1654 €/kWh
- Bleu HC: 0.1356 €/kWh
- Blanc HP: 0.1921 €/kWh
- Blanc HC: 0.1536 €/kWh
- Rouge HP: 0.7295 €/kWh
- Rouge HC: 0.1615 €/kWh

## Prochaines étapes envisagées

1. Ajouter import de nouveaux exports via interface (glisser-déposer).
2. Ajouter export PDF/CSV des bilans.
3. Packager en `.exe` (Electron ou Tauri) quand l’interface est validée.
4. Préparer ensuite une version Android.
