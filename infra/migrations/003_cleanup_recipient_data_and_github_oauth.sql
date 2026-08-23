-- Engångsrensning efter mottagarsaneringen och avvecklingen av GitHub-login.
-- GitHub-identiteter tas bara bort när kontot redan har ett eget användarsatt
-- lösenord. Konton som annars riskerar att bli omöjliga att återställa lämnas
-- kvar för manuell granskning.
DELETE FROM oauth_identities
WHERE provider = 'github'
  AND account_id IN (
    SELECT id FROM accounts WHERE password_set_by_user = 1
  );

-- Endast svensk representation i Europaparlamentet ska ligga kvar.
DELETE FROM politicians
WHERE area_type = 'eu'
  AND area_name <> 'Europaparlamentet (Sverige)';

-- Ta bort rader som representerar uppdrag som inte är relevanta mottagare.
DELETE FROM politicians
WHERE area_type IN ('kommun', 'region')
  AND role IS NOT NULL
  AND TRIM(role) <> ''
  AND (
    LOWER(role) LIKE '%revisor%'
    OR LOWER(role) LIKE '%nämndeman%'
    OR LOWER(role) LIKE '%nämndemän%'
    OR LOWER(role) LIKE '%vigselförrätt%'
    OR LOWER(role) LIKE '%partnerskapsförrätt%'
    OR LOWER(role) = 'god man'
    OR LOWER(role) LIKE 'gode män%'
  );

-- Normalisera partier till den avsiktliga publika filterlistan.
UPDATE politicians
SET party = CASE LOWER(TRIM(party))
  WHEN 's' THEN 'S'
  WHEN 'socialdemokraterna' THEN 'S'
  WHEN 'socialdemokratiska arbetarepartiet' THEN 'S'
  WHEN 'm' THEN 'M'
  WHEN 'moderaterna' THEN 'M'
  WHEN 'moderata samlingspartiet' THEN 'M'
  WHEN 'sd' THEN 'SD'
  WHEN 'sverigedemokraterna' THEN 'SD'
  WHEN 'v' THEN 'V'
  WHEN 'vänsterpartiet' THEN 'V'
  WHEN 'c' THEN 'C'
  WHEN 'centerpartiet' THEN 'C'
  WHEN 'l' THEN 'L'
  WHEN 'liberalerna' THEN 'L'
  WHEN 'folkpartiet liberalerna' THEN 'L'
  WHEN 'kd' THEN 'KD'
  WHEN 'kristdemokraterna' THEN 'KD'
  WHEN 'mp' THEN 'MP'
  WHEN 'miljöpartiet' THEN 'MP'
  WHEN 'miljöpartiet de gröna' THEN 'MP'
  WHEN 'fi' THEN 'FI'
  WHEN 'feministiskt initiativ' THEN 'FI'
  WHEN 'med' THEN 'MED'
  WHEN 'medborgerlig samling' THEN 'MED'
  WHEN 'afs' THEN 'AFS'
  WHEN 'alternativ för sverige' THEN 'AFS'
  WHEN 'alternativ för sverige (afs)' THEN 'AFS'
  WHEN 'öp' THEN 'ÖP'
  WHEN 'örebropartiet' THEN 'ÖP'
  WHEN 'örebropartiet (öp)' THEN 'ÖP'
  WHEN 'pp' THEN 'PP'
  WHEN 'piratpartiet' THEN 'PP'
  ELSE TRIM(party)
END
WHERE party IS NOT NULL;

UPDATE politicians
SET party = NULL
WHERE party IS NOT NULL
  AND party NOT IN ('S','M','SD','V','C','L','KD','MP','FI','MED','AFS','ÖP','PP');

-- Detaljerade roller används inte längre i mottagarurvalet.
UPDATE politicians SET role = NULL WHERE role IS NOT NULL;
UPDATE politician_assignments SET role = '' WHERE role <> '';

-- Behåll bara kommun-/regionstyrelser och faktiska nämnder.
DELETE FROM politician_assignments
WHERE NOT (
  LOWER(TRIM(body)) IN ('kommunstyrelse', 'kommunstyrelsen', 'regionstyrelse', 'regionstyrelsen')
  OR (
    LOWER(body) LIKE '%nämnd%'
    AND LOWER(body) NOT LIKE '%fullmäktige%'
    AND LOWER(body) NOT LIKE '%utskott%'
    AND LOWER(body) NOT LIKE '%beredning%'
    AND LOWER(body) NOT LIKE '%nämndeman%'
    AND LOWER(body) NOT LIKE '%nämndemän%'
    AND LOWER(body) NOT LIKE '%vigselförrätt%'
    AND LOWER(body) NOT LIKE '%kommunalförbund%'
  )
);

-- Kanonisera styrelser och vanliga singularformer.
INSERT OR IGNORE INTO politician_assignments
  (politician_id, area_name, body, role, source, last_scraped_at)
SELECT politician_id, area_name, 'Kommunstyrelsen', role, source, last_scraped_at
FROM politician_assignments
WHERE LOWER(TRIM(body)) IN ('kommunstyrelse', 'kommunstyrelsen');
DELETE FROM politician_assignments
WHERE LOWER(TRIM(body)) IN ('kommunstyrelse', 'kommunstyrelsen')
  AND body <> 'Kommunstyrelsen';

INSERT OR IGNORE INTO politician_assignments
  (politician_id, area_name, body, role, source, last_scraped_at)
SELECT politician_id, area_name, 'Regionstyrelsen', role, source, last_scraped_at
FROM politician_assignments
WHERE LOWER(TRIM(body)) IN ('regionstyrelse', 'regionstyrelsen');
DELETE FROM politician_assignments
WHERE LOWER(TRIM(body)) IN ('regionstyrelse', 'regionstyrelsen')
  AND body <> 'Regionstyrelsen';

INSERT OR IGNORE INTO politician_assignments
  (politician_id, area_name, body, role, source, last_scraped_at)
SELECT politician_id, area_name, TRIM(body) || 'en', role, source, last_scraped_at
FROM politician_assignments
WHERE LOWER(TRIM(body)) LIKE '%nämnd'
  AND LOWER(TRIM(body)) NOT LIKE '%nämnden';
DELETE FROM politician_assignments
WHERE LOWER(TRIM(body)) LIKE '%nämnd'
  AND LOWER(TRIM(body)) NOT LIKE '%nämnden';
