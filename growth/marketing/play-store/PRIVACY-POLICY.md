# Mish Ana! — Privacy policy (EN + FR) for `/privacy`

Publish both language versions on the landing page at `/privacy` (one page with an EN/FR switch, or `/privacy` + `/fr/privacy`). Replace only `{{OWNER_NAME}}` and `{{CONTACT_EMAIL}}`. The text is written to match the code at `/home/alex/bubble-graph` HEAD `672b09c` (2026-10-04); the source for every statement is listed in the appendix at the bottom (do not publish the appendix).

Before publishing, decide the Workers Logs question (DATA-SAFETY.md §0, "Uncertain item"). The sentence marked **[LOGS]** below is correct in both cases; if invocation logs are turned off you may delete it.

When Play Billing ships, insert the block in **Appendix B** under section 3 and update the date.

---

## English

# Privacy policy — Mish Ana!

**Last updated: October 4, 2026**

Mish Ana! ("the game") is a party game for Android TV and Google TV. The TV app hosts a game room; players join from their phones in a web browser. This policy explains what information the game uses, why, and for how long. It covers the Android TV app "Mish Ana!" (package `app.mishana.tv`) and the player web page that the TV's QR code opens.

**Who is responsible.** {{OWNER_NAME}} (the developer), contact: {{CONTACT_EMAIL}}.

## 1. The short version

- No accounts, no sign-in, no email address, no phone number.
- No ads, no analytics, no tracking, no third-party SDKs.
- Players type a nickname. That nickname is visible to the other players in the room.
- Every game room, with the nicknames and everything played in it, is **deleted automatically**, at the latest 2 hours after the last activity.
- We never sell or share your information.

## 2. Information we use

**When you join a game from your phone**
- **Nickname** (1–16 characters) and the **colour** you pick: shown on the TV and on the other players' phones in your room.
- **Your language** (English, French or Arabic): to show the game in your language.
- **What you do in the game**: when you are ready, end your turn, vote, change settings as the host, and, if you are the Blank, the guess you type. These are needed to run the game and are shown to the room according to the rules (for example, votes and the Blank's guess are revealed at the end of a round or game).
- Spoken clues are said out loud in the room; the game never records audio.

**When the TV opens a room**
- The TV app sends only its **display language**. It does not send any device identifier, Google account, location or list of apps.

**Technical information**
- To connect phones and the TV, the server creates random, temporary identifiers (a room code, a player id and secret "resume" and TV tokens so you can rejoin after a dropped connection). Tokens are stored only in hashed form on the server.
- Your **IP address** is used only briefly to prevent abuse (rate limiting). Our code does not store it in game data or write it to our logs; inside a room, only a short one-way hash of it is used while you are connected. **[LOGS]** Our hosting provider may keep technical request logs, which can include IP addresses, for up to 7 days for security and debugging.

**We do not collect:** your real name (unless you choose to use it as a nickname), email, phone number, contacts, photos, microphone or camera data, location, advertising identifiers, or browsing history.

## 3. Why we use it (legal bases)

We use this information only to run the game you asked to play (performance of the service you request) and to keep it secure and protect it from abuse (our legitimate interest). We do not use it for advertising, profiling or analytics.

## 4. How long we keep it

A game room and everything in it (nicknames, colours, languages, roles, words, votes, guesses, scores, hashed tokens) is deleted automatically:
- 15 minutes after the room was opened if nobody joined;
- 30 minutes after a game ends if nobody starts another one;
- in any case, at most 2 hours after the last activity in the room.

A player who disconnects keeps their seat for up to 2 minutes in the lobby, then is removed.

**[LOGS]** Technical request logs kept by our hosting provider are deleted after at most 7 days.

## 5. Information stored on your devices

- **Phone (browser storage):** your last nickname, colour and language, your vibration setting, and, for each room you joined, a resume token that lets you rejoin your seat; resume tokens are discarded after 6 hours. You can clear this at any time by clearing the site data in your browser.
- **TV:** only the sound on/off setting. The TV app does not back up any data to your Google account.

## 6. Who can see it, and who processes it

- **Other players in your room** see your nickname, colour and in-game actions as described above. Room codes are short-lived; anyone you give the code to can join the lobby, and the host can remove players.
- **Cloudflare, Inc.** hosts our server and processes this information on our behalf, on its global network, under its data processing terms. Rooms are usually created in a data centre close to the TV.
- **Google** distributes the app through Google Play; Google's own privacy policy applies to your use of Google Play.
- We do not sell, rent or share your information with anyone else, and we do not use advertising or analytics services.

## 7. International transfers

Our hosting provider may process data outside your country, including in the United States. When data from the European Economic Area, the UK or Switzerland is transferred, it is protected by the provider's contractual safeguards (such as the European Commission's Standard Contractual Clauses).

