# Changelog

## [0.9.0](https://github.com/Avkroken/Politiker/compare/v0.8.13...v0.9.0) (2026-09-04)


### Features

* adopt Release PR workflow ([#400](https://github.com/Avkroken/Politiker/issues/400)) ([b5c4bfb](https://github.com/Avkroken/Politiker/commit/b5c4bfbccbf80bffcfb65886eacd8eea8ba0202e))
* enable metadata-only AI issue triage ([#392](https://github.com/Avkroken/Politiker/issues/392)) ([ec305fe](https://github.com/Avkroken/Politiker/commit/ec305fe2071c3d6ea1eecb05c7379bc3681caace))


### Fixes

* återställ mottagarkort från D1 ([#346](https://github.com/Avkroken/Politiker/issues/346)) ([f9b493e](https://github.com/Avkroken/Politiker/commit/f9b493e564e766f830abf6209d1b01bb30691d17))
* avoid invalid reusable-workflow variable context ([#402](https://github.com/Avkroken/Politiker/issues/402)) ([14142ff](https://github.com/Avkroken/Politiker/commit/14142ff90775b0325de16c2ec7478525be3117c5))
* behåll aktiv inställningsflik på accentgul ([#420](https://github.com/Avkroken/Politiker/issues/420)) ([ff3f2fb](https://github.com/Avkroken/Politiker/commit/ff3f2fb19bf7c702003ab32bed1c8c8d4975ce7b))
* bevara oskyddat slotarbete för watchdog ([#335](https://github.com/Avkroken/Politiker/issues/335)) ([4f2f875](https://github.com/Avkroken/Politiker/commit/4f2f875f80195e0bcbd0ce6319dff31cc7e45878))
* **ci:** repair export app token ([#364](https://github.com/Avkroken/Politiker/issues/364)) ([03b8cee](https://github.com/Avkroken/Politiker/commit/03b8ceebe4a63633439e9743da6042fbc728a223))
* **ci:** serialisera Codex-remediationens poolval ([#332](https://github.com/Avkroken/Politiker/issues/332)) ([66589ab](https://github.com/Avkroken/Politiker/commit/66589ab46995f7d38b9a6eee4f88d944ce5a4b39))
* clarify Swedish color contrast states ([#412](https://github.com/Avkroken/Politiker/issues/412)) ([e65b849](https://github.com/Avkroken/Politiker/commit/e65b8498ab25eeeac9b19df2c072a16663541b37))
* clean party and role data before D1 sync ([233ceeb](https://github.com/Avkroken/Politiker/commit/233ceeb67ced0049be5da40a4764f389b8f087cb))
* clean recipient filters and remove stale UI ([697de77](https://github.com/Avkroken/Politiker/commit/697de77c22ba82d03d56664c85e1c55296d067c4))
* collapse irrelevant scraped roles ([c605860](https://github.com/Avkroken/Politiker/commit/c605860aa00f228416a90effe5b95f06bbc7d5d1))
* **db:** use supported native migration CLI ([794eb0a](https://github.com/Avkroken/Politiker/commit/794eb0a00b79df16c0c9836063829bcca1cd026a))
* förbättra iOS autofyll för 2FA ([0ba8b04](https://github.com/Avkroken/Politiker/commit/0ba8b0493e905d9babeda7c3bbcda3c26afda624))
* hantera SMTP-autentiseringsfel som kontofel ([#421](https://github.com/Avkroken/Politiker/issues/421)) ([ae7c9fd](https://github.com/Avkroken/Politiker/commit/ae7c9fd5486bac7b41f68e2f9da3eeb9cada8676))
* harden sending and remove legacy AI features ([cdb166e](https://github.com/Avkroken/Politiker/commit/cdb166e6c19c1c458e3eaed64f3ec98d66a01b6c))
* hide invalid party values from recipient filters ([be935a6](https://github.com/Avkroken/Politiker/commit/be935a6ab16bd0d722b72bcf3d43e6a3b3cc9a8d))
* höj liten mobiltext konsekvent ([#423](https://github.com/Avkroken/Politiker/issues/423)) ([42e66e2](https://github.com/Avkroken/Politiker/commit/42e66e2fa2156b12a9c58a21fe3edf7d59f311ee))
* improve letter import and active editing ([#349](https://github.com/Avkroken/Politiker/issues/349)) ([5f1746c](https://github.com/Avkroken/Politiker/commit/5f1746c1986f62bc90df32237b648f6aada0b848))
* keep compact KPI numbers on one line ([f6e9de1](https://github.com/Avkroken/Politiker/commit/f6e9de15a050d69ea059f9f3e63a812464338cbe))
* ladda iOS 2FA-förbättring ([1d496a9](https://github.com/Avkroken/Politiker/commit/1d496a98acff349aa509e1dccb5dd152790f333f))
* laga merge queue och review-auto-fix ([#325](https://github.com/Avkroken/Politiker/issues/325)) ([2b4b752](https://github.com/Avkroken/Politiker/commit/2b4b752d021972dda7a5ced6d07957cd201de8fe))
* let metadata reconciliation finish ([#406](https://github.com/Avkroken/Politiker/issues/406)) ([7811837](https://github.com/Avkroken/Politiker/commit/781183792910382d48f55a3398ca7d43f4c0036c))
* make advanced recipient filters responsive ([bf99167](https://github.com/Avkroken/Politiker/commit/bf991671d86bcdddf1047e15a4a1ac8b8a6425f1))
* normalize scraped party values ([719f447](https://github.com/Avkroken/Politiker/commit/719f447fd041a8d765c753f9fa11111df73dfe4a))
* normalize scraped political roles ([bc09807](https://github.com/Avkroken/Politiker/commit/bc09807a6180379bff106921a97132325bf74061))
* open FAQ cards from deep links ([#413](https://github.com/Avkroken/Politiker/issues/413)) ([bd39be0](https://github.com/Avkroken/Politiker/commit/bd39be0a1e3dd6692bfd5d7ed0a7cac687079c22))
* point bounce processor at EU D1 ([c43e26c](https://github.com/Avkroken/Politiker/commit/c43e26ca818376725f6b58aedf3fa320e828e32d))
* polish iPhone states and Safari autofill ([#415](https://github.com/Avkroken/Politiker/issues/415)) ([eb4c91c](https://github.com/Avkroken/Politiker/commit/eb4c91c28e63882eb2a13433c36ccf4515902b23))
* preserve queued metadata events ([#405](https://github.com/Avkroken/Politiker/issues/405)) ([e04ae78](https://github.com/Avkroken/Politiker/commit/e04ae78075a0fd1f96d43e8d59628752daaa046f))
* prevent DOM XSS in rate editor ([6823954](https://github.com/Avkroken/Politiker/commit/6823954ede8d748fae724ed8803106ab720596f0))
* provision EU D1 in setup ([a8b4560](https://github.com/Avkroken/Politiker/commit/a8b4560bfd6a8d7b71cf2ad6591ef891852a8658))
* reconcile Dependabot outside PR events ([#398](https://github.com/Avkroken/Politiker/issues/398)) ([aa3baf7](https://github.com/Avkroken/Politiker/commit/aa3baf798d3701ce71a92e23ab343ea374446bf4))
* remove duplicate mobile recipient count ([5615421](https://github.com/Avkroken/Politiker/commit/5615421aaf3af0bf892d47fad430bf81f1c2bd89))
* remove unsupported observability key ([#348](https://github.com/Avkroken/Politiker/issues/348)) ([2901d17](https://github.com/Avkroken/Politiker/commit/2901d17f07b7365bb59231f4f3c976f22272a200))
* remove vulnerable setuptools bootstrap wheel ([#343](https://github.com/Avkroken/Politiker/issues/343)) ([ffb1e1c](https://github.com/Avkroken/Politiker/commit/ffb1e1cbd8f4527dcfe30456ee8762e52fb22380))
* resolve release Gamnacken client ID centrally ([#403](https://github.com/Avkroken/Politiker/issues/403)) ([36ddeea](https://github.com/Avkroken/Politiker/commit/36ddeeafc0a950fdd3e675f052a44da74430ae73))
* restore automatic semantic releases ([316f299](https://github.com/Avkroken/Politiker/commit/316f299974cd38fb3216e58aeb59fd19409a27f4))
* restore visitor tracking on the root route ([#410](https://github.com/Avkroken/Politiker/issues/410)) ([574cd7e](https://github.com/Avkroken/Politiker/commit/574cd7e2bb383449b249f5d4ff1f9acbf3e97d1b))
* scope link accent and preserve autofill focus ([#416](https://github.com/Avkroken/Politiker/issues/416)) ([1194fd6](https://github.com/Avkroken/Politiker/commit/1194fd6ad3206e9e2179f7a7566cdd72d242128b))
* **security:** remediate issue [#327](https://github.com/Avkroken/Politiker/issues/327) ([#337](https://github.com/Avkroken/Politiker/issues/337)) ([ed3b6e5](https://github.com/Avkroken/Politiker/commit/ed3b6e5c9e7e0338e981174be030a5d8bcb2fe8e))
* **security:** remediate issue [#328](https://github.com/Avkroken/Politiker/issues/328) ([#339](https://github.com/Avkroken/Politiker/issues/339)) ([3c72d5e](https://github.com/Avkroken/Politiker/commit/3c72d5e1cabb5f080ff726f974a4c04d7920d352))
* **security:** remediate issue [#329](https://github.com/Avkroken/Politiker/issues/329) ([#338](https://github.com/Avkroken/Politiker/issues/338)) ([7bc5f5d](https://github.com/Avkroken/Politiker/commit/7bc5f5d04ba390c949a01612535e70b0c939b665))
* **security:** remediate issue [#329](https://github.com/Avkroken/Politiker/issues/329) ([#345](https://github.com/Avkroken/Politiker/issues/345)) ([e1bf22e](https://github.com/Avkroken/Politiker/commit/e1bf22e7e65ec9345288ef0cd345f773d9962724))
* **security:** replace SHA-1 recipient IDs ([#323](https://github.com/Avkroken/Politiker/issues/323)) ([39b4b1c](https://github.com/Avkroken/Politiker/commit/39b4b1c82e038a19a058b6b52089241a7c4c66e8))
* serialize issue metadata routing ([#404](https://github.com/Avkroken/Politiker/issues/404)) ([5458f29](https://github.com/Avkroken/Politiker/commit/5458f29f9f9831aa996edb924aedef23de4103fc))
* serialize PR metadata reconciliation ([#401](https://github.com/Avkroken/Politiker/issues/401)) ([8e9c696](https://github.com/Avkroken/Politiker/commit/8e9c6969fcc4dd9466a1074c1d95f7e66a4ec88f))
* simplify private recipient import on mobile ([#411](https://github.com/Avkroken/Politiker/issues/411)) ([472707c](https://github.com/Avkroken/Politiker/commit/472707c2359b41a5f378c5e78bce0a2b0c7e3dc4))
* update central metadata routing ([#389](https://github.com/Avkroken/Politiker/issues/389)) ([0c10641](https://github.com/Avkroken/Politiker/commit/0c106415e98a6ceb680765005bf0f21c15321473))
* use centrally resolved release client ID ([36ddeea](https://github.com/Avkroken/Politiker/commit/36ddeeafc0a950fdd3e675f052a44da74430ae73))
* use supported Wrangler migration flags ([#370](https://github.com/Avkroken/Politiker/issues/370)) ([794eb0a](https://github.com/Avkroken/Politiker/commit/794eb0a00b79df16c0c9836063829bcca1cd026a))
* validate semantic release base tags ([fd905a5](https://github.com/Avkroken/Politiker/commit/fd905a5c3aaae68f14cb04b259892ab4d2fe21f9))


### Refactoring

* migrate D1 to native Wrangler migrations ([#369](https://github.com/Avkroken/Politiker/issues/369)) ([756028a](https://github.com/Avkroken/Politiker/commit/756028a52aace6a284303bc592584491820f08ff))
* remove legacy D1 Git control plane ([#368](https://github.com/Avkroken/Politiker/issues/368)) ([1d6ce25](https://github.com/Avkroken/Politiker/commit/1d6ce258ef95ce545eea380cc0b764a12ea3b494))
* remove redundant global failure metric ([be74aef](https://github.com/Avkroken/Politiker/commit/be74aef5b971e56cc95fbd7ca8664ee8390c5eb3))
* simplify FAQ and GDPR guidance ([d52aeff](https://github.com/Avkroken/Politiker/commit/d52aeffc263d06281079817d51f925f844df46ac))
* use central metadata orchestrator ([#407](https://github.com/Avkroken/Politiker/issues/407)) ([0c62841](https://github.com/Avkroken/Politiker/commit/0c62841187b92ef5d71f19110aeb1fc5098acf08))


### Documentation

* align AGENTS merge policy ([#304](https://github.com/Avkroken/Politiker/issues/304)) ([3470ad0](https://github.com/Avkroken/Politiker/commit/3470ad019ef3a16057302273207fe987ec7c3d1a))
* align AGENTS merge policy with repository settings ([3470ad0](https://github.com/Avkroken/Politiker/commit/3470ad019ef3a16057302273207fe987ec7c3d1a))
* align AGENTS with live merge rules ([ae3f766](https://github.com/Avkroken/Politiker/commit/ae3f76643dc281e41cfb28e578edeb919c4bb49d))
* align AGENTS with live rulesets ([#387](https://github.com/Avkroken/Politiker/issues/387)) ([ae3f766](https://github.com/Avkroken/Politiker/commit/ae3f76643dc281e41cfb28e578edeb919c4bb49d))
* align CI merge policy ([#305](https://github.com/Avkroken/Politiker/issues/305)) ([fc9106a](https://github.com/Avkroken/Politiker/commit/fc9106a2cef97421167f84635ac9f6bcc97681d3))
* align contact scraper README with current repo ([1d2aa0f](https://github.com/Avkroken/Politiker/commit/1d2aa0f14fdc7ed2e532051142e056a9517ca7d9))
* align governance and CI documentation ([#396](https://github.com/Avkroken/Politiker/issues/396)) ([2c5e04b](https://github.com/Avkroken/Politiker/commit/2c5e04bbcb5406ff92c18eb5c90711e4d53cd037))
* align README with current runtime ([8c83be3](https://github.com/Avkroken/Politiker/commit/8c83be392ed882df2173c0889e172ab0b9092978))
* align security policy with current architecture ([f35522d](https://github.com/Avkroken/Politiker/commit/f35522d8b6c980798e37533462ba8641cdc232f1))
* centralize agent policy ([#395](https://github.com/Avkroken/Politiker/issues/395)) ([6690192](https://github.com/Avkroken/Politiker/commit/669019289fd1c0e790006f95478bb4313c23b4f1))
* consolidate authoritative AI agent policy ([#341](https://github.com/Avkroken/Politiker/issues/341)) ([6219367](https://github.com/Avkroken/Politiker/commit/6219367a83abbdc523947ca6197bd860450169bf))
* document current CI deploy and release flow ([367cef1](https://github.com/Avkroken/Politiker/commit/367cef1fac0aa80710dc0bcd7f85a2e3e6f10a7a))
* document post-squash migration policy ([6cef6a9](https://github.com/Avkroken/Politiker/commit/6cef6a9e1c4c2c703dffb5793170be064f3768b0))
* frys PR-scope efter öppning ([95900a5](https://github.com/Avkroken/Politiker/commit/95900a5aac3749cbd60c84d68466267c854415cd))
* remove obsolete TODO file ([bf652c2](https://github.com/Avkroken/Politiker/commit/bf652c287797659c90c465a45f7f8fab5e5eed6f))
* remove stale association funding instructions ([25ca9c2](https://github.com/Avkroken/Politiker/commit/25ca9c26eeba113be86d7e79533764b6c348df9a))
* require pre-PR agent quality gate ([#340](https://github.com/Avkroken/Politiker/issues/340)) ([5263b33](https://github.com/Avkroken/Politiker/commit/5263b33b417df0bdd8ee4293d104340ccaa16076))
* simplify FAQ wording ([00fcbaa](https://github.com/Avkroken/Politiker/commit/00fcbaa7d26828da9ff38ea1dac93a83e7fee6e3))
* skärp PR-gates och auto-merge ([#330](https://github.com/Avkroken/Politiker/issues/330)) ([919787e](https://github.com/Avkroken/Politiker/commit/919787e0782b53ff44462b0a1166e1968d4e850d))
* synchronize verified merge policy ([#386](https://github.com/Avkroken/Politiker/issues/386)) ([02cb304](https://github.com/Avkroken/Politiker/commit/02cb304bbeb1e782a8c2066286dcf91cc0f59295))
* unify community health files ([#397](https://github.com/Avkroken/Politiker/issues/397)) ([19f004b](https://github.com/Avkroken/Politiker/commit/19f004b7034902cf33c101390e5e7ee37f8321d2))

## Changelog

Changes released after `v0.8.13` are maintained automatically by Release Please.

For older versions, see the existing GitHub Releases history.
