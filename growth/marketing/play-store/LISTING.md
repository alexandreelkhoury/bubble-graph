# JAMAA: Google Play store listing (EN / FR / AR / ES), all five games

Package `app.jamaa.tv` · **rewritten 2026-11-17** for the v1 submission · paste-ready.

**What changed on 2026-11-17.** The listing used to describe Mish Ana! only. It now sells the hub and **all five games that ship in v1**: Mish Ana!, Bluff!, Most Likely, Quiz Night, Taqriban! (`GAMES_ENABLED` on the production Worker lists all five). Owner decisions applied: **free at launch, billing off, no Spicy 18+ mode in v1** (nothing in the copy mentions suggestive or adult content, a Pass, prices or purchases), production Worker https://jamaa.mishana.workers.dev. Spanish is one listing for es-ES and es-419 (neutral wording; paste the same text in both). All FR, AR and ES copy is a draft for native review ([RELEASE-CHECKLIST.md](../../../docs/RELEASE-CHECKLIST.md) item 4.5); the Arabic keeps the Lebanese register of `shared/i18n/ar.json`.

Character counts below are Unicode code points (what Play Console counts), checked by the script that generated this file. Limits: title 30, short description 80, full description 4000, release notes 500 per language ([metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842): no emojis, ALL CAPS, "#1", "free", price or ranking claims in the title; all-caps game names inside the description are headings).

Related files: [DATA-SAFETY.md](DATA-SAFETY.md) (Data safety, **IARC content-rating answers**, target audience), [PRIVACY-POLICY.md](PRIVACY-POLICY.md), [GRAPHICS-SPEC.md](GRAPHICS-SPEC.md), [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) (Play Console runbook), and the launch audit [docs/RELEASE-CHECKLIST.md](../../../docs/RELEASE-CHECKLIST.md).

## 0. Decisions behind the copy (read once)

| Decision | Why |
|---|---|
| Title is the platform: "JAMAA: Party Games for TV" and its translations | JAMAA-PLATFORM §1.3: the Play title is platform copy. Brand first so a TV search for "JAMAA" lands on it; "party games" and "TV" carry the category intent |
| First 4 lines of every full description = what Jamaa is + "nothing to install on phones", the five games, the facts, then "On your phone? Tap the arrow next to Install and choose your TV." | Play shows only the first lines before "About this game"; ad traffic lands on phones, where a TV-only app reads "not compatible", so line 4 tells them what to do |
| One hub paragraph, then one block per game (what you do, how it scores, player range), then how it works, languages, privacy, requirements | Each game gets the same four facts so a skimmer can compare: the move, the twist, the player count, the feel |
| **No mention of Spicy / 18+ / adult / "suggestive"** anywhere | v1 ships without it (production `LIKELY_SPICY_ENABLED "0"`, pack not bundled). The listing must match the build and the IARC answers |
| No mention of the JAMAA Pass, subscriptions, packs for sale, prices, "free" | Billing is off (`BILLING_ENABLED "0"`), so there is nothing to sell; "free" would become false when billing ships. **When billing ships, apply §5** |
| The word "Undercover" is not used | Another developer claims it as a trademark; the role is "Mole" (`docs/DESIGN.md`). The Spanish Mish Ana! block uses "Topo" as the app does |
| "1,300+ word pairs" (Mish Ana!) | Counted 2026-11-08: EN 372, FR 369, AR 279 (51 Lebanese), ES 379 = 1,399. Recount if packs change. Other games are described as "hundreds" (Bluff! 222 facts, Most Likely family cards 175, Quiz Night 2 quizzes of 75 questions per language, Taqriban! 140 questions) so the copy does not go stale |
| Player ranges: Mish Ana! 3–12, Bluff! 3–12, Most Likely 3–12, Quiz Night 1–12 (solo is practice), Taqriban! 2–12 | `docs/GAME-*.md` and each game's `meta.ts`. Headline "from 2 to 12" in release notes is the platform range across games; "3–12" in the lead line is the party norm |
| "Android TV" named in every description | Google's TV distribution checklist requires it |
| "Nothing to install on phones", "Android phones and iPhones" | Phones join through the browser page served by the Worker; iOS Safari is a supported target |
| Exclamation marks only in game names and the first hooks | Plain body copy |
| Keywords (natural use) | party games, game night, TV games, friends, family, bluff, trivia, quiz, guessing, secret word, who's the spy, phones as controllers, Android TV, Google TV, Lebanese, Arabic. FR: jeux d'ambiance, soirée jeux, quiz, bluff. AR: ألعاب سهرة، لعبة جماعية، أسئلة. ES: juegos de fiesta, juego de mesa en la tele, trivial, impostor |

---

## 1. Store listings

### 1.1 English (United States): en-US (default)

### EN: app name, 25/30
```
JAMAA: Party Games for TV
```

### EN: short description, 72/80
```
Party games on your TV, phones as controllers. Bluff, vote, guess, quiz.
```

