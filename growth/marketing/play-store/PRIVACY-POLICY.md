# JAMAA: Privacy policy (EN + FR + AR) for `/privacy`

**Rewritten 2026-11-17** for the v1 store submission (owner decisions of that day: free at launch, billing off, no Spicy 18+ mode, production Worker `jamaa` at https://jamaa.mishana.workers.dev). It now states what the monitoring added in JAMAA-PLATFORM §8 really collects (PII-scrubbed client error reports, Analytics Engine events, the `X-Jamaa-Client` header), the real room lifetimes (15 min after the TV leaves, at most 12 h after the last activity: the old "2 hours" was wrong) and the retention of each store (Stats DO 48 h, Analytics Engine about 3 months, Cloudflare logs 7 days). Appendix B (the JAMAA Pass) stays out until `BILLING_ENABLED` is turned on.

The published copy is `growth/site/privacy/index.html` (EN, FR, AR). Its three articles are the three language sections of this file converted to HTML (headings, lists, bold, code); keep both in step. The support contact is the existing `SUPPORT_EMAIL` (`shared/src/billing/products.ts`), filled in at site build time from `growth/site/site.config.json` (`contactEmail`, `ownerName`; the placeholders `{{OWNER_NAME}}` / `{{CONTACT_EMAIL}}` stay in the text). Play Console wants the public URL of the page (no PDF): `<site origin>/privacy/`.

The **[LOGS]** question of the old file is settled: invocation logs stay on (`server/wrangler.jsonc` `observability.logs.invocation_logs: true`, 7 days), so the policy says Cloudflare may keep request logs that can include IP addresses for up to 7 days. The Data safety answers are the same either way.

---

## English

# Privacy policy: JAMAA

**Last updated: November 17, 2026**

JAMAA ("the app", "the games") is a party-games app for Android TV and Google TV with five games: Mish Ana!, Bluff!, Most Likely, Quiz Night and Taqriban!. The TV app hosts a game room; players join from their phones in a web browser. This policy explains what information the app uses, why, and for how long. It covers the Android TV app "JAMAA" (package `app.jamaa.tv`), the TV page that runs the games in a web browser at <span dir="ltr">jamaa.mishana.workers.dev/tv</span>, and the player web page that the QR code on the TV opens. JAMAA is free, with no ads and no purchases.

**Who is responsible.** {{OWNER_NAME}} (the developer), contact: {{CONTACT_EMAIL}}.

## 1. The short version

- No accounts, no sign-in, no email address, no phone number.
- No ads, no purchases, no tracking, no third-party SDKs, no advertising or analytics services.
- Players type a nickname. That nickname is visible to the other players in the room. Answers you type in a game (a guess in Mish Ana!, a made-up answer in Bluff!) are shown to the room too.
- Every game room, with the nicknames and everything played in it, is **deleted automatically** when the room closes: 15 minutes after the TV leaves, and in any case at most 12 hours after the last activity.
- To know whether the games work, we collect **anonymous usage counts** and **error reports with personal details removed** (section 2). They never contain nicknames or what players type.
- We never sell or share your information.

## 2. Information we use

**When you join a game from your phone**
- **Nickname** (1–16 characters) and the **colour** you pick: shown on the TV and on the other players' phones in your room.
- **Your language** (English, French, Arabic or Spanish): to show the game in your language.
- **What you do in the game**: when you are ready, vote, tap a player (Most Likely), choose an answer (Quiz Night), enter a number (Taqriban!), change settings as the host, and the text you type (a guess of up to 200 characters in Mish Ana!, a made-up answer of up to 480 characters in Bluff!). These are needed to run the game and are shown to the room according to the rules (for example, votes and answers are revealed at the end of a round).
- Spoken clues are said out loud in the room; the apps never record audio.

**When the TV opens a room**
- The TV app sends its **display language**, its **platform and app version** (in a header named `X-Jamaa-Client`, for example "tv-android/1.0.0") and a short list of the **ids of questions and cards it has already shown**, so the games do not repeat them. It does not send any device identifier, Google account, location or list of apps.

**Technical information**
- To connect phones and the TV, the server creates random, temporary identifiers (a room code, a player id and secret "resume" and TV tokens so you can rejoin after a dropped connection). Tokens are stored only in hashed form on the server.
- Your **IP address** is used only briefly to prevent abuse (rate limiting: how many rooms, connections or error reports one address can open per minute). Our code does not store it in game data, in usage statistics or in error reports, and does not write it to our logs; inside a room, only a short one-way hash of it (mixed with the room code) is used while you are connected. Our hosting provider may keep technical request logs, which can include IP addresses, for up to 7 days for security and debugging.

**Error reports (so we can fix bugs)**
When the TV app, the TV web page or the player page hits an error, it can send us a short report: the platform (phone, TV web page or Android TV), the app version, the screen or page where it happened (for example a screen name, or the page path), the kind of error, the error message and technical stack trace (cut to at most 300 and 1,500 characters), how many times it happened and, optionally, the room code. Before the report is kept, the server removes email addresses, URL query strings, and long codes and numbers that could be tokens or identifiers. A report never contains your nickname, what you typed, a device identifier or your IP address. Each client sends only a few reports per session.

**Usage statistics (so we know whether the games are played and work)**
The server records anonymous events, one record per event, never one per message: a room was created (language, platform); a room closed (why, and how many players had joined); a game started (which game, number of players, language, platform); a game ended (which game, number of players, duration, and whether it finished, was stopped, abandoned or expired); a player joined or left (platform only); and when a host skips or hides a question or card (which game, the content pack and item id, the language and platform) so we can improve the content. These records contain no nicknames, no typed text, no IP addresses and no tokens. Live counters (rooms and games now, counts per hour) are kept in the same way.

**We do not collect:** your real name (unless you choose to use it as a nickname), email, phone number, contacts, photos, microphone or camera data, location, advertising identifiers, or browsing history.

## 3. Why we use it (legal bases)

We use game information only to run the game you asked to play (performance of the service you request). We use the IP address, error reports and usage statistics to keep the service secure, to protect it from abuse, to find and fix bugs and to understand, in aggregate, which games are played (our legitimate interest). We do not use anything for advertising or profiling, and none of it is linked to an identity.

## 4. How long we keep it

- **Game rooms.** A room and everything in it (nicknames, colours, languages, scores, votes, typed answers, hashed tokens) is deleted automatically when the room closes: 15 minutes after the TV leaves the room (or after it was opened if the TV never connected), and, while a TV stays connected, at most 12 hours after the last activity in the room. A player who disconnects keeps their seat for up to 2 minutes in the lobby, then is removed.
- **Live counters.** Hourly counts are kept for 48 hours. The error list keeps only the 100 most recent errors.
- **Usage statistics and error records** stored in Cloudflare's Analytics Engine: about 3 months, then Cloudflare deletes them.
- **Technical request logs** kept by our hosting provider, including the error-report log lines: at most 7 days.

## 5. Information stored on your devices

- **Phone (browser storage):** your last nickname, colour and language, your vibration setting, and, for each room you joined, a resume token that lets you rejoin your seat; resume tokens are discarded after 6 hours. You can clear this at any time by clearing the site data in your browser.
- **TV:** the sound on/off and calm-animation settings, the ids of questions and cards already shown (so games do not repeat), and, if the app crashes, a short crash report that is kept until the next launch, sent once and deleted. The app does not back up any data to your Google account.

## 6. Who can see it, and who processes it

- **Other players in your room** see your nickname, colour, typed answers and in-game actions as described above. Room codes are short-lived; anyone you give the code to can join the lobby, and the host can remove players.
- **Cloudflare, Inc.** hosts our server, stores the room data, the usage statistics and the error reports, and processes this information on our behalf, on its global network, under its data processing terms. Rooms are usually created in a data centre close to the TV.
- **Google** distributes the app through Google Play; Google's own privacy policy applies to your use of Google Play, and Google may show us crash and quality statistics for the app.
- We do not sell, rent or share your information with anyone else, and the app does not use advertising or analytics services. This website uses Cloudflare Web Analytics, without cookies (see section 12).

## 7. International transfers

Our hosting provider may process data outside your country, including in the United States. When data from the European Economic Area, the UK or Switzerland is transferred, it is protected by the provider's contractual safeguards (such as the European Commission's Standard Contractual Clauses).