## 8. Children

Mish Ana! is a party game for teenagers and adults, often played with the whole family. It is not directed at children under 13 and does not knowingly collect personal information from them; players only enter a nickname, which is deleted automatically with the room. If you believe a child has entered personal information (for example a full name as a nickname), contact us and we will delete it if it still exists.

## 9. Your rights

Depending on where you live (for example under the GDPR in the EU/EEA and the UK), you have the right to access, correct or delete your personal data, to object to or restrict its use, and to data portability. Because we have no accounts and delete rooms automatically within hours, we usually cannot link any remaining data to you; but contact us at {{CONTACT_EMAIL}} with the room code and nickname and we will help. You can also lodge a complaint with your data protection authority (in France: the CNIL, www.cnil.fr).

## 10. Security

All connections between the TV app, the phones and the server are encrypted (HTTPS/WSS). Secret words are sent only to the phone of the player who owns them and never to the TV during play. Tokens are stored only as hashes.

## 11. Changes

If the game changes how it uses information (for example when optional in-app purchases are added), we will update this page and the date at the top before the change takes effect.

## 12. Contact

{{OWNER_NAME}} — {{CONTACT_EMAIL}}

---

## Français

# Politique de confidentialité — Mish Ana!

**Dernière mise à jour : 4 octobre 2026**

Mish Ana! (« le jeu ») est un jeu d’ambiance pour Android TV et Google TV. L’application TV héberge une salle de jeu ; les joueurs la rejoignent depuis le navigateur de leur téléphone. Cette politique explique quelles informations le jeu utilise, pourquoi et pendant combien de temps. Elle couvre l’application Android TV « Mish Ana! » (package `app.mishana.tv`) et la page web joueur ouverte par le QR code affiché sur la télé.

**Responsable du traitement.** {{OWNER_NAME}} (le développeur), contact : {{CONTACT_EMAIL}}.

## 1. En bref

- Pas de compte, pas de connexion, pas d’adresse e-mail, pas de numéro de téléphone.
- Pas de publicité, pas de statistiques d’audience, pas de pistage, pas de SDK tiers.
- Les joueurs saisissent un pseudo, visible par les autres joueurs de la salle.
- Chaque salle de jeu, avec les pseudos et tout ce qui y a été joué, est **supprimée automatiquement**, au plus tard 2 heures après la dernière activité.
- Nous ne vendons ni ne partageons jamais vos informations.

## 2. Informations utilisées

**Quand vous rejoignez une partie depuis votre téléphone**
- **Pseudo** (1 à 16 caractères) et **couleur** choisie : affichés sur la télé et sur les téléphones des autres joueurs de votre salle.
- **Votre langue** (français, anglais ou arabe) : pour afficher le jeu dans votre langue.
- **Vos actions dans le jeu** : « prêt », fin de tour, votes, réglages de l’hôte et, si vous êtes le Blanc, le mot que vous proposez. Elles servent à faire fonctionner la partie et sont montrées à la salle selon les règles (par exemple, les votes et la proposition du Blanc sont révélés à la fin d’une manche ou de la partie).
- Les indices se disent à voix haute ; le jeu n’enregistre jamais de son.

**Quand la télé ouvre une salle**
- L’application TV envoie seulement sa **langue d’affichage**. Elle n’envoie aucun identifiant d’appareil, compte Google, position ou liste d’applications.

**Informations techniques**
- Pour relier les téléphones et la télé, le serveur crée des identifiants aléatoires et temporaires (code de salle, identifiant de joueur, jetons secrets de reprise et de la télé pour revenir après une coupure). Les jetons ne sont conservés sur le serveur que sous forme hachée.
- Votre **adresse IP** n’est utilisée que brièvement pour prévenir les abus (limitation du nombre de requêtes). Notre code ne l’enregistre ni dans les données de jeu ni dans nos journaux ; dans une salle, seule une courte empreinte à sens unique est utilisée pendant votre connexion. **[LOGS]** Notre hébergeur peut conserver des journaux techniques de requêtes, pouvant contenir des adresses IP, pendant 7 jours au maximum, à des fins de sécurité et de débogage.