### EN: full description, 3721/4000
```
Party games on your TV, played from your phones. Friends scan the QR code and join in their browser: nothing to install on phones, iPhone or Android.
Five games in one app: Mish Ana!, Bluff!, Most Likely, Quiz Night and Taqriban!. Lie, vote, guess and show off on the big screen.
3–12 players · English, French, Arabic & Spanish · no ads, no accounts.
On your phone? Tap the arrow next to Install and choose your TV.

Your phones. One TV. The whole gang.

Jamaa (ja-MAA) is Arabic for "the gang, the gathering": everyone in the room, playing together on one screen. Open Jamaa on your Android TV or Google TV, everyone scans the QR code with their phone, and the TV runs the show. Pick a game from the hub, play it, then pick another.

THE FIVE GAMES

MISH ANA!: WHO'S THE MOLE?
Everyone gets the same secret word on their phone, except the Mole, who gets no word and has to blend in. Give one clue each, vote out whoever sounds off, and a caught Mole gets one last guess at the word to steal the win. Lebanese word packs included. 3–12 players.

BLUFF!: FOOL YOUR FRIENDS
The TV shows a weird but real fact with a blank. Everyone types a fake answer that sounds true, the fakes go on the board next to the real one, and the table votes. Three rounds: know it or bluff it, impossible but true, and a final round with no right answer at all. 3–12 players.

MOST LIKELY: WHO'S THE ONE...?
"Who's most likely to cry at a wedding?" Everyone secretly taps a player. Then the votes land one by one under the people they picked, and the most-voted wins an award. No points, no typing, only laughs. Switch to secret votes for percentages only. 3–12 players.

QUIZ NIGHT: FASTEST RIGHT ANSWER WINS
Four answers, one thumb. The faster you are right, the more you score, streaks add a bonus, and the last question counts double. Quizzes on Lebanon and the wide world, with the leaderboard reshuffling live on the TV. 1–12 players.

TAQRIBAN!: NOBODY KNOWS. GET CLOSEST.
"How many trees are there on Earth?" Everyone types a number on a big keypad. A number line fills up with every guess, then the true answer drops in. Closest wins, a bullseye earns a bonus. 2–12 players.

HOW IT WORKS
1. Open Jamaa on your TV. A room code and a QR code appear.
2. Everyone scans the QR code with their phone camera. The game opens in the browser: no download, no account, just a nickname.
3. Pick a game and press Start on the TV or on a phone.
4. Play from your phones: secrets, answers and votes stay on your own screen, the TV shows the drama.
5. Hit Play again, or pick another game.

WHY GROUPS LOVE IT
• Game night, family gatherings, birthdays, dinner with friends: from 3 to 12 players.
• Phones as controllers: everyone plays from the couch, no extra gamepads.
• The TV is the stage: dramatic reveals, countdowns and scoreboards.
• Secrets stay secret: your word, your answer and your vote are only on your phone until the reveal.
• Fully playable with the TV remote: D-pad, OK and Back.

IN FOUR LANGUAGES
• English, French, Arabic and Spanish, with full right-to-left Arabic on the TV and on phones.
• 1,300+ word pairs for Mish Ana!, hundreds of facts, questions and cards for the other games.
• Lebanese content throughout: Lebanese word packs, a Lebanon quiz, questions about the Levant.

PRIVACY BUILT IN
• No ads. No accounts. No tracking.
• Players only type a nickname. Rooms and nicknames are deleted automatically when the room closes.

WHAT YOU NEED
• An Android TV or Google TV connected to the internet.
• One smartphone per player with a web browser and internet (Wi-Fi or mobile data). Android phones and iPhones both work.
• At least 3 players for most games.

Who's lying at your table? Open Jamaa, scan, and find out.
```

### EN: what's new (release notes), 271/500
```
Welcome to JAMAA: party games for your TV, played from your phones.
• Five games: Mish Ana!, Bluff!, Most Likely, Quiz Night, Taqriban!
• 2–12 players, no app to install on phones
• English, French, Arabic and Spanish
• No ads, no accounts
Tell us what your group thinks.
```


**A/B alternatives (short description, ≤ 80):**

| Control (above) | Variant A | Variant B |
|---|---|---|
| Party games on your TV, phones as controllers. Bluff, vote, guess, quiz. (72) | Game night on your TV: 5 party games, 3-12 players, nothing to install (70) | Your phones. One TV. The whole gang. Five party games for game night. (69) |

### 1.2 French (France): fr-FR (also copy to fr-CA)

### FR: app name, 26/30
```
JAMAA : Jeux d’ambiance TV
```

### FR: short description, 76/80
```
Jeux d’ambiance sur la télé, téléphones en manette. Bluffez, votez, devinez.
```

