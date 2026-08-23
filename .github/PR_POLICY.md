# PR policy

Det här repot använder exakt två grenar: `dev` och `main`.

## Obligatoriskt flöde

1. Allt arbete för en uppgift färdigställs och testas på `dev` **innan** PR:n öppnas.
2. PR skapas endast `dev` → `main`.
3. Auto-merge ska aktiveras omedelbart när PR:n öppnas. Workflowen `dev-pr-auto-merge.yml` gör detta automatiskt.
4. När PR:n är öppnad är dess head **immutable**. Ingen ny commit får pushas till `dev` innan PR:n har mergats eller stängts.
5. Om ett fel upptäcks efter att PR:n öppnats ska den pågående PR:n inte ändras. Stäng PR:n, gör korrigeringen på `dev` och öppna därefter en ny PR med ny auto-merge.

## Teknisk spärr

Den obligatoriska CI-checken `typecheck (app)` avvisar en `dev` → `main`-PR om GitHub skickar en `synchronize`-händelse, alltså om PR-headen har ändrats efter öppning.

Det innebär att sena fixar, dokumentationsändringar eller andra commits inte kan smygas in i en redan pågående PR och ändå passera den required checken.

Den här policyn är striktare än äldre instruktioner som tillät följd-pushar till samma PR. Vid konflikt gäller denna fil och den tekniska CI-spärren.