**Nous ne collectons pas :** votre vrai nom (sauf si vous l’utilisez comme pseudo), e-mail, numéro de téléphone, contacts, photos, micro ou caméra, position, identifiant publicitaire ou historique de navigation.

## 3. Finalités et bases légales

Ces informations servent uniquement à faire fonctionner la partie que vous avez demandée (exécution du service demandé) et à la protéger contre les abus (notre intérêt légitime). Elles ne servent ni à la publicité, ni au profilage, ni à des statistiques.

## 4. Durée de conservation

Une salle et tout son contenu (pseudos, couleurs, langues, rôles, mots, votes, propositions, scores, jetons hachés) sont supprimés automatiquement :
- 15 minutes après l’ouverture de la salle si personne ne l’a rejointe ;
- 30 minutes après la fin d’une partie si aucune autre n’est lancée ;
- dans tous les cas, au plus tard 2 heures après la dernière activité dans la salle.

Un joueur déconnecté garde sa place jusqu’à 2 minutes dans le salon d’attente, puis il est retiré.

**[LOGS]** Les journaux techniques conservés par notre hébergeur sont supprimés au plus tard après 7 jours.

## 5. Informations stockées sur vos appareils

- **Téléphone (stockage du navigateur) :** votre dernier pseudo, votre couleur et votre langue, le réglage de vibration et, pour chaque salle rejointe, un jeton de reprise permettant de retrouver votre place ; les jetons de reprise sont effacés après 6 heures. Vous pouvez tout effacer à tout moment en supprimant les données du site dans votre navigateur.
- **Télé :** uniquement le réglage du son (activé/désactivé). L’application TV ne sauvegarde aucune donnée sur votre compte Google.

## 6. Qui peut voir ces informations et qui les traite

- **Les autres joueurs de votre salle** voient votre pseudo, votre couleur et vos actions de jeu comme décrit ci-dessus. Les codes de salle sont éphémères ; toute personne à qui vous donnez le code peut rejoindre le salon, et l’hôte peut retirer des joueurs.
- **Cloudflare, Inc.** héberge notre serveur et traite ces informations pour notre compte, sur son réseau mondial, selon ses conditions de traitement des données. Les salles sont généralement créées dans un centre de données proche de la télé.
- **Google** distribue l’application via Google Play ; la politique de confidentialité de Google s’applique à votre utilisation de Google Play.
- Nous ne vendons, ne louons ni ne partageons vos informations avec qui que ce soit d’autre, et nous n’utilisons aucun service de publicité ou de statistiques.

## 7. Transferts internationaux

Notre hébergeur peut traiter des données hors de votre pays, notamment aux États-Unis. Les données provenant de l’Espace économique européen, du Royaume-Uni ou de la Suisse sont alors protégées par les garanties contractuelles de l’hébergeur (comme les clauses contractuelles types de la Commission européenne).

## 8. Enfants

Mish Ana! est un jeu d’ambiance destiné aux adolescents et aux adultes, souvent joué en famille. Il ne s’adresse pas aux enfants de moins de 13 ans et ne collecte pas sciemment de données personnelles les concernant ; les joueurs saisissent seulement un pseudo, supprimé automatiquement avec la salle. Si vous pensez qu’un enfant a saisi une information personnelle (par exemple son nom complet comme pseudo), contactez-nous et nous la supprimerons si elle existe encore.

## 9. Vos droits

Selon votre lieu de résidence (par exemple au titre du RGPD dans l’UE/EEE et au Royaume-Uni), vous disposez d’un droit d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité. Comme il n’y a pas de compte et que les salles sont supprimées automatiquement en quelques heures, nous ne pouvons généralement relier aucune donnée restante à vous ; écrivez-nous toutefois à {{CONTACT_EMAIL}} avec le code de la salle et votre pseudo, et nous vous aiderons. Vous pouvez aussi introduire une réclamation auprès de la CNIL (www.cnil.fr) ou de l’autorité de protection des données de votre pays.

## 10. Sécurité

Toutes les connexions entre l’application TV, les téléphones et le serveur sont chiffrées (HTTPS/WSS). Les mots secrets ne sont envoyés qu’au téléphone du joueur concerné et jamais à la télé pendant la partie. Les jetons ne sont conservés que sous forme hachée.

## 11. Modifications

Si le jeu change sa façon d’utiliser les informations (par exemple lors de l’ajout d’achats intégrés facultatifs), nous mettrons cette page et sa date à jour avant que le changement ne s’applique.

## 12. Contact

{{OWNER_NAME}} — {{CONTACT_EMAIL}}

---