### FR: full description, 3938/4000
```
Des jeux d’ambiance sur la télé, joués depuis vos téléphones. Vos amis scannent le QR code et jouent dans le navigateur : rien à installer sur les téléphones, iPhone ou Android.
Cinq jeux dans une appli : Mish Ana!, Bluff !, Qui risque le plus ?, Soirée quiz et À peu près !. Mentez, votez, devinez et brillez sur grand écran.
3 à 12 joueurs · français, anglais, arabe et espagnol · sans pub, sans compte.
Sur votre téléphone ? Touchez la flèche à côté d’Installer, choisissez votre télé.

Vos téléphones. Une télé. Toute la bande.

Jamaa (« ja-MAA ») veut dire « la bande » en arabe : tous ceux qui sont dans la pièce, réunis devant le même écran. Lancez Jamaa sur votre Android TV ou Google TV, chacun scanne le QR code avec son téléphone, et la télé mène le spectacle.

LES CINQ JEUX

MISH ANA! : QUI EST LA TAUPE ?
Tout le monde reçoit le même mot secret sur son téléphone, sauf la Taupe, qui n’a aucun mot et doit se fondre dans le groupe. Un indice chacun, on vote contre celui qui sonne faux, et une Taupe démasquée a une dernière chance de deviner le mot et de voler la victoire. Packs de mots libanais inclus. 3 à 12 joueurs.

BLUFF ! : BLUFFEZ VOS AMIS
La télé affiche un fait étrange mais bien réel, avec un blanc. Chacun écrit une fausse réponse qui sonne vraie, les fausses réponses s’affichent à côté de la vraie, et la table vote. Trois manches : savoir ou bluffer, impossible mais vrai, et une finale sans aucune bonne réponse. 3 à 12 joueurs.

QUI RISQUE LE PLUS ? : C’EST QUI, LE PLUS… ?
« Qui risque le plus de pleurer à un mariage ? » Chacun touche en secret un joueur. Puis les votes tombent un par un sous ceux qu’ils ont désignés, et le plus voté gagne un prix. Pas de points, rien à écrire, que des fous rires. Passez au vote secret pour ne voir que des pourcentages. 3 à 12 joueurs.

SOIRÉE QUIZ : LA BONNE RÉPONSE, LE PLUS VITE
Quatre réponses, un pouce. Plus vous êtes juste vite, plus vous marquez, les séries donnent un bonus et la dernière question compte double. Des quiz sur le Liban et sur le vaste monde, avec le classement qui se remet à jour en direct sur la télé. 1 à 12 joueurs.

À PEU PRÈS ! : PERSONNE NE SAIT. VISEZ AU PLUS PRÈS.
« Combien y a-t-il d’arbres sur Terre ? » Chacun tape un nombre sur un grand pavé numérique. Une ligne de nombres se remplit de toutes les propositions, puis la vraie réponse tombe. Le plus proche gagne, un tir en plein dans le mille rapporte un bonus. 2 à 12 joueurs.

COMMENT ÇA MARCHE
1. Lancez Jamaa sur la télé : un code de salle et un QR code s’affichent.
2. Chacun scanne le QR code avec l’appareil photo de son téléphone. Le jeu s’ouvre dans le navigateur : rien à installer, pas de compte, juste un pseudo.
3. Choisissez un jeu et appuyez sur Démarrer sur la télé ou sur un téléphone.
4. Jouez : secrets, réponses et votes restent sur votre téléphone, la télé montre le spectacle.

POURQUOI ON ADORE
• Soirées jeux, repas de famille, anniversaires, dîners entre amis : de 3 à 12 joueurs.
• Les téléphones servent de manettes : tout le monde joue depuis le canapé.
• Les secrets restent secrets jusqu’à la révélation.
• Jouable à la télécommande : croix directionnelle, OK, Retour.

EN QUATRE LANGUES
• Français, anglais, arabe et espagnol, avec l’arabe de droite à gauche sur la télé comme sur les téléphones.
• Plus de 1 300 paires de mots pour Mish Ana!, des centaines de faits, questions et cartes pour les autres jeux.
• Du contenu libanais partout : packs de mots libanais, un quiz sur le Liban, des questions sur le Levant.

VIE PRIVÉE INTÉGRÉE
• Pas de pub. Pas de compte. Pas de pistage.
• Les joueurs saisissent seulement un pseudo. Les salles et les pseudos sont supprimés automatiquement à la fermeture de la salle.

CE QU’IL VOUS FAUT
• Une Android TV ou une Google TV connectée à Internet.
• Un smartphone par joueur avec navigateur et Internet. Android et iPhone fonctionnent.

Qui ment à votre table ? Lancez Jamaa, scannez, et vous le saurez.
```

### FR: what's new (release notes), 326/500
```
Bienvenue sur JAMAA : des jeux d’ambiance pour votre télé, joués depuis vos téléphones.
• Cinq jeux : Mish Ana!, Bluff !, Qui risque le plus ?, Soirée quiz, À peu près !
• 2 à 12 joueurs, rien à installer sur les téléphones
• Français, anglais, arabe et espagnol
• Sans pub, sans compte
Dites-nous ce que votre bande en pense.
```


### 1.3 Arabic: ar (Lebanese-friendly; brand lines in the Lebanese register of `shared/i18n/ar.json`; new lines are drafts for native review)

### AR: app name, 28/30
```
جماعة: ألعاب سهرة عالتلفزيون
```

### AR: short description, 68/80
```
ألعاب سهرة على التلفزيون والتلفونات للتحكّم. بلوف، صوّت، خمّن، جاوب.
```