## 8. Children

JAMAA and its games are made for teenagers and adults, often played with the whole family. They are not directed at children under 13 and do not knowingly collect personal information from them; players only enter a nickname and, in some games, short answers, which are deleted automatically with the room. If you believe a child has entered personal information (for example a full name as a nickname), contact us and we will delete it if it still exists.

## 9. Your rights

Depending on where you live (for example under the GDPR in the EU/EEA and the UK), you have the right to access, correct or delete your personal data, to object to or restrict its use, and to data portability. Because we have no accounts, delete rooms automatically within hours, and record no nicknames in usage statistics or error reports, we usually cannot link any remaining data to you; but contact us at {{CONTACT_EMAIL}} with the room code and nickname and we will help. You can also lodge a complaint with your data protection authority (in France: the CNIL, www.cnil.fr).

## 10. Security

All connections between the TV app, the phones and the server are encrypted (HTTPS/WSS). Secret words are sent only to the phone of the player who owns them and never to the TV during play. Tokens are stored only as hashes.

## 11. Changes

If the app changes how it uses information (for example if optional purchases are added later), we will update this page and the date at the top before the change takes effect.

## 12. This website

This section covers only the website you are reading (not the games). To know how many people visit and which buttons and ads work, it uses:

- Cloudflare Web Analytics: counts page views and page-load performance. It does not use cookies or local storage and does not fingerprint visitors. Cloudflare processes this on our behalf.

- Anonymous click counts sent to our own server when you press a button such as “Install on my TV” or “Play in your browser”, open a question, or scroll: which button or section, the page language, the ad campaign named in the link (utm tags), the device type (phone or computer) and the country Cloudflare derives from the connection. No identifier, no cookie, and your IP address is not stored. These counts are kept for at most 3 months.

- Your language choice is remembered in your browser (local storage) so the site opens in your language next time. It never leaves your device.

If your browser sends Global Privacy Control or Do Not Track, none of this measurement runs. We use it on the basis of our legitimate interest in understanding, in aggregate, how the website is used. Clicking through to Google Play takes you to Google, whose own privacy policy applies.

## 13. Contact

{{OWNER_NAME}} — {{CONTACT_EMAIL}}

---

## Français

# Politique de confidentialité : JAMAA

**Dernière mise à jour : 17 novembre 2026**

JAMAA (« l’application », « les jeux ») est une appli de jeux d’ambiance pour Android TV et Google TV, avec cinq jeux : Mish Ana!, Bluff !, Qui risque le plus ?, Soirée quiz et À peu près !. L’application TV héberge une salle de jeu ; les joueurs la rejoignent depuis le navigateur de leur téléphone. Cette politique explique quelles informations l’application utilise, pourquoi et pendant combien de temps. Elle couvre l’application Android TV « JAMAA » (package `app.jamaa.tv`), la page télé qui fait tourner les jeux dans un navigateur web sur <span dir="ltr">jamaa.mishana.workers.dev/tv</span>, et la page web joueur ouverte par le QR code affiché sur la télé. JAMAA est gratuit, sans publicité et sans achat.

**Responsable du traitement.** {{OWNER_NAME}} (le développeur), contact : {{CONTACT_EMAIL}}.

## 1. En bref

