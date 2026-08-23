# PR policy

`main` är den enda långlivade arbetsgrenen.

## Obligatoriskt flöde

1. Skapa en kortlivad arbetsbranch från aktuell `main` för varje avgränsad uppgift.
2. Implementera och testa ändringen på arbetsbranchen och öppna sedan PR mot `main`.
3. Aktivera inte auto-merge. CI och review får uppdateras genom vanliga commits på samma PR-branch.
4. Alla required checks ska vara gröna och alla obligatoriska review-trådar lösta innan merge.
5. Merge sker med **squash merge**. Merge commits och rebase merge används inte; head-branchen får raderas efter merge.

Branch protection/rulesets får inte kringgås och ändringar ska inte pushas direkt till `main`.