### AR: full description, 3247/4000
```
ألعاب سهرة على التلفزيون، وبتلعبوها من تلفوناتكم. رفقاتك بيمسحوا الـ QR وبيفوتوا من المتصفّح: ما في شي لتنزّلو عالتلفونات، آيفون أو أندرويد.
خمس ألعاب بتطبيق واحد: «مش أنا!»، «بلوف!»، «مين فينا؟»، «سهرة أسئلة» و«تقريبًا!». اكذب، صوّت، خمّن واستعرض عالشاشة الكبيرة.
من 3 لـ12 لاعب · عربي، إنكليزي، فرنسي وإسباني · بلا إعلانات، بلا حسابات.
عم تقرا من تلفونك؟ كبّس السهم جنب «تثبيت» واختار تلفزيونك.

تلفوناتكم. تلفزيون واحد. الجماعة كلّها.

«جماعة» يعني الشلّة، اللمّة: كل اللي بالغرفة عم يلعبوا سوا عالشاشة الواحدة. افتح «جماعة» على Android TV أو Google TV تبعك، كل واحد بيمسح الـ QR بتلفونو، والتلفزيون بيدير السهرة. اختار لعبة من الرئيسية، العبها، وبعدين اختار غيرها.

الألعاب الخمسة

مش أنا!: مين الجاسوس؟
كل واحد بيوصلو نفس الكلمة السرّية عتلفونو، إلّا الجاسوس، ما بيوصلو كلمة وبدّو يندسّ بين الجماعة. كل واحد بيقول تلميح، بتصوّتوا ضد اللي كلامو مش مضبوط، والجاسوس اللي بينكشف بيحصل على تخمينة أخيرة للكلمة ليسرق الفوز. فيها حزم كلمات لبنانية. من 3 لـ12 لاعب.

بلوف!: اضحك عرفقاتك
التلفزيون بيعرض معلومة غريبة بس حقيقية، وفيها فراغ. كل واحد بيكتب جواب مفبرك بيبيّن حقيقي، الأجوبة بتنعرض جنب الجواب الصحيح، وبتصوّتوا. تلات جولات: بتعرف أو بتبلف، مستحيل بس صحيح، وجولة أخيرة ما فيها جواب صحيح أبدًا. من 3 لـ12 لاعب.

مين فينا؟: مين الأكتر…؟
«مين فينا الأكتر واحد بيبكي بالعرس؟» كل واحد بيكبّس سرًّا على لاعب. وبعدين الأصوات بتنزل واحد واحد تحت اللي انختاروا، واللي أخد أكتر أصوات بياخد جايزة. بلا نقاط، بلا كتابة، بس ضحك. ممكن تقلب لتصويت سرّي وتشوفوا نسب مئوية بس. من 3 لـ12 لاعب.

سهرة أسئلة: الجواب الصح بأسرع وقت
أربع أجوبة، وإصبع واحد. كل ما كنت صح أسرع، كل ما أخدت نقاط أكتر، وسلسلة الأجوبة الصح بتزيد بونوس، وآخر سؤال بيحسب مرّتين. أسئلة عن لبنان وعن العالم، والترتيب بيتبدّل مباشرة عالتلفزيون. من 1 لـ12 لاعب.

تقريبًا!: ما حدا بيعرف. قرّب أكتر.
«كم شجرة في عالأرض؟» كل واحد بيكتب رقم على لوحة أرقام كبيرة. خط أرقام بيتعبّى بكل التخمينات، وبعدين الجواب الحقيقي بينزل. الأقرب بيربح، والإصابة بالنص بتجيب بونوس. من 2 لـ12 لاعب.

كيف بتشتغل
1. افتح «جماعة» عالتلفزيون. بيظهر كود غرفة وQR.
2. كل واحد بيمسح الـ QR بكاميرا تلفونو. اللعبة بتفتح بالمتصفّح: بلا تنزيل، بلا حساب، بس اسم مستعار.
3. اختار لعبة وكبّس «ابدأ» عالتلفزيون أو عتلفون.
4. العبوا من تلفوناتكم: الأسرار والأجوبة والأصوات بتضل على شاشتك، والتلفزيون بيعرض الدراما.
5. كبّس «العب مرّة تانية»، أو اختار لعبة غيرها.

ليش الجماعات بتحبّها
• سهرات، لمّات عيلة، أعياد ميلاد، عشا مع الرفقات: من 3 لـ12 لاعب.
• التلفونات هيّي الأذرع: الكل بيلعب من الكنبة، بلا أذرع إضافية.
• التلفزيون هو المسرح: كشف درامي، عدّ تنازلي وترتيب نقاط.
• الأسرار بتضل أسرار: كلمتك وجوابك وصوتك بيضلّوا عتلفونك لحدّ الكشف.
• بتتلعب كلّها بريموت التلفزيون: أسهم، OK ورجوع.

بأربع لغات
• عربي، إنكليزي، فرنسي وإسباني، وعربي كامل من اليمين لليسار عالتلفزيون وعالتلفونات.
• أكتر من 1300 زوج كلمات لـ«مش أنا!»، ومئات المعلومات والأسئلة والكروت للألعاب التانية.
• محتوى لبناني بكل مكان: حزم كلمات لبنانية، سؤال عن لبنان، أسئلة عن بلاد الشام.

الخصوصية من الأساس
• بلا إعلانات. بلا حسابات. بلا تتبّع.
• اللاعبين بيكتبوا بس اسم مستعار. الغرف والأسماء بتنمحى لحالها لمّا تسكّر الغرفة.

شو بتحتاج
• Android TV أو Google TV متّصل بالإنترنت.
• تلفون ذكي لكل لاعب مع متصفّح وإنترنت (واي فاي أو داتا). تلفونات أندرويد وآيفون بيشتغلوا.
• 3 لاعبين على الأقل بمعظم الألعاب.

مين عم يكذب عطاولتكم؟ افتح «جماعة»، امسح، وبتعرف.
```