- Pas de compte, pas de connexion, pas d’adresse e-mail, pas de numéro de téléphone.
- Pas de publicité, pas d’achat, pas de pistage, pas de SDK tiers, aucun service de publicité ou de statistiques d’audience.
- Les joueurs saisissent un pseudo, visible par les autres joueurs de la salle. Les réponses saisies dans un jeu (une proposition dans Mish Ana!, une fausse réponse dans Bluff !) sont aussi montrées à la salle.
- Chaque salle de jeu, avec les pseudos et tout ce qui y a été joué, est **supprimée automatiquement** à sa fermeture : 15 minutes après le départ de la télé, et dans tous les cas au plus tard 12 heures après la dernière activité.
- Pour savoir si les jeux fonctionnent, nous collectons des **comptages d’usage anonymes** et des **rapports d’erreur dépourvus de données personnelles** (section 2). Ils ne contiennent jamais de pseudo ni ce que les joueurs saisissent.
- Nous ne vendons ni ne partageons jamais vos informations.

## 2. Informations utilisées

**Quand vous rejoignez une partie depuis votre téléphone**
- **Pseudo** (1 à 16 caractères) et **couleur** choisie : affichés sur la télé et sur les téléphones des autres joueurs de votre salle.
- **Votre langue** (français, anglais, arabe ou espagnol) : pour afficher le jeu dans votre langue.
- **Vos actions dans le jeu** : « prêt », votes, choix d’un joueur (Qui risque le plus ?), choix d’une réponse (Soirée quiz), saisie d’un nombre (À peu près !), réglages de l’hôte, et le texte que vous saisissez (une proposition de 200 caractères au plus dans Mish Ana!, une fausse réponse de 480 caractères au plus dans Bluff !). Elles servent à faire fonctionner la partie et sont montrées à la salle selon les règles (par exemple, votes et réponses sont révélés à la fin d’une manche).
- Les indices se disent à voix haute ; l’application n’enregistre jamais de son.

**Quand la télé ouvre une salle**
- L’application TV envoie sa **langue d’affichage**, sa **plateforme et la version de l’application** (dans un en-tête nommé `X-Jamaa-Client`, par exemple « tv-android/1.0.0 ») et une courte liste des **identifiants des questions et cartes déjà affichées**, pour que les jeux ne se répètent pas. Elle n’envoie aucun identifiant d’appareil, compte Google, position ou liste d’applications.

**Informations techniques**
- Pour relier les téléphones et la télé, le serveur crée des identifiants aléatoires et temporaires (code de salle, identifiant de joueur, jetons secrets de reprise et de la télé pour revenir après une coupure). Les jetons ne sont conservés sur le serveur que sous forme hachée.
- Votre **adresse IP** n’est utilisée que brièvement pour prévenir les abus (limitation du débit : combien de salles, de connexions ou de rapports d’erreur une même adresse peut ouvrir par minute). Notre code ne l’enregistre ni dans les données de jeu, ni dans les statistiques d’usage, ni dans les rapports d’erreur, et ne l’écrit pas dans nos journaux ; dans une salle, seule une courte empreinte à sens unique (mélangée au code de la salle) est utilisée pendant votre connexion. Notre hébergeur peut conserver des journaux techniques de requêtes, pouvant contenir des adresses IP, pendant 7 jours au plus, pour la sécurité et le débogage.

**Rapports d’erreur (pour corriger les bugs)**
Quand l’application TV, la page télé web ou la page joueur rencontre une erreur, elle peut nous envoyer un court rapport : la plateforme (téléphone, page télé web ou Android TV), la version de l’application, l’écran ou la page concernée (par exemple un nom d’écran ou le chemin de la page), le type d’erreur, le message d’erreur et la trace technique (coupés à 300 et 1 500 caractères au plus), le nombre de fois où elle s’est produite et, facultativement, le code de la salle. Avant conservation, le serveur retire les adresses e-mail, les paramètres d’URL, ainsi que les longs codes et nombres pouvant être des jetons ou des identifiants. Un rapport ne contient jamais votre pseudo, ce que vous avez saisi, un identifiant d’appareil ni votre adresse IP. Chaque appareil n’envoie que quelques rapports par session.

**Statistiques d’usage (pour savoir si les jeux sont joués et fonctionnent)**
Le serveur enregistre des événements anonymes, un enregistrement par événement, jamais un par message : une salle a été créée (langue, plateforme) ; une salle a été fermée (pourquoi, et combien de joueurs l’avaient rejointe) ; une partie a commencé (quel jeu, nombre de joueurs, langue, plateforme) ; une partie s’est terminée (quel jeu, nombre de joueurs, durée, et si elle est allée au bout, a été arrêtée, abandonnée ou a expiré) ; un joueur est arrivé ou parti (plateforme seulement) ; et quand un hôte passe ou masque une question ou une carte (quel jeu, le pack et l’identifiant de l’élément, la langue et la plateforme), pour améliorer le contenu. Ces enregistrements ne contiennent ni pseudo, ni texte saisi, ni adresse IP, ni jeton. Des compteurs en direct (salles et parties en cours, comptages par heure) sont tenus de la même façon.

**Nous ne collectons pas :** votre vrai nom (sauf si vous l’utilisez comme pseudo), e-mail, numéro de téléphone, contacts, photos, micro ou caméra, position, identifiant publicitaire ou historique de navigation.

## 3. Finalités et bases légales

Nous utilisons les informations de jeu uniquement pour faire fonctionner la partie que vous avez demandée (exécution du service demandé). Nous utilisons l’adresse IP, les rapports d’erreur et les statistiques d’usage pour assurer la sécurité du service, le protéger des abus, trouver et corriger les bugs et comprendre, de façon agrégée, quels jeux sont joués (notre intérêt légitime). Rien n’est utilisé pour la publicité ou le profilage, et rien n’est rattaché à une identité.

## 4. Durée de conservation