## Appendix A — sources for each statement (do not publish)

| Statement | Code |
|---|---|
| No accounts; nickname only | `docs/PLAN.md:117`; join message `shared/src/protocol/messages.ts:33` (`name`, `color`, `locale`) |
| Nickname 1–16 characters, sanitised | `shared/src/constants.ts:9`; `server/src/room-core.ts:476` (`sanitizeName`) |
| Blank's guess, votes, ready/done | `shared/src/protocol/messages.ts:18`; engine state `shared/src/engine/types.ts:49-61,86,123` |
| TV sends only its language | `tv-app/app/src/main/java/app/mishana/tv/net/RoomApi.kt:35`; `server/src/http.ts:88` |
| Random temporary ids, hashed tokens | `docs/PLAN.md:93-95`; `server/src/room-store.ts:5-16` (`tvTokenHash`, `SessionRecord.tokenHash`); `server/src/http.ts` step 4 (`sha256hex(tvToken)`) |
| IP: rate limiting only; hashed ipKey; not logged | `server/src/request.ts:3-6`; `server/src/http.ts:68-69`; `server/src/index.ts:53`; `server/src/room-core.ts:41,79,198`; logging rule `docs/SPEC.md:1321-1325`; only log lines `server/src/http.ts:112`, `server/src/room-core.ts:722` |
| [LOGS] hosting provider logs ≤ 7 days | `server/wrangler.jsonc:8` (`observability.enabled`); Cloudflare Workers Logs max retention 7 days |
| No ads/analytics/SDKs | `tv-app/app/build.gradle.kts:86-110`; `web-client/public/_headers:2` (CSP `default-src 'self'`) |
| Deletion timings 15 min / 30 min / 2 h | `shared/src/constants.ts:21-23`; `server/src/room-core.ts:96-106,284-287`; `server/src/room-store.ts:70-71` |
| Seat held 2 min in lobby | `shared/src/constants.ts:12` (`SEAT_HOLD_MS = 120_000`, LOBBY) |
| Phone local storage keys, resume 6 h | `web-client/src/lib/storage.ts:6-16,52-73` |
| TV stores only sound setting; no backup | `tv-app/.../settings/SoundPrefs.kt:5-7` (debug-only `DebugPrefs` excluded from release behaviour, `docs/TV.md:161`); `AndroidManifest.xml:13` |
| Room created near the TV | `docs/PLAN.md:94` |
| Encrypted connections | `AndroidManifest.xml:19`; `tv-app/app/build.gradle.kts:71-84`; phone page served by the Worker over HTTPS |
| Words never sent to the TV during play | `docs/PLAN.md:97-101,109` |
| No audio recording / no mic permission | `AndroidManifest.xml:5` (only INTERNET) |

## Appendix B — block to insert when in-app purchases ship (from `docs/PAYMENTS-SPEC.md` §6.3)

**EN** (insert as a new subsection of section 2, and add "Purchases" to sections 4 and 6):

> **If you buy Premium or a word pack on the TV**
> Purchases are made through Google Play; we never see your card details, name, email or Google account. To unlock what you bought, the TV app creates a random installation identifier. Our server stores only a one-way hash of it and of your purchase token, together with the product, its status and expiry date. We use this only to unlock your purchases, restore them on your TVs and prevent fraud. Purchase records are deleted 400 days after the purchase is last used or expires; for refunded word packs we keep a minimal record (a hash and a "refunded" flag) so a refunded purchase cannot be unlocked again. Clearing the TV app's data creates a new identifier; your purchases can be restored through Google Play.

**FR:**

> **Si vous achetez Premium ou un pack de mots sur la télé**
> Les achats passent par Google Play ; nous ne voyons jamais vos coordonnées bancaires, votre nom, votre e-mail ou votre compte Google. Pour débloquer vos achats, l’application TV crée un identifiant d’installation aléatoire. Notre serveur ne conserve qu’une empreinte à sens unique de cet identifiant et de votre jeton d’achat, avec le produit, son statut et sa date d’expiration. Ces données servent uniquement à débloquer et restaurer vos achats et à prévenir la fraude. Les données d’achat sont supprimées 400 jours après la dernière utilisation ou l’expiration de l’achat ; pour les packs remboursés, nous gardons un enregistrement minimal (une empreinte et un indicateur « remboursé ») afin qu’un achat remboursé ne puisse pas être débloqué à nouveau. Effacer les données de l’application TV crée un nouvel identifiant ; vos achats peuvent être restaurés via Google Play.