### AR: what's new (release notes), 250/500
```
أهلًا بـ«جماعة»: ألعاب سهرة لتلفزيونك، بتلعبوها من تلفوناتكم.
• خمس ألعاب: «مش أنا!»، «بلوف!»، «مين فينا؟»، «سهرة أسئلة»، «تقريبًا!»
• من 2 لـ12 لاعب، بلا تنزيل عالتلفونات
• عربي، إنكليزي، فرنسي وإسباني
• بلا إعلانات، بلا حسابات
خبّرنا شو رأي جماعتك.
```


### 1.4 Spanish: es-ES and es-419 (one text for both; draft for native review)

### ES: app name, 29/30
```
JAMAA: Juegos de fiesta en TV
```

### ES: short description, 72/80
```
Juegos de fiesta en la tele, con tu móvil. Engaña, vota, adivina y gana.
```

### ES: full description, 3918/4000
```
Juegos de fiesta en la tele, jugados desde vuestros móviles. Tus amigos escanean el QR y entran desde el navegador: nada que instalar en los móviles, iPhone o Android.
Cinco juegos en una app: Mish Ana!, ¡Bluff!, ¿Quién es más capaz?, Noche de quiz y ¡Más o menos!. Miente, vota, adivina y luce tu talento en pantalla grande.
De 3 a 12 jugadores · español, inglés, francés y árabe · sin anuncios, sin cuentas.
¿Desde tu móvil? Toca la flecha junto a Instalar y elige tu tele.

Vuestros móviles. Una tele. Toda la pandilla.

Jamaa (ja-MAA) significa «la pandilla, la reunión» en árabe: todos los que estáis en la sala, jugando juntos en una sola pantalla. Abre Jamaa en tu Android TV o Google TV, cada uno escanea el QR con su móvil y la tele dirige el espectáculo.

LOS CINCO JUEGOS

MISH ANA!: ¿QUIÉN ES EL IMPOSTOR?
Todos reciben la misma palabra secreta en el móvil, menos el Topo, que no recibe palabra y tiene que camuflarse. Una pista cada uno, se vota al que suena raro y un Topo descubierto tiene una última oportunidad de adivinar la palabra y robar la victoria. Incluye packs de palabras libaneses. De 3 a 12 jugadores.

¡BLUFF!: ENGAÑA A TUS AMIGOS
La tele muestra un dato raro pero real, con un hueco. Cada uno escribe una respuesta falsa que suene verdadera, las falsas aparecen junto a la real y la mesa vota. Tres rondas: lo sabes o lo disimulas, imposible pero cierto, y una final sin ninguna respuesta correcta. De 3 a 12 jugadores.

¿QUIÉN ES MÁS CAPAZ?: ¿QUIÉN TIENE MÁS PINTA DE...?
«¿Quién tiene más pinta de llorar en una boda?» Cada uno toca en secreto a un jugador. Luego los votos caen uno a uno bajo las personas elegidas y el más votado gana un premio. Sin puntos, sin escribir, solo risas. Pasa al voto secreto para ver solo porcentajes. De 3 a 12 jugadores.

NOCHE DE QUIZ: LA RESPUESTA CORRECTA, LO MÁS RÁPIDO
Cuatro respuestas y un pulgar. Cuanto antes aciertes, más puntos; las rachas dan bonus y la última pregunta vale doble. Quizzes sobre el Líbano y sobre el mundo, con la clasificación cambiando en directo en la tele. De 1 a 12 jugadores.

¡MÁS O MENOS!: NADIE LO SABE. ACÉRCATE MÁS.
«¿Cuántos árboles hay en la Tierra?» Cada uno escribe un número en un teclado gigante. Una recta numérica se llena con todas las apuestas y luego cae la respuesta real. Gana el más cercano; dar en la diana da un bonus. De 2 a 12 jugadores.

CÓMO FUNCIONA
1. Abre Jamaa en la tele. Aparecen un código de sala y un QR.
2. Cada uno escanea el QR con la cámara de su móvil. El juego se abre en el navegador: sin descargas, sin cuenta, solo un apodo.
3. Elige un juego y pulsa Empezar en la tele o en un móvil.
4. Jugad desde los móviles: los secretos, las respuestas y los votos se quedan en tu pantalla y la tele muestra el drama.

POR QUÉ GUSTA TANTO
• Noches de juegos, reuniones familiares, cumpleaños, cenas con amigos: de 3 a 12 jugadores.
• Los móviles son los mandos: todos juegan desde el sofá, sin mandos extra.
• Los secretos siguen siéndolo: tu palabra, tu respuesta y tu voto solo están en tu móvil hasta la revelación.
• Se juega entero con el mando de la tele: cruceta, OK y Atrás.

EN CUATRO IDIOMAS
• Español, inglés, francés y árabe, con el árabe de derecha a izquierda en la tele y en los móviles.
• Más de 1300 pares de palabras para Mish Ana! y cientos de datos, preguntas y cartas para los demás juegos.
• Contenido libanés en todas partes: packs de palabras libaneses, un quiz sobre el Líbano, preguntas sobre el Levante.

PRIVACIDAD DE SERIE
• Sin anuncios. Sin cuentas. Sin rastreo.
• Los jugadores solo escriben un apodo. Las salas y los apodos se borran automáticamente al cerrarse la sala.

QUÉ NECESITAS
• Una Android TV o Google TV conectada a internet.
• Un smartphone por jugador con navegador e internet (wifi o datos). Funcionan móviles Android y iPhone.
• Al menos 3 jugadores en la mayoría de los juegos.

¿Quién miente en tu mesa? Abre Jamaa, escanea y lo sabrás.
```