- **Salles de jeu.** Une salle et tout son contenu (pseudos, couleurs, langues, scores, votes, réponses saisies, jetons hachés) sont supprimés automatiquement à la fermeture de la salle : 15 minutes après le départ de la télé (ou après l’ouverture si la télé ne s’est jamais connectée) et, tant qu’une télé reste connectée, au plus 12 heures après la dernière activité dans la salle. Un joueur déconnecté garde sa place jusqu’à 2 minutes dans le salon d’attente, puis il est retiré.
- **Compteurs en direct.** Les comptages horaires sont conservés 48 heures. La liste d’erreurs ne garde que les 100 plus récentes.
- **Statistiques d’usage et enregistrements d’erreur** stockés dans Analytics Engine de Cloudflare : environ 3 mois, puis Cloudflare les supprime.
- **Journaux techniques de requêtes** conservés par notre hébergeur, y compris les lignes de journal des rapports d’erreur : 7 jours au plus.

## 5. Informations stockées sur vos appareils

- **Téléphone (stockage du navigateur) :** votre dernier pseudo, votre couleur et votre langue, le réglage de vibration et, pour chaque salle rejointe, un jeton de reprise permettant de retrouver votre place ; les jetons de reprise sont effacés après 6 heures. Vous pouvez tout effacer à tout moment en supprimant les données du site dans votre navigateur.
- **Télé :** les réglages du son et des animations calmes, les identifiants des questions et cartes déjà affichées (pour éviter les répétitions) et, si l’application plante, un court rapport de plantage conservé jusqu’au lancement suivant, envoyé une fois puis supprimé. L’application ne sauvegarde aucune donnée sur votre compte Google.

## 6. Qui peut voir ces informations et qui les traite

- **Les autres joueurs de votre salle** voient votre pseudo, votre couleur, vos réponses saisies et vos actions de jeu comme décrit ci-dessus. Les codes de salle sont éphémères ; toute personne à qui vous donnez le code peut rejoindre le salon, et l’hôte peut retirer des joueurs.
- **Cloudflare, Inc.** héberge notre serveur, stocke les données de salle, les statistiques d’usage et les rapports d’erreur, et traite ces informations pour notre compte, sur son réseau mondial, selon ses conditions de traitement des données. Les salles sont généralement créées dans un centre de données proche de la télé.
- **Google** distribue l’application via Google Play ; la politique de confidentialité de Google s’applique à votre utilisation de Google Play, et Google peut nous montrer des statistiques de plantages et de qualité de l’application.
- Nous ne vendons, ne louons ni ne partageons vos informations avec qui que ce soit d’autre, et l’application n’utilise aucun service de publicité ou de statistiques d’audience. Ce site web utilise Cloudflare Web Analytics, sans cookie (voir la section 12).

## 7. Transferts internationaux

Notre hébergeur peut traiter des données hors de votre pays, notamment aux États-Unis. Les données provenant de l’Espace économique européen, du Royaume-Uni ou de la Suisse sont alors protégées par les garanties contractuelles de l’hébergeur (comme les clauses contractuelles types de la Commission européenne).

## 8. Enfants

JAMAA et ses jeux sont destinés aux adolescents et aux adultes, et souvent joués en famille. Ils ne s’adressent pas aux enfants de moins de 13 ans et ne collectent pas sciemment de données personnelles les concernant ; les joueurs saisissent seulement un pseudo et, dans certains jeux, de courtes réponses, supprimés automatiquement avec la salle. Si vous pensez qu’un enfant a saisi une information personnelle (par exemple son nom complet comme pseudo), contactez-nous et nous la supprimerons si elle existe encore.

## 9. Vos droits

Selon votre lieu de résidence (par exemple au titre du RGPD dans l’UE/EEE et au Royaume-Uni), vous disposez d’un droit d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité. Comme il n’y a pas de compte, que les salles sont supprimées automatiquement en quelques heures et qu’aucun pseudo n’est enregistré dans les statistiques d’usage ni les rapports d’erreur, nous ne pouvons généralement relier aucune donnée restante à vous ; écrivez-nous toutefois à {{CONTACT_EMAIL}} avec le code de la salle et votre pseudo, et nous vous aiderons. Vous pouvez aussi introduire une réclamation auprès de la CNIL (www.cnil.fr) ou de l’autorité de protection des données de votre pays.

## 10. Sécurité

Toutes les connexions entre l’application TV, les téléphones et le serveur sont chiffrées (HTTPS/WSS). Les mots secrets ne sont envoyés qu’au téléphone du joueur concerné et jamais à la télé pendant la partie. Les jetons ne sont conservés que sous forme hachée.

## 11. Modifications

Si l’application change sa façon d’utiliser les informations (par exemple si des achats facultatifs sont ajoutés plus tard), nous mettrons cette page et sa date à jour avant que le changement ne s’applique.

## 12. Ce site web

Cette section concerne uniquement le site que vous lisez (pas les jeux). Pour savoir combien de personnes le visitent et quels boutons et quelles publicités fonctionnent, il utilise :

- Cloudflare Web Analytics : compte les pages vues et la vitesse de chargement. Aucun cookie, aucun stockage local, aucune prise d’empreinte du navigateur. Cloudflare traite ces données pour notre compte.

- Des comptages anonymes de clics, envoyés à notre propre serveur quand vous touchez un bouton comme « Installer sur ma télé » ou « Jouer dans le navigateur », ouvrez une question ou faites défiler la page : quel bouton ou quelle section, la langue de la page, la campagne publicitaire indiquée dans le lien (balises utm), le type d’appareil (téléphone ou ordinateur) et le pays déduit par Cloudflare de la connexion. Aucun identifiant, aucun cookie, et votre adresse IP n’est pas conservée. Ces comptages sont gardés 3 mois au plus.

- Votre choix de langue est mémorisé dans votre navigateur (stockage local) pour que le site s’ouvre dans votre langue la prochaine fois. Il ne quitte jamais votre appareil.

Si votre navigateur envoie Global Privacy Control ou Do Not Track, aucune de ces mesures n’est effectuée. Cette mesure repose sur notre intérêt légitime à comprendre, de façon agrégée, l’utilisation du site. En suivant le lien vers Google Play, vous arrivez chez Google, dont la propre politique de confidentialité s’applique.

