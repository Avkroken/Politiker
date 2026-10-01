# Distribution och appbutiker

PolitikerKontakts canonical runtime är webbappen på `https://politiker.denied.se/`. Repositoryt publicerar en PWA-bas med web app manifest, befintliga 192/512-ikoner och en service worker.

## Säkerhetsmodell

Service workern är avsiktligt network-only. Den cachear inte HTML, sessioner, D1-data, Queue-state, R2-objekt, credentials eller utskicksjobb. PWA-lagret är presentation/distribution och blir inte en ny state owner.

## Microsoft Store

Webbappen är tekniskt förberedd för PWA-paketering via HTTPS + manifest + service worker. Microsoft Partner Center äger Store-identitet, Publisher ID och signerat paket; dessa värden ska inte fabriceras i repositoryt.

## Google Play

Webbappen kan vara grund för en Trusted Web Activity-wrapper. Publicering kräver riktig Android package identity och signeringscertifikat. `.well-known/assetlinks.json` ska inte publiceras med placeholder-fingerprint.

## Apple

Webbappen kan installeras från Safari. En App Store-listning kräver en separat iOS-wrapper/app, bundle identity och Apple-signering. Repositoryt ska inte innehålla placeholder-Team ID, bundle ID eller signing credentials.

## Portal

Avkroken-portalen ska bara visa verifierade butikslänkar efter att respektive listing faktiskt är publicerad.