### ES: what's new (release notes), 321/500
```
Bienvenido a JAMAA: juegos de fiesta para tu tele, jugados desde vuestros móviles.
• Cinco juegos: Mish Ana!, ¡Bluff!, ¿Quién es más capaz?, Noche de quiz, ¡Más o menos!
• De 2 a 12 jugadores, nada que instalar en los móviles
• Español, inglés, francés y árabe
• Sin anuncios, sin cuentas
Cuéntanos qué opina tu pandilla.
```


---

## 2. Content rating (IARC) for v1

The full answered questionnaire is in [DATA-SAFETY.md](DATA-SAFETY.md) §2 (no Spicy; user-generated text on phones in Mish Ana! and Bluff!, nicknames visible on the TV, no chat, no profanity filter, mild humour; expected ESRB Everyone, PEGI 3 or 12, "Users Interact"). The Data safety form is §1 there and the target audience (13+) §3.

## 3. Release notes in Play Console's multi-language paste format

```
<en-US>
Welcome to JAMAA: party games for your TV, played from your phones.
• Five games: Mish Ana!, Bluff!, Most Likely, Quiz Night, Taqriban!
• 2–12 players, no app to install on phones
• English, French, Arabic and Spanish
• No ads, no accounts
Tell us what your group thinks.
</en-US>
<fr-FR>
Bienvenue sur JAMAA : des jeux d’ambiance pour votre télé, joués depuis vos téléphones.
• Cinq jeux : Mish Ana!, Bluff !, Qui risque le plus ?, Soirée quiz, À peu près !
• 2 à 12 joueurs, rien à installer sur les téléphones
• Français, anglais, arabe et espagnol
• Sans pub, sans compte
Dites-nous ce que votre bande en pense.
</fr-FR>
<ar>
أهلًا بـ«جماعة»: ألعاب سهرة لتلفزيونك، بتلعبوها من تلفوناتكم.
• خمس ألعاب: «مش أنا!»، «بلوف!»، «مين فينا؟»، «سهرة أسئلة»، «تقريبًا!»
• من 2 لـ12 لاعب، بلا تنزيل عالتلفونات
• عربي، إنكليزي، فرنسي وإسباني
• بلا إعلانات، بلا حسابات
خبّرنا شو رأي جماعتك.
</ar>
<es-ES>
Bienvenido a JAMAA: juegos de fiesta para tu tele, jugados desde vuestros móviles.
• Cinco juegos: Mish Ana!, ¡Bluff!, ¿Quién es más capaz?, Noche de quiz, ¡Más o menos!
• De 2 a 12 jugadores, nada que instalar en los móviles
• Español, inglés, francés y árabe
• Sin anuncios, sin cuentas
Cuéntanos qué opina tu pandilla.
</es-ES>
<es-419>
Bienvenido a JAMAA: juegos de fiesta para tu tele, jugados desde vuestros móviles.
• Cinco juegos: Mish Ana!, ¡Bluff!, ¿Quién es más capaz?, Noche de quiz, ¡Más o menos!
• De 2 a 12 jugadores, nada que instalar en los móviles
• Español, inglés, francés y árabe
• Sin anuncios, sin cuentas
Cuéntanos qué opina tu pandilla.
</es-419>
```

## 4. TV banner and screenshot shot list (1920x1080)