## 13. Contact

{{OWNER_NAME}} — {{CONTACT_EMAIL}}

---

## العربية

# سياسة الخصوصية

**آخر تحديث: 17 تشرين الثاني 2026** · ترجمة عربية للنسخة الإنكليزية، وبحال في أي اختلاف، النسخة الإنكليزية هي المعتمدة.

«جماعة» («التطبيق» أو «الألعاب») تطبيق ألعاب سهرة لـ Android TV و Google TV فيه خمس ألعاب: «مش أنا!»، «بلوف!»، «مين فينا؟»، «سهرة أسئلة» و«تقريبًا!». تطبيق التلفزيون بيفتح غرفة لعب، واللاعبين بيدخلوا من تلفوناتهم بمتصفّح الإنترنت. هالسياسة بتشرح شو المعلومات اللي بيستعملها التطبيق، ولشو، ولأي مدّة. وبتغطّي تطبيق Android TV «جماعة» (الحزمة `app.jamaa.tv`)، وصفحة التلفزيون اللي بتشغّل الألعاب بمتصفّح على <span dir="ltr">jamaa.mishana.workers.dev/tv</span>، وصفحة اللاعب اللي بيفتحها الـ QR على التلفزيون. «جماعة» مجانية، بلا إعلانات وبلا مشتريات.

**المسؤول.** {{OWNER_NAME}} (المطوّر)، للتواصل: {{CONTACT_EMAIL}}.

## 1. باختصار

- ما في حسابات، ولا تسجيل دخول، ولا إيميل، ولا رقم تلفون.
- بلا إعلانات، بلا مشتريات، بلا تتبّع، بلا أدوات طرف ثالث (SDK)، وبلا خدمات إعلانات أو إحصائيات.
- اللاعبين بيكتبوا اسم مستعار، وبيشوفو باقي اللاعبين بالغرفة. والأجوبة اللي بتكتبا بلعبة (تخمين بـ«مش أنا!»، جواب مفبرك بـ«بلوف!») بتنعرض للغرفة كمان.
- كل غرفة لعب، مع الأسماء المستعارة وكل شي انلعب فيها، **بتنمحى لحالها** لمّا تسكّر الغرفة: بعد 15 دقيقة من مغادرة التلفزيون، وعلى أي حال بحدّ أقصى 12 ساعة بعد آخر نشاط.
- لنعرف إذا الألعاب شغّالة، منجمع **أعداد استعمال مجهولة** و**تقارير أخطاء مشطوبة منها البيانات الشخصية** (القسم 2). ما فيها أبدًا أسماء مستعارة ولا اللي كتبو اللاعبين.
- ما منبيع ولا منشارك معلوماتك مع حدا.

## 2. المعلومات اللي منستعملها

**لمّا تدخل لعبة من تلفونك**
- **الاسم المستعار** (من 1 لـ16 حرف) و**اللون** اللي بتنقّيه: بيظهروا عالتلفزيون وعتلفونات باقي اللاعبين بغرفتك.
- **لغتك** (إنكليزي، فرنسي، عربي أو إسباني): لنعرض اللعبة بلغتك.
- **شو بتعمل باللعبة**: لمّا تصير جاهز، تصوّت، تكبس على لاعب («مين فينا؟»)، تختار جواب («سهرة أسئلة»)، تكتب رقم («تقريبًا!»)، تغيّر إعدادات كمضيف، والنص اللي بتكتبو (تخمين لحدّ 200 حرف بـ«مش أنا!»، جواب مفبرك لحدّ 480 حرف بـ«بلوف!»). هيدي لازمة لتشغيل اللعبة وبتنعرض للغرفة حسب القواعد (مثلًا الأصوات والأجوبة بتنكشف بآخر الجولة).
- التلميحات بتنقال بصوت عالي بالغرفة، والتطبيق ما بيسجّل صوت أبدًا.

**لمّا التلفزيون يفتح غرفة**
- تطبيق التلفزيون بيبعت **لغة العرض**، و**المنصّة ورقم نسخة التطبيق** (بهيدر اسمو `X-Jamaa-Client`، مثلًا «tv-android/1.0.0») وقايمة قصيرة بـ**معرّفات الأسئلة والكروت اللي عرضها قبل** لئلّا تتكرّر الألعاب. وما بيبعت أي معرّف جهاز، ولا حساب Google، ولا موقع، ولا قايمة تطبيقات.

**معلومات تقنية**
- لنوصّل التلفونات بالتلفزيون، السيرفر بيعمل معرّفات عشوائية ومؤقتة (كود الغرفة، معرّف اللاعب، ورموز سرّية للرجوع وللتلفزيون لتقدر ترجع بعد ما ينقطع الاتصال). الرموز بتنحفظ عالسيرفر بشكل مشفّر (hash) بس.
- **عنوان الـ IP** تبعك بنستعملو لمدّة قصيرة لمنع الإساءة (تحديد المعدّل: كم غرفة أو اتصال أو تقرير خطأ بيقدر يفتح عنوان واحد بالدقيقة). كودنا ما بيخزّنو ببيانات اللعب ولا بإحصائيات الاستعمال ولا بتقارير الأخطاء، وما بيكتبو بسجلّاتنا؛ وجوّا الغرفة بينستعمل بس بصمة قصيرة باتجاه واحد منو (مخلوطة مع كود الغرفة) طول ما أنت متّصل. مزوّد الاستضافة ممكن يحتفظ بسجلّات تقنية للطلبات، فيها ممكن عناوين IP، لحدّ 7 أيام للأمان وتصحيح الأخطاء.

