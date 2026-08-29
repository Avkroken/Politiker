# PR policy

Arbete sker i en **sluten pool av återanvändbara arbetsgrenar**:

- `work/feature` för ny funktionalitet
- `work/fix` för buggfixar och CI-problem
- `work/chore` för dokumentation, städning och konfiguration
- `docs/content` för dokumentations- och textinnehåll inom det specialscope som `scope-policy` tillåter

`main` tar bara emot squash-mergade PR:er som passerat alla merge-gates. Skapa inte andra arbetsgrenar och pusha aldrig direkt till `main`.

## Obligatoriskt flöde

1. Välj en ledig gren i poolen som passar arbetet. Om en poolgren redan har omergat arbete ska det arbetet slutföras först. `docs/content` används endast när ändringen ryms inom dess särskilda dokumentationsscope.
2. Implementera och testa ändringen på poolgrenen och öppna sedan en PR mot `main` som klar för granskning.
3. **Aktivera auto-merge omedelbart när PR:n skapas.** Fortsatta CI- och review-fixar görs som commits på samma poolgren och samma PR.
4. Alla required CI-checkar ska vara gröna och alla relevanta review-trådar ska vara lösta före merge. Review-kommentarer ska läsas och utvärderas; relevanta fynd ska åtgärdas innan tråden markeras resolved.
5. Efter varje ny commit ska required checks och review-status kontrolleras igen. En PR får inte mergas medan required CI är röd eller pågående, eller medan en relevant review-tråd är olöst.
6. Merge sker med **squash merge**. Merge commits och rebase merge används inte. Efter merge synkroniseras poolgrenarna mot `main` av repositoryts etablerade workflow.

Branch protection, rulesets, merge queue och andra repository-regler får inte kringgås.