Rules ([Android TV assets](https://developer.android.com/training/tv/publishing/distribute), Play graphics): TV banner 1280x720 (already built: `graphics/tv-banner-1280x720-{en,fr,ar,es}.png`, JAMAA wordmark, no game-specific claims), icon 512, feature graphic 1024x500 (`graphics/feature-1024x500-*.png`), **TV screenshots 1920x1080, 16:9, PNG or JPEG, at least 1 and at most 8 per language**. All four graphics sets exist; only the screenshots need new captures. The old `graphics/screenshots/*-placeholder.jpg` (Mish Ana! only, browser mock) must not be uploaded.

**How to capture.** Real captures from the native Android TV app on the TV (adb `screencap -p`, or the Android Studio emulator at 1920x1080 / xhdpi TV profile), release-signed or debug build against the **production** Worker, UI language set per set, **Calm animations on** (no mid-transition blur), no notification or volume overlay. Fill the room with 6 to 8 players so the screens look alive: the bots in `growth/marketing/tools/jamaa-bots.mjs` (or `tools/sim --ws`) join with friendly first names (Lebanese/neutral: Maya, Karim, Lara, Omar, Nour, Sami, Rima, Jad). **Do not show real players' names, a real room code that will be reused, or any Spicy/18+ screen.** Take captures in the order below; keep each game's capture on a content-safe item (listed).

| # | Screen to capture | What must be on it | Safe content to pick | Languages |
|---|---|---|---|---|
| 01 | **Hub**: the five game cards, with "JAMAA" header | All five games visible and readable, focus on Mish Ana! (the first), no premium/Pass UI (billing is off) | n/a | EN, FR, AR (RTL), ES |
| 02 | **Lobby: scan to join** | Big QR code, join address and 4-letter room code, 6+ player bubbles joining with names | n/a | EN, FR, AR, ES |
| 03 | **Mish Ana!: voting** (or clues) | The round's voting board with player characters and the countdown; no secret word visible | Everyday words pack | EN, AR (also FR, ES) |
| 04 | **Bluff!: the reveal** | The board of answers with LIE / TRUTH stamps, the liar popping out, coins flying | A World or Odd-facts item (lighthearted, e.g. flamingos) | EN, FR, AR, ES |
| 05 | **Most Likely: reveal** | The card ("Who's most likely to cry at a wedding?"), voters' characters under their picks, the spotlight and the award | A family-pack card (wedding, GPS, birthday) | EN, FR, AR, ES |
| 06 | **Quiz Night: question** | Question with the four coloured answer shapes, the timer, players' characters on their answers | A food/geography item (not politics, religion or war) | EN, FR, AR, ES |
| 07 | **Taqriban!: reveal** | The number line with every guess dropped on it and the red pin for the true answer, "Closest!" stamp | World-pack item ("How many trees...") | EN, FR, AR, ES |
| 08 | **Results / awards** | Final leaderboard or awards wall with "Play again" focused | Any | EN, FR, AR, ES |

Minimum acceptable set if time is short: **01, 02, 04, 05 in EN and AR** (the two languages most users see), then FR and ES from the same room by switching the TV language. Check each image: 1920x1080, no real names, no sensitive item, text readable at thumbnail size, Arabic really RTL. Render/upload: GRAPHICS-SPEC.md §6; `frames.tsv` there still lists the Mish Ana!-only frame plan and must be replaced by this table.

---

## 5. Billing-release replacements (use only when the JAMAA Pass / packs ship, `BILLING_ENABLED`)

Written for the 2026-11-08 plan; re-read against the then-current copy. The bullet texts below speak of Mish Ana!'s pairs; adapt them to the five-game description above.

When the release with Play Billing goes live, update all listings **in the same rollout** (otherwise the word-pair bullet misdescribes the free tier, a Play policy issue, and TV-G3 requires the app to match its listing). Products (JAMAA-PLATFORM §4.1): the **JAMAA Pass** subscription (`jamaa_pass`, monthly or yearly, 7-day free trial for new subscribers) unlocks every pack of every game; single packs (`pack_<family>`) are sold one by one; every game stays free to play with its starter content.

| Replace this bullet | With (EN) | FR | AR | ES (both) |
|---|---|---|---|---|
| "1,300+ word pairs for Mish Ana!, hundreds of facts…" (the "IN FOUR LANGUAGES" bullet; keep the other two bullets of that block) | `• Free starter pack in every language. The JAMAA Pass (monthly or yearly, with a free trial) unlocks every pack of every game, 1,300+ word pairs for Mish Ana! alone, and every new one; single packs are also sold.` | `• Un pack de départ gratuit dans chaque langue. Le JAMAA Pass (mensuel ou annuel, avec un essai gratuit) débloque tous les packs de tous les jeux, plus de 1 300 paires de mots rien que pour Mish Ana!, et les suivants ; chaque pack est aussi vendu à l’unité.` | `• حزمة بداية مجانية بكل لغة. «JAMAA Pass» (شهري أو سنوي، مع فترة تجربة مجانية) يفتح كل حزم كل الألعاب، منها أكثر من 1300 زوج من الكلمات لـ«مش أنا!» وحدها، وكل حزمة جديدة، ويمكن شراء كل حزمة وحدها.` | `• Un pack inicial gratis en cada idioma. El JAMAA Pass (mensual o anual, con prueba gratis) desbloquea todos los packs de todos los juegos, y cada pack también se vende por separado.` (replaces the first bullet of PALABRAS EN ESPAÑOL) |
| "No ads. No accounts. No tracking." | `• No ads. No accounts. No tracking. Only the host's TV can buy; phones never pay.` | `• Pas de pub. Pas de compte. Pas de pistage. Seule la télé de l’hôte peut acheter ; les téléphones ne paient jamais.` | `• بلا إعلانات، بلا حسابات، بلا تتبّع. الشراء فقط من تلفزيون المضيف، والهواتف لا تدفع أبدًا.` | `• Sin anuncios. Sin cuentas. Sin rastreo. Solo la tele del anfitrión puede comprar; los móviles nunca pagan.` (es-419: *la TV*, *los celulares*) |

Also at that point: re-answer the content-rating questionnaire (digital purchases = Yes), update Data safety (DATA-SAFETY.md §1.B), insert the privacy-policy block (PRIVACY-POLICY.md Appendix B, already written for the JAMAA Pass), and switch the EU trader declaration (RELEASE-CHECKLIST.md step 0.6). Play adds the "In-app purchases" badge automatically. Do **not** write prices or "free trial" in the title/short description (metadata policy); the trial is shown by Play on the subscription offer.

## 6. A/B testing plan (store listing experiments)

Facts that shape the plan ([Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/6227309)):
- Experiments run on a **published** app only, so start them after production launch (not during the closed test).
- Testable: icon, feature graphic, screenshots, promo video (default graphics experiment) and **short + full description** (localized experiment, up to 5 languages at once). **The app name cannot be A/B tested** with experiments.
- One default graphics experiment **or** up to five localized experiments at the same time.

Order (each run until Play declares a result or ~2–3 weeks; TV traffic is small, so prefer **2 arms** (control + 1 variant) and a 50/50 split to reach significance faster):

| # | Experiment | Arms | Hypothesis |
|---|---|---|---|
| 1 | Localized, EN-US: short description | Control vs Variant A (§1 A/B alternatives) | Concrete numbers + "nothing to install" beat the five-verbs hook for TV browsers who don't know the genre |
| 2 | Localized, EN-US: short description | Winner of 1 vs Variant B (platform slogan) | Brand slogan vs benefit line |
| 3 | Default graphics: first TV screenshot / feature graphic | Lobby-with-QR first vs Vote-reveal first (see GRAPHICS-SPEC.md §4) | Showing "scan to join" first removes the "do we need controllers?" objection |
| 4 | FR, AR and ES short description (localized, run together) | Control vs Variant A | Same as 1 in other markets; for ES, Variant A also tests the impostor keyword |

**App-name alternatives** (no experiment possible): change the name once after ~4 weeks of stable traffic and compare store-listing conversion (Play Console → Grow users → Store performance → Store listing acquisition) for 4 weeks before vs after. Recommended order: Control → Variant A. Avoid frequent renames (search ranking resets and review re-triggers).

## 7. Category, tags, contact details (Store settings)

Play Console → **Grow users → Store presence → Store settings**.

| Field | Value | Notes |
|---|---|---|
| App or game | **Game** | Needed for the Games row on Android TV too (see RELEASE-CHECKLIST.md blocker B1, `android:isGame`) |
| Category | **Word** (recommended) · alternative: **Casual** | Word is a smaller category where a party word game stands out and matches the "word game" intent; Casual is larger but crowded with mobile hyper-casual games. There is no "Party" category |
| Tags (pick up to 5 from Play's list) | Prefer, in this order, whichever exist in the picker: **Party**, **Multiplayer** / **Local multiplayer**, **Word**, **Casual**, **Stylized** (or **Offline** only if true, it is not: the game needs internet) | The tag list is fixed by Google and changes; choose the closest matches shown in the picker. Do not pick "Single player" or "Offline" |
| Email address (public, required) | the existing `SUPPORT_EMAIL` (`shared/src/billing/products.ts`, and `Products.kt` on the TV; today a personal Hotmail address, kept for v1 by owner decision: a dedicated `hello@<your-domain>` needs a domain and a new release) | Shown on the listing. It is the same address as in the privacy policy (`growth/site/site.config.json` `contactEmail`) |
| Phone number | Leave empty | Optional; avoid exposing a personal number |
| Website | `<site origin>` (the landing page, `growth/site/`) | Optional but helps trust and the privacy-policy check |
| Privacy policy URL (App content → Privacy policy) | `<site origin>/privacy/` | Must be a public, non-geofenced, non-PDF web page. Note: the production Worker's own `/privacy` (https://jamaa.mishana.workers.dev/privacy) returns the phone app's SPA shell (HTTP 200, not a policy), so do **not** use the Worker URL; use the site's `/privacy/` page (PRIVACY-POLICY.md) |
| External marketing | Leave on | Lets Google promote the app outside Play |
| Default language | English (United States) – en-US | Add translations: French (France) – fr-FR, Arabic – ar, Spanish (Spain) – es-ES and Spanish (Latin America) – es-419 (§1). Optionally en-GB and fr-CA by copying the same text |

### Store listing graphics per language
Files in `graphics/` (spec and render command: GRAPHICS-SPEC.md). Upload per listing (Play Console → Main store listing → Manage translations → language → "Add own graphics"):
- **en-US**: `icon-512.png`, `feature-1024x500-en.png`, `tv-banner-1280x720-en.png`, `screenshots/tv-0[1-8]-*-en.png`.
- **fr-FR**: same icon, `feature-1024x500-fr.png`, `tv-banner-1280x720-fr.png` (Latin name, same art as EN), `screenshots/tv-0[1-8]-*-fr.png`.
- **ar**: same icon, `feature-1024x500-ar.png`, `tv-banner-1280x720-ar.png`, `screenshots/tv-0[1-8]-*-ar.png` (Arabic-UI captures). Otherwise Arabic users see English graphics.
- **es-ES and es-419**: same icon, `feature-1024x500-es.png`, `tv-banner-1280x720-es.png` (Latin name, same art as EN), `screenshots/tv-0[1-8]-*-es.png` (Spanish-UI captures, to make). Shot list: §4.
- `*-placeholder.jpg` screenshots are browser-TV stand-ins: **never upload them** (D4: the real ones come from the native TV app).