**تقارير الأخطاء (لنصلّح الأعطال)**
لمّا تطبيق التلفزيون، أو صفحة التلفزيون، أو صفحة اللاعب يصادفوا خطأ، ممكن يبعتولنا تقرير قصير: المنصّة (تلفون، صفحة تلفزيون، أو Android TV)، نسخة التطبيق، الشاشة أو الصفحة اللي صار فيها (مثلًا اسم شاشة أو مسار الصفحة)، نوع الخطأ، رسالة الخطأ وأثرها التقني (مقصوصة لـ300 و1500 حرف بالحدّ الأقصى)، كم مرّة صار، واختياريًا كود الغرفة. قبل ما نحفظ التقرير، السيرفر بيشيل عناوين الإيميل، ووسائط الروابط (query)، والأكواد والأرقام الطويلة اللي ممكن تكون رموز أو معرّفات. التقرير ما فيه أبدًا اسمك المستعار، ولا اللي كتبتو، ولا معرّف جهاز، ولا عنوان IP. وكل جهاز بيبعت كم تقرير بس بالجلسة.

**إحصائيات الاستعمال (لنعرف إذا الألعاب عم تنلعب وعم تشتغل)**
السيرفر بيسجّل أحداث مجهولة، سجلّ واحد لكل حدث وما في سجلّ لكل رسالة: غرفة انفتحت (اللغة، المنصّة)؛ غرفة سكّرت (ليش، وكم لاعب كانوا دخلوا)؛ لعبة بلّشت (أيّ لعبة، عدد اللاعبين، اللغة، المنصّة)؛ لعبة خلصت (أيّ لعبة، عدد اللاعبين، المدّة، وإذا خلصت للآخر أو وقفت أو انهجرت أو انتهت صلاحيتها)؛ لاعب دخل أو طلع (المنصّة بس)؛ ولمّا المضيف بيتخطّى أو بيخبّي سؤال أو كرت (أيّ لعبة، الحزمة ومعرّف العنصر، اللغة والمنصّة) لنحسّن المحتوى. هالسجلّات ما فيها أسماء مستعارة، ولا نص مكتوب، ولا عناوين IP، ولا رموز. وبنحتفظ بعدّادات حيّة (الغرف والألعاب هلّق، أعداد كل ساعة) بنفس الطريقة.

**ما منجمع:** اسمك الحقيقي (إلّا إذا اخترتو كاسم مستعار)، الإيميل، رقم التلفون، جهات الاتصال، الصور، الميكروفون أو الكاميرا، الموقع، معرّفات الإعلانات، أو سجلّ التصفّح.

## 3. ليش منستعملها (الأسس القانونية)

منستعمل معلومات اللعب بس لتشغيل اللعبة اللي طلبتها (تنفيذ الخدمة اللي بتطلبها). ومنستعمل عنوان الـ IP وتقارير الأخطاء وإحصائيات الاستعمال لنحافظ على أمان الخدمة ونحميها من الإساءة، ولنلاقي الأعطال ونصلّحها، ولنفهم بشكل إجمالي أيّ ألعاب عم تنلعب (مصلحتنا المشروعة). ما منستعمل شي للإعلانات أو للتنميط، وما في شي مربوط بهويّة.

## 4. لأي مدّة منحتفظ فيها

- **غرف اللعب.** الغرفة وكل شي فيها (أسماء مستعارة، ألوان، لغات، نقاط، أصوات، أجوبة مكتوبة، رموز مشفّرة) بتنمحى لحالها لمّا تسكّر الغرفة: بعد 15 دقيقة من مغادرة التلفزيون (أو من فتحها إذا التلفزيون ما اتّصل أبدًا)، ومادام تلفزيون متّصل، بحدّ أقصى 12 ساعة بعد آخر نشاط بالغرفة. اللاعب اللي بينقطع اتصالو بيحتفظ بمقعدو لحدّ دقيقتين بصالة الانتظار، وبعدين بيتشال.
- **العدّادات الحيّة.** أعداد كل ساعة بتنحفظ 48 ساعة. وقايمة الأخطاء بتحتفظ بس بآخر 100 خطأ.
- **إحصائيات الاستعمال وسجلّات الأخطاء** المخزّنة بـ Analytics Engine عند Cloudflare: حوالي 3 شهور، وبعدها Cloudflare بتمحيها.
- **سجلّات الطلبات التقنية** عند مزوّد الاستضافة، بما فيها أسطر سجلّ تقارير الأخطاء: 7 أيام بالحدّ الأقصى.

## 5. المعلومات المخزّنة على أجهزتك

- **التلفون (تخزين المتصفّح):** آخر اسم مستعار ولون ولغة، إعداد الاهتزاز، ولكل غرفة دخلتا رمز رجوع بيخلّيك ترجع لمقعدك؛ رموز الرجوع بتنرمي بعد 6 ساعات. فيك تمحي هالشي بأي وقت بمسح بيانات الموقع من متصفّحك.
- **التلفزيون:** إعدادات الصوت والحركات الهادية، معرّفات الأسئلة والكروت المعروضة سابقًا (لئلّا تتكرّر)، وإذا التطبيق وقع، تقرير توقّف قصير بيضلّ لحدّ التشغيل الجاي، بينبعت مرّة وحدة وبينمحى. التطبيق ما بيحفظ نسخة احتياطية من أي بيانات على حساب Google تبعك.

## 6. مين بيشوفها ومين بيعالجها

- **باقي اللاعبين بغرفتك** بيشوفو اسمك المستعار ولونك وأجوبتك المكتوبة وحركاتك باللعبة متل ما انشرح فوق. أكواد الغرف قصيرة العمر؛ أي حدا بتعطيه الكود بيقدر يفوت على صالة الانتظار، والمضيف بيقدر يطرد لاعبين.
- **Cloudflare, Inc.** بتستضيف سيرفرنا، وبتخزّن بيانات الغرف وإحصائيات الاستعمال وتقارير الأخطاء، وبتعالج هالمعلومات عن لساننا، عبر شبكتها العالمية، حسب شروط معالجة البيانات تبعها. الغرف غالبًا بتنفتح بمركز بيانات قريب من التلفزيون.
- **Google** بتوزّع التطبيق عبر Google Play؛ سياسة الخصوصية تبع Google بتنطبق على استعمالك لـ Google Play، وممكن Google تعرضلنا إحصائيات الأعطال والجودة للتطبيق.
- ما منبيع ولا منأجّر ولا منشارك معلوماتك مع حدا تاني، والتطبيق ما بيستعمل خدمات إعلانات أو إحصائيات. وهالموقع بيستعمل Cloudflare Web Analytics بلا كوكيز (شوف القسم 12).

## 7. النقل الدولي

مزوّد الاستضافة ممكن يعالج بيانات خارج بلدك، منها بالولايات المتحدة. ولمّا بتنتقل بيانات من المنطقة الاقتصادية الأوروبية أو بريطانيا أو سويسرا، بتنحمى بضمانات المزوّد التعاقدية (متل البنود التعاقدية النموذجية للمفوّضية الأوروبية).

## 8. الأطفال

«جماعة» وألعابها مصنوعة للمراهقين والكبار، وغالبًا بتنلعب مع العيلة كلها. مش موجّهة للأطفال تحت 13 سنة وما بتجمع عن قصد معلومات شخصية منهم؛ اللاعبين بيكتبو بس اسم مستعار، وببعض الألعاب أجوبة قصيرة، وبتنمحى لحالها مع الغرفة. إذا بتفكّر إنّو طفل كتب معلومة شخصية (مثلًا اسمو الكامل كاسم مستعار)، تواصل معنا ومنمحيها إذا لسا موجودة.

## 9. حقوقك

حسب وين ساكن (مثلًا تحت الـ GDPR بالاتحاد الأوروبي وبريطانيا)، إلك الحقّ توصل لبياناتك الشخصية، تصحّحها أو تمحيها، تعترض على استعمالها أو تحدّدو، وتنقلها. بما إنّو ما في حسابات، والغرف بتنمحى لحالها خلال ساعات، وما بنسجّل أسماء مستعارة بإحصائيات الاستعمال ولا بتقارير الأخطاء، عادةً ما منقدر نربط أي بيانات باقية فيك؛ بس تواصل معنا على {{CONTACT_EMAIL}} مع كود الغرفة والاسم المستعار ومنساعدك. وفيك كمان تقدّم شكوى لهيئة حماية البيانات ببلدك (بفرنسا: CNIL، www.cnil.fr).

## 10. الأمان

كل الاتصالات بين تطبيق التلفزيون، والتلفونات، والسيرفر مشفّرة (HTTPS/WSS). الكلمات السرّية بتنبعت بس لتلفون اللاعب صاحبها، وأبدًا مش للتلفزيون وقت اللعب. والرموز بتنحفظ بس بشكل مشفّر.

## 11. التغييرات

إذا التطبيق غيّر طريقة استعمالو للمعلومات (مثلًا لمّا تنزاد مشتريات اختيارية بعدين)، منحدّث هالصفحة والتاريخ اللي فوق قبل ما يصير التغيير.

## 12. هالموقع

هالقسم بيغطّي بس الموقع اللي عم تقراه (مش الألعاب). لنعرف قدّيش في زوّار وأيّا أزرار وإعلانات عم تشتغل، منستعمل:

- **Cloudflare Web Analytics**: بيعدّ مشاهدات الصفحات وسرعة تحميلها. ما بيستعمل كوكيز ولا تخزين محلّي، وما بيعمل «بصمة» للزوّار. Cloudflare بتعالج هالشي عن لساننا.

- **عدّ كبسات مجهول** بينبعت للسيرفر تبعنا لمّا تكبس على زرّ متل «ركّبها عتلفزيوني» أو «العب بالمتصفّح»، أو تفتح سؤال، أو تنزل بالصفحة: أيّا زرّ أو قسم، لغة الصفحة، الحملة الإعلانية المذكورة بالرابط (utm)، نوع الجهاز (تلفون أو كمبيوتر)، والبلد اللي بتستنتجو Cloudflare من الاتصال. بلا أي معرّف، بلا كوكي، وعنوان الـ IP تبعك ما بينحفظ. هالأعداد بتنحفظ 3 شهور بالحدّ الأقصى.

- **اللغة اللي بتنقّيها** بتنحفظ بمتصفّحك (تخزين محلّي) ليفتح الموقع بلغتك المرّة الجايي. وما بتطلع من جهازك أبدًا.

إذا متصفّحك بيبعت **Global Privacy Control** أو **Do Not Track**، ولا شي من هالقياس بيشتغل. منستعملو على أساس مصلحتنا المشروعة إنّو نفهم، بشكل إجمالي، كيف الموقع عم ينستعمل. والانتقال لـ Google Play بياخدك لـ Google، وسياسة الخصوصية تبعها هيّي اللي بتنطبق.

## 13. التواصل

{{OWNER_NAME}} — {{CONTACT_EMAIL}}

---

## Appendix A: sources for each statement (do not publish)

| Statement | Code |
|---|---|
| No accounts; nickname only | `docs/PLAN.md:117`; join message `shared/src/protocol/messages.ts` (`name`, `color`, `locale`) |
| Nickname 1–16 characters, sanitised | `shared/src/constants.ts:9`; `server/src/room-core.ts` (`sanitizeName`) |
| Typed text: Mish Ana! guess ≤ 200, Bluff! lie ≤ 480; Quiz Night choice, Taqriban! number, Most Likely tap | `shared/src/games/mishana/protocol.ts:13`, `shared/src/games/bluff/protocol.ts:16`, `trivia/protocol.ts:28`, `taqriban/protocol.ts:21`, `likely/protocol.ts` |
| TV sends language, `X-Jamaa-Client`, played-ids memory (no device id) | `tv-app/.../net/RoomApi.kt:43-57`; `server/src/monitor/events.ts` (`CLIENT_HEADER`); `shared/src/constants.ts` `HTTP_BODY_MAX_BYTES` note (no-repeat memory) |
| Random temporary ids, hashed tokens | `server/src/room-store.ts` (`tvTokenHash`, `SessionRecord.tokenHash`) |
| IP: rate-limit key only; in a room a 16-hex SHA-256 of `roomCode:ip`; never in stats, reports or app logs | `server/src/request.ts` (`clientIp`), `server/src/room-core.ts:334` (`ipKey`), `server/src/monitor/client-errors.ts` ("Raw IP only as the limiter key"), `server/src/monitor/events.ts` header comment |
| Error report fields and scrub (platform, version, screen, kind, name, message ≤ 300, stack ≤ 1 500, room code, count; emails, URL queries, hex/token runs, long digits removed) | `server/src/monitor/client-errors.ts` (`ClientErrorReport`, `scrub`, `MESSAGE_MAX`, `STACK_MAX`), JAMAA-PLATFORM §8.3 |
| Error-report rate limit 10 per minute per IP | `server/wrangler.jsonc` `CLIENT_ERROR_LIMITER` |
| Usage events (room created/closed, game started/ended, player joined/left, content flag; no names/IPs/tokens) | `server/src/monitor/events.ts` (`RoomEvent`, `roomEventPoint`), JAMAA-PLATFORM §8.1, §8.6 |
| Live counters: hourly 48 h, error ring 100 | JAMAA-PLATFORM §8.2 (`server/src/monitor/stats-core.ts`) |
| Analytics Engine retention about 3 months | JAMAA-PLATFORM §8.9 ("AE keeps data about 3 months") and Cloudflare's Analytics Engine documentation |
| Hosting logs ≤ 7 days, traces off | `server/wrangler.jsonc` `observability`; Cloudflare Workers Logs maximum retention |
| Room lifetime: closes 15 min after the TV leaves (or after creation if it never connects); at most 12 h after last activity while a TV is connected | `shared/src/constants.ts` (`ROOM_TV_GONE_TTL_MS`, `ROOM_TV_MAX_TTL_MS`), `server/src/room-core.ts` `expiresAt` |
| Seat held 2 min in lobby | `shared/src/constants.ts` (`SEAT_HOLD_MS`) |
| Phone local storage keys, resume 6 h | `web-client/src/lib/storage.ts` |
| TV stores sound, calm-animation prefs, played-ids memory; crash report kept until next launch (`noBackupFilesDir`); backups limited | `tv-app/.../settings/SoundPrefs.kt`, `PlatformPrefs.kt`, `monitor/CrashReporter.kt` (`storeIn(noBackupDir)`), `AndroidManifest.xml` (`fullBackupContent`) |
| No ads, no purchases, no third-party SDKs | `tv-app/app/build.gradle.kts` dependencies; `BILLING_ENABLED "0"` in `server/wrangler.jsonc`; `web-client/public/_headers` (CSP `default-src 'self'`) |
| Local TV install id exists (shown in Settings) but is only for purchases | `tv-app/.../billing/InstallId.kt`, `ui/AppRoot.kt` (`vm.installId()`). OWNER CHECK: confirm it is not sent to the server while `/api/config` says `billing:false` |
| Encrypted connections | `AndroidManifest.xml` (`usesCleartextTraffic` false); phone page served by the Worker over HTTPS |
| Words never sent to the TV during play | `docs/PLAN.md:97-101,109` |
| No audio recording / no mic permission | `AndroidManifest.xml` (only INTERNET) |
| No Spicy 18+ in v1 | `server/wrangler.jsonc` `env.production.vars.LIKELY_SPICY_ENABLED "0"`, `check-deploy.mjs`, `shared/src/games/likely/meta.ts` |

## Appendix B — block to insert when in-app purchases ship (from `docs/PAYMENTS-SPEC.md` §6.3)

**EN** (insert as a new subsection of section 2, and add "Purchases" to sections 4 and 6):

> **If you subscribe to the JAMAA Pass or buy a pack on the TV**
> Subscriptions (the JAMAA Pass, monthly or yearly, with a free trial for new subscribers) and pack purchases are made through Google Play; you manage or cancel the subscription in Google Play. Purchases are made through Google Play; we never see your card details, name, email or Google account. To unlock what you bought, the TV app creates a random installation identifier. Our server stores only a one-way hash of it and of your purchase token, together with the product, its status (for the JAMAA Pass: active, in grace period, on hold, cancelled or expired) and expiry date. We use this only to unlock your purchases, restore them on your TVs and prevent fraud. Purchase records are deleted 400 days after the purchase is last used or expires; for refunded word packs we keep a minimal record (a hash and a "refunded" flag) so a refunded purchase cannot be unlocked again. Clearing the TV app's data creates a new identifier; your purchases can be restored through Google Play.

**FR:**

> **Si vous vous abonnez au JAMAA Pass ou achetez un pack sur la télé**
> L’abonnement (le JAMAA Pass, mensuel ou annuel, avec un essai gratuit pour les nouveaux abonnés) et les achats de packs passent par Google Play ; vous gérez ou résiliez l’abonnement dans Google Play. Les achats passent par Google Play ; nous ne voyons jamais vos coordonnées bancaires, votre nom, votre e-mail ou votre compte Google. Pour débloquer vos achats, l’application TV crée un identifiant d’installation aléatoire. Notre serveur ne conserve qu’une empreinte à sens unique de cet identifiant et de votre jeton d’achat, avec le produit, son statut (pour le JAMAA Pass : actif, en délai de grâce, suspendu, résilié ou expiré) et sa date d’expiration. Ces données servent uniquement à débloquer et restaurer vos achats et à prévenir la fraude. Les données d’achat sont supprimées 400 jours après la dernière utilisation ou l’expiration de l’achat ; pour les packs remboursés, nous gardons un enregistrement minimal (une empreinte et un indicateur « remboursé ») afin qu’un achat remboursé ne puisse pas être débloqué à nouveau. Effacer les données de l’application TV crée un nouvel identifiant ; vos achats peuvent être restaurés via Google Play.
