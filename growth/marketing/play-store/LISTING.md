# JAMAA — Google Play store listing (EN / FR / AR / ES)

Package `app.jamaa.tv` · prepared 2026-10-04 · **renamed 2026-11-08** · paste-ready.

**Rename 2026-11-08** ([docs/JAMAA-PLATFORM.md](../../../docs/JAMAA-PLATFORM.md) §1). The app is **JAMAA** (جماعة, "the gang, the gathering"), a party-games hub for the TV; **Mish Ana!** is its game #1 and, today, its only game (`GAMES_ENABLED="mishana"`). Every listing leads with the hub, then describes each game that is on. The title is the platform's; the Mish Ana! copy below is the previous listing, reframed. When the owner turns a game on (Bluff, Most Likely, Trivia: JAMAA-PLATFORM §6.2), lane E adds that game's block to each description, in the same release; never describe a game before its id is in `GAMES_ENABLED`. In running text the brand is written "Jamaa" where all caps would shout (DESIGN-JAMAA §1.2); the title and short description keep "JAMAA".

**Rule change 2026-10-07.** Descriptions and short descriptions follow the new default: everyone gets the same word except **the Mole**, whose phone shows "You're the Mole!" and no word; a caught Mole gets one last guess at the word to steal the win. The optional different-word role (in-game name "Undercover", AR «المتخفّي») is described, **not named**, in EN/FR (see §0: "Undercover" stays out of Play metadata for trademark reasons; the AR name is fine). The "Blank" role is gone from the copy.

**Spanish is a full language** (owner decision 2026-11-08): the app UI, the hub, the rules and the Mish Ana! word packs ship in Spanish (`content/mishana/es/`, 379 pairs, drafts marked for native review). The es-ES and es-419 listings (§3b) are therefore published with the others. All Spanish copy here is a draft for native review.

Character counts are Unicode code points (what Play Console counts). Limits: title 30, short description 80, full description 4000, release notes 500 per language ([metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842): title ≤ 30, no emojis / ALL CAPS / "#1" / "free" / price or ranking claims in the title or icon; an all-caps brand name is the brand, not shouting, but it stays the only caps word in the title).

## 0. Decisions behind the copy (read once)

| Decision | Why |
|---|---|
| **The title is the platform: "JAMAA: Party Games for TV"** (and its translations) | JAMAA-PLATFORM §1.3: the Play title is PLATFORM copy. The brand comes first so a TV search for "JAMAA" (every end card says "Search JAMAA on your TV") lands on it; "party games" and "TV" carry the category intent |
| **Descriptions lead with the hub, then one block per game** | The first lines sell what is true for every game (one TV, phones as controllers, nothing to install, languages); the game block sells Mish Ana!'s mechanic. New games get their own block when they ship |
| **The word "Undercover" is not used anywhere** (title, descriptions, tags, screenshots) even though it is a high-volume search term | Another developer claims "Undercover" as a trademark (® on Google Play); the project already renamed the role to "Mole" for this reason (`docs/DESIGN.md:149`, `docs/RESEARCH.md:104-105`). Play's metadata/IP policy can remove listings that use another app's mark as a keyword. "Who's the spy?" is used instead: it is a generic name for the game genre, written in lower-case quotes, not an app title. Also avoided: "Mr. White", "Spyfall", "Imposter Party" |
| **No mention of the JAMAA Pass, subscriptions or pack purchases** while `BILLING_ENABLED` is off | With billing off every room plays the whole catalogue (JAMAA-PLATFORM §4.3) and the Pass UI is hidden. **When billing ships, swap in §4 "Billing-release replacements"**: the word-pair count becomes untrue for free users (free tier = the starter pack of each language, `en/fr/ar/es-everyday-01`) |
| "1,300+ word pairs" | Mish Ana! packs in `content/mishana/`: EN 372 + FR 369 + AR 279 + ES 379 = 1,399 (counted 2026-11-08); AR 279 incl. 51 Lebanese (`lb-food-01` 28 + `lb-life-01` 23). Recount when packs change |
| "Android TV" is named in every description | Required by Google's TV distribution checklist: "Mention 'Android TV' in your app's description" ([developer.android.com/training/tv/publishing/distribute](https://developer.android.com/training/tv/publishing/distribute)) |
| "Nothing to install on phones", "Android phones and iPhones" | Phones join through the browser page served by the Worker (`server/wrangler.jsonc` `assets`); the web client is plain web (Preact), iOS Safari is a supported target (`docs/PLAN.md`) |
| "Your word never appears on the TV while you play" | Words never reach the TV projection; they are sent to the TV only in RESULTS (SPEC §5.4 secrecy rules, CI leak test). Hence "while you play" |
| "Rooms and nicknames are deleted automatically" | Room storage is wiped on expiry (SPEC §7.5 room lifetimes) |
| **First 4 lines of every full description** = what Jamaa is + "nothing to install on phones", the game, facts, then "On your phone? Tap the arrow next to Install and choose your TV." (design-v3 D6) | Play shows only the first lines before "About this game ›", to TV and phone visitors alike. Ad traffic lands on the listing on phones, where a TV-only app reads "not compatible": the 4th line tells them to pick their TV from the Install drop-down. It is an instruction, not a "Download now"-style call to action (those are banned in graphics and the title; [answer/9866151](https://support.google.com/googleplay/android-developer/answer/9866151)) |
| Exclamation marks | Kept to the game's name and two hooks; body copy is plain, per the copywriting brief |
| Keywords targeted (natural use, no stuffing) | party games, party game, game night, TV game / games for TV, friends, family, word game, bluffing, who's the spy, secret word, phones as controllers, Android TV, Google TV, Lebanese, Arabic. FR: jeux d'ambiance, soirée jeux, jeu de mots, qui est l'espion, manette. AR: ألعاب سهرة، لعبة جماعية، الكلمة السرّية، مين الجاسوس، العائلة. ES: juegos de fiesta, juego del impostor, palabra secreta, noche de juegos |


## 1. English (United States) – en-US (default listing)

### App name — 25/30
```
JAMAA: Party Games for TV
```

### Short description — 72/80
```
Party games on your TV, phones as controllers. First up: who's the Mole?
```

### Full description — 3403/4000
```
Party games on your TV, played from your phones. Friends scan the QR code and join in their browser: nothing to install on phones, iPhone or Android.
First game: Mish Ana!, the secret-word game. Everyone gets the same word except the Mole. Give one clue each, vote, and catch the Mole on the big screen.
3–12 players · English, French, Arabic & Spanish · no ads, no accounts.
On your phone? Tap the arrow next to Install and choose your TV.

Your phones. One TV. The whole gang.

Jamaa (ja-MAA) is Arabic for "the gang, the gathering": everyone in the room, playing together on one screen. Open Jamaa on your Android TV or Google TV, everyone scans the QR code with their phone, and the TV runs the game.

MISH ANA!: WHO'S THE MOLE?
Everyone's innocent. Someone's lying.
Mish Ana! (Lebanese for "Not me!") is a word game, a bluffing game and a "who's the spy?" game in one. Everyone gets the same secret word on their phone, except the Mole. The Mole gets no word, just a card that says "You're the Mole!", and has to blend in with vague clues. Take turns giving one clue each, listen closely, and vote out whoever sounds off. A caught Mole gets one last guess at the word: get it right and steal the win.

Your phone holds the secret. The TV holds the drama.

HOW IT WORKS
1. Open Jamaa on your TV. A room code and a QR code appear.
2. Everyone scans the QR code with their phone camera. The game opens in the browser: no download, no account, just a nickname.
3. Press and hold to see your secret word, or to find out you're the Mole. Nobody else can see it.
4. Take turns saying one clue out loud, then everyone votes on their phone.
5. Catch the Mole before they blend in. A caught Mole gets one last guess at your word to steal the win.

Want more chaos? Add a player who gets a different word and doesn't know it (pizza vs pasta), or mix both roles.

WHY GROUPS LOVE IT
• 3 to 12 players: game night, family gatherings, birthdays, dinner with friends.
• Phones as controllers: everyone plays from the couch, no extra gamepads.
• Learn it in one round. Beginner mode shows everyone their role.
• The TV is the stage: dramatic reveals, vote countdowns and a scoreboard that carries over when you hit Play again.
• Secrets stay secret: your word only appears on your own phone, never on the TV while you play.

WORDS IN FOUR LANGUAGES
• English, French, Arabic and Spanish, with full right-to-left Arabic on the TV and on phones.
• 1,300+ word pairs across the four languages, in easy, everyday words: moon, escalator, Paris, forest, pizza, coffee.
• Lebanese packs: Lebanese food and Lebanese life, in the words people actually use.
• Difficulty from Easy to Subtle, plus a family-friendly filter.

MAKE IT YOUR GAME
• Timers for clues and votes, or no timer and the host moves things on.
• Pick how many Moles, and add players with a different word if you want.
• Official or Parity win rule.
• Fully playable with the TV remote: D-pad, OK and Back.

PRIVACY BUILT IN
• No ads. No accounts. No tracking.
• Players only type a nickname. Rooms and nicknames are deleted automatically when the room closes.

WHAT YOU NEED
• An Android TV or Google TV connected to the internet.
• One smartphone per player with a web browser and internet (Wi-Fi or mobile data). Android phones and iPhones both work.
• At least 3 players in the same room.

Who's the Mole at your table? Open Jamaa, scan, and find out.
```

### What's new (release notes, first JAMAA release) — 329/500
```
Welcome to JAMAA: party games for your TV, played from your phones.
• First game: Mish Ana!, the secret-word party game
• 3–12 players, no app to install on phones
• English, French, Arabic and Spanish, with Lebanese word packs
• Timers, Beginner mode, family-friendly filter
• No ads, no accounts
Tell us what your group thinks.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | JAMAA: Party Games for TV (25) | JAMAA: TV Party Games (21) | JAMAA: Party Games on TV (24) |
| Short description | Party games on your TV, phones as controllers. First up: who's the Mole? (72) | Game night on your TV: 3-12 players, phones as controllers, nothing to install (78) | Your phones. One TV. The whole gang. Party games for game night. (64) |

## 2. French (France) – fr-FR (also copy to fr-CA if you add it)

### App name — 26/30
```
JAMAA : Jeux d’ambiance TV
```

### Short description — 78/80
```
Des jeux d’ambiance sur la télé, téléphone en main. Pour commencer : la Taupe.
```

### Full description — 3856/4000
```
Des jeux d’ambiance sur la télé, joués depuis vos téléphones. Vos amis scannent le QR code et jouent dans le navigateur : rien à installer sur les téléphones, iPhone ou Android.
Premier jeu : Mish Ana!, le jeu du mot secret. Tout le monde reçoit le même mot, sauf la Taupe. Un indice chacun, un vote, et démasquez la Taupe sur grand écran.
3 à 12 joueurs · français, anglais, arabe et espagnol · sans pub, sans compte.
Sur votre téléphone ? Touchez la flèche à côté d’Installer et choisissez votre télé.

Vos téléphones. Une télé. Toute la bande.

Jamaa (prononcé « ja-MAA ») veut dire « la bande » en arabe : tous ceux qui sont dans la pièce, réunis devant le même écran. Lancez Jamaa sur votre Android TV ou Google TV, chacun scanne le QR code avec son téléphone, et la télé mène la partie.

MISH ANA! : QUI EST LA TAUPE ?
Tout le monde est innocent. Quelqu’un ment.
Mish Ana! (« Pas moi ! » en libanais) est un jeu de mots, de bluff et de « qui est l’espion ? » à la fois. Tout le monde reçoit le même mot secret sur son téléphone, sauf la Taupe. La Taupe n’a aucun mot, juste une carte « Tu es la Taupe ! », et doit se fondre dans le groupe avec des indices vagues. Chacun donne un indice à son tour : écoutez bien, puis votez contre celui qui sonne faux. Une Taupe démasquée a une dernière chance de deviner le mot : si elle trouve, elle vole la victoire.

Ton téléphone garde le secret. La télé fait le show.

COMMENT ÇA MARCHE
1. Lancez Jamaa sur la télé : un code de salle et un QR code s’affichent.
2. Chacun scanne le QR code avec l’appareil photo de son téléphone. Le jeu s’ouvre dans le navigateur : rien à installer, pas de compte, juste un pseudo.
3. Appuyez longuement pour voir votre mot secret, ou découvrir que vous êtes la Taupe. Personne d’autre ne le voit.
4. À tour de rôle, dites un indice à voix haute, puis tout le monde vote sur son téléphone.
5. Démasquez la Taupe avant qu’elle ne se fonde dans le groupe. Une Taupe démasquée a une dernière chance : deviner votre mot et voler la victoire.

Envie de pimenter ? Ajoutez un joueur qui reçoit un mot différent sans le savoir (pizza contre pâtes), ou mélangez les deux rôles.

POURQUOI ON ADORE
• De 3 à 12 joueurs : soirées jeux, repas de famille, anniversaires, soirées entre amis.
• Les téléphones servent de manettes : tout le monde joue depuis le canapé.
• Compris en une manche. Le mode débutant montre son rôle à chacun.
• La télé est la scène : révélations, compte à rebours des votes et tableau des scores qui continue quand vous rejouez.
• Les secrets restent secrets : votre mot n’apparaît que sur votre téléphone, jamais sur la télé pendant la partie.

DES MOTS EN QUATRE LANGUES
• Français, anglais, arabe et espagnol, avec l’arabe de droite à gauche sur la télé comme sur les téléphones.
• Plus de 1 300 paires de mots dans les quatre langues, avec des mots simples du quotidien : lune, escalator, Paris, forêt, pizza, café.
• Des packs libanais : la cuisine et la vie libanaises, avec les mots de tous les jours.
• Difficulté de Facile à Subtil, et un filtre famille.

À VOTRE FAÇON
• Minuteurs pour les indices et les votes, ou pas de minuteur : l’hôte fait avancer la partie.
• Choisissez le nombre de Taupes, et ajoutez des joueurs au mot différent si vous voulez.
• Règle de victoire officielle ou à parité.
• Entièrement jouable à la télécommande : flèches, OK et Retour.

VIE PRIVÉE RESPECTÉE
• Pas de pub. Pas de compte. Pas de pistage.
• Les joueurs saisissent seulement un pseudo. Les salles et les pseudos sont supprimés automatiquement à la fermeture de la salle.

CE QU’IL VOUS FAUT
• Une Android TV ou Google TV connectée à Internet.
• Un smartphone par joueur avec un navigateur et Internet (Wi-Fi ou données mobiles). Android et iPhone.
• Au moins 3 joueurs dans la même pièce.

Qui est la Taupe autour de vous ? Lancez Jamaa, scannez, et découvrez-le.
```

### What's new (release notes, first JAMAA release) — 362/500
```
Voici JAMAA : des jeux d’ambiance sur votre télé, joués depuis vos téléphones.
• Premier jeu : Mish Ana!, le jeu d’ambiance du mot secret
• 3 à 12 joueurs, rien à installer sur les téléphones
• Français, anglais, arabe et espagnol, avec des packs libanais
• Minuteurs, mode débutant, filtre famille
• Sans pub, sans compte
Dites-nous ce qu’en pense votre groupe.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | JAMAA : Jeux d’ambiance TV (26) | JAMAA : Jeux de soirée TV (25) | JAMAA : Jeux d’ambiance télé (28) |
| Short description | Des jeux d’ambiance sur la télé, téléphone en main. Pour commencer : la Taupe. (78) | Soirée jeux sur la télé : 3 à 12 joueurs, le téléphone sert de manette. (71) | Vos téléphones. Une télé. Toute la bande. Les jeux d’ambiance sur la télé. (74) |

## 3. Arabic – ar (Lebanese-friendly Modern Standard Arabic; brand lines kept in Lebanese as in shared/i18n/ar.json; new JAMAA lines are drafts for native review)

### App name — 28/30
```
جماعة: ألعاب سهرة عالتلفزيون
```

### Short description — 66/80
```
ألعاب سهرة على التلفزيون، والهواتف للتحكم. أوّل لعبة: مين الجاسوس؟
```

### Full description — 2996/4000
```
ألعاب سهرة عالتلفزيون، بتنلعب من تلفوناتكن. الأصحاب بيمسحوا كود QR وبيلعبوا من المتصفّح: ما في شي ينزّلوه عالتلفونات، آيفون أو أندرويد.
أوّل لعبة: «مش أنا!»، لعبة الكلمة السرّية. الكل بتوصلو نفس الكلمة إلّا الجاسوس. تلميح لكل واحد، تصويت، واكشفوا الجاسوس على الشاشة الكبيرة.
من 3 لـ12 لاعب · عربي وإنجليزي وفرنسي وإسباني · بلا إعلانات وبلا حسابات.
عم تشوفها عالتلفون؟ اكبس عالسهم حدّ «تثبيت» واختار التلفزيون.

تلفوناتكن، تلفزيون واحد، والجماعة كلّها.

«جماعة» يعني الشلّة واللمّة: كل اللي بالغرفة، عم يلعبوا سوا على شاشة وحدة. افتحوا جماعة على Android TV أو Google TV، كل واحد بيمسح كود QR بتلفونو، والتلفزيون بيدير اللعبة.

«مش أنا!»: مين الجاسوس؟
كلّنا أبرياء… بس في حدا عم يكذب.
«مش أنا!» لعبة كلمات وخداع و«مين الجاسوس؟» بنفس الوقت. كل اللاعبين يحصلون على الكلمة السرّية نفسها على هواتفهم، إلّا «الجاسوس»: لا كلمة له، فقط بطاقة «دورك: الجاسوس!»، وعليه أن يضيع بين الكل بتلميحات عامّة. كل لاعب يقول تلميحًا واحدًا بدوره: ركّزوا جيدًا، ثم صوّتوا لإخراج من يبدو كلامه غريبًا. وإذا انكشف الجاسوس تبقى له فرصة أخيرة لحزر الكلمة: إذا عرفها يخطف الفوز.

السرّ عالتلفون… والدراما عالتلفزيون.

كيف تلعبون؟
1. افتحوا «جماعة» على التلفزيون، فيظهر رمز الغرفة ورمز QR.
2. يمسح كل لاعب رمز QR بكاميرا هاتفه، فتُفتح اللعبة في المتصفح: بلا تحميل وبلا حساب، فقط اسم مستعار.
3. ضغطة مطوّلة تُظهر كلمتك السرّية، أو أنّ دورك الجاسوس. لا أحد غيرك يراها.
4. بالدور، قل تلميحك بصوت عالٍ، ثم يصوّت الجميع من هواتفهم.
5. اكشفوا الجاسوس قبل ما يضيع بينكم. وإذا انكشف تبقى له فرصة أخيرة لحزر كلمتكم وخطف الفوز.

بدكن أكتر؟ زيدوا «المتخفّي»: بتوصلو كلمة مختلفة وما بيعرف (بيتزا وباستا)، أو اخلطوا الدورين.

ليش رح تحبّوها؟
• من 3 إلى 12 لاعبًا: سهرات الأصحاب، جمعات العائلة، أعياد الميلاد.
• الهواتف هي أدوات التحكم: الكل يلعب من الكنبة، بلا أي جهاز إضافي.
• تتعلّمونها من أول جولة، ووضع المبتدئين يُظهر لكل لاعب دوره.
• التلفزيون هو المسرح: كشف مثير، عدّ تنازلي للتصويت، ولوحة نقاط تستمر عندما تلعبون من جديد.
• السرّ يبقى سرًّا: كلمتك تظهر على هاتفك فقط، ولا تظهر أبدًا على التلفزيون أثناء اللعب.

كلمات بأربع لغات
• العربية والإنجليزية والفرنسية والإسبانية، مع واجهة عربية كاملة من اليمين إلى اليسار على التلفزيون والهواتف.
• أكثر من 1300 زوج من الكلمات في اللغات الأربع، منها أكثر من 270 بالعربية، وكلها كلمات سهلة من كل يوم: قمر، درج كهربائي، باريس، غابة، بيتزا، قهوة.
• حزم لبنانية: أكل لبناني وحياة لبنانية، بالكلمات اللي منحكيها كل يوم.
• مستوى صعوبة من سهل إلى دقيق، وفلتر مناسب للعائلة.

على ذوقكم
• مؤقّت للتلميحات والتصويت، أو بلا مؤقّت ويتحكّم المضيف بالوقت.
• اختاروا عدد الجواسيس، وزيدوا «المتخفّي» إذا بدكن.
• قاعدة الفوز الرسمية أو قاعدة التساوي.
• تُلعب بالكامل بجهاز التحكم: الأسهم وOK والرجوع.

خصوصيتكم أولًا
• بلا إعلانات، بلا حسابات، بلا تتبّع.
• يكتب اللاعب اسمًا مستعارًا فقط، وتُحذف الغرفة والأسماء تلقائيًا عند إغلاق الغرفة.

ماذا تحتاجون؟
• تلفزيون Android TV أو Google TV متصل بالإنترنت.
• هاتف ذكي لكل لاعب فيه متصفح واتصال بالإنترنت (Wi-Fi أو بيانات الجوال). يعمل على هواتف Android وiPhone.
• 3 لاعبين على الأقل في الغرفة نفسها.

مين الجاسوس بينكم؟ افتحوا «جماعة»، امسحوا الرمز، واكتشفوا.
```

### What's new (release notes, first JAMAA release) — 315/500
```
أهلا بـ«جماعة»: ألعاب سهرة على تلفزيونك، بتنلعب من تلفوناتكن.
• أوّل لعبة: «مش أنا!»، لعبة الكلمة السرّية للسهرات
• من 3 إلى 12 لاعبًا، بلا تحميل على الهاتف
• العربية والإنجليزية والفرنسية والإسبانية، مع حزم كلمات لبنانية
• مؤقّتات، وضع المبتدئين، فلتر مناسب للعائلة
• بلا إعلانات وبلا حسابات
خبّرونا شو رأي شلّتكم.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | جماعة: ألعاب سهرة عالتلفزيون (28) | جماعة: ألعاب جماعية للتلفزيون (29) | جماعة: ألعاب سهرة للتلفزيون (27) |
| Short description | ألعاب سهرة على التلفزيون، والهواتف للتحكم. أوّل لعبة: مين الجاسوس؟ (66) | سهرة ألعاب على التلفزيون: من 3 إلى 12 لاعبًا، وهاتفك هو جهاز التحكم (67) | تلفوناتكن، تلفزيون واحد، والجماعة كلّها. ألعاب سهرة على تلفزيونك. (65) |

### Release notes in Play Console's multi-language paste format
Play Console → Release → (track) → Create release → Release notes → paste this whole block:
```
<en-US>
Welcome to JAMAA: party games for your TV, played from your phones.
• First game: Mish Ana!, the secret-word party game
• 3–12 players, no app to install on phones
• English, French, Arabic and Spanish, with Lebanese word packs
• Timers, Beginner mode, family-friendly filter
• No ads, no accounts
Tell us what your group thinks.
</en-US>
<fr-FR>
Voici JAMAA : des jeux d’ambiance sur votre télé, joués depuis vos téléphones.
• Premier jeu : Mish Ana!, le jeu d’ambiance du mot secret
• 3 à 12 joueurs, rien à installer sur les téléphones
• Français, anglais, arabe et espagnol, avec des packs libanais
• Minuteurs, mode débutant, filtre famille
• Sans pub, sans compte
Dites-nous ce qu’en pense votre groupe.
</fr-FR>
<ar>
أهلا بـ«جماعة»: ألعاب سهرة على تلفزيونك، بتنلعب من تلفوناتكن.
• أوّل لعبة: «مش أنا!»، لعبة الكلمة السرّية للسهرات
• من 3 إلى 12 لاعبًا، بلا تحميل على الهاتف
• العربية والإنجليزية والفرنسية والإسبانية، مع حزم كلمات لبنانية
• مؤقّتات، وضع المبتدئين، فلتر مناسب للعائلة
• بلا إعلانات وبلا حسابات
خبّرونا شو رأي شلّتكم.
</ar>
<es-ES>
Llega JAMAA: juegos de fiesta para tu tele, desde vuestros móviles.
• Primer juego: Mish Ana!, el juego del impostor con palabra secreta
• Interfaz y palabras en español: más de 370 parejas para España y Latinoamérica
• De 3 a 12 jugadores, nada que instalar en los móviles
• Temporizadores, modo principiante, filtro familiar
• Sin anuncios, sin cuentas
Cuéntanos qué tal lo pasa tu grupo.
</es-ES>
<es-419>
Llegó JAMAA: juegos de fiesta para tu TV, desde sus celulares.
• Primer juego: Mish Ana!, el juego del impostor con palabra secreta
• Interfaz y palabras en español: más de 370 parejas para Latinoamérica y España
• De 3 a 12 jugadores, nada que instalar en los celulares
• Temporizadores, modo principiante, filtro familiar
• Sin anuncios, sin cuentas
Cuéntanos qué tal la pasa tu grupo.
</es-419>
```

## 3b. Spanish – es-ES (Spain) and es-419 (Latin America: Mexico, Argentina, Colombia…) — drafts for native review

Published with the other languages: the Spanish UI and the Spanish word packs ship (`content/mishana/es/`, 379 pairs; drafts marked for native review in the packs). Same rules as §0: no "Undercover", "Mr White", "Imposter Party" / "Impostor Party", "Fakin' It", "The Mole", "Spyfall"; no JAMAA Pass or prices while billing is off. The brand is **JAMAA** in the title and short description and "Jamaa" in running text; the game is **Mish Ana!** (its name is not translated). In-game names follow `shared/i18n/es.json`: **el Topo** (the Mole, no word), **el Infiltrado** (the optional different-word role), **los Impostores** (their team).

The two listings share the title and most of the body; device words and the plural "you" differ: es-ES says *vosotros*, *móvil*, *tele*, *mando*; es-419 says *ustedes*, *celular*, *TV*, *control remoto*.

**Keyword notes.** Searched terms in ES/MX/AR: **"juego del impostor"**, **"impostor"**, "el impostor", "quién es el impostor", "juego espía" / "quién es el espía", "palabra secreta", "mentiroso", "juego para fiestas", "juegos en grupo", "noche de juegos", "juego familiar", "juego de TV". Spanish spells it **impostor**; the English spelling **imposter** is also typed, so the description uses both once, naturally. The platform title leads with the brand (§0); the impostor keyword moves to the short description and the first lines, and Variant A tests it in the title. Do not copy a competitor's title ("Impostor: Juego Espía" is Fakeit's MX title). Hashtags for posts, not metadata: #juegodelimpostor #impostor.

### App name (both) — 29/30
```
JAMAA: Juegos de fiesta en TV
```

### Short description — es-ES — 77/80
```
Juegos de fiesta en la tele, con tu móvil. El primero: el juego del impostor.
```

### Short description — es-419 — 77/80
```
Juegos de fiesta en tu TV, con tu celular. El primero: el juego del impostor.
```

### Full description — es-ES — 3850/4000
```
Juegos de fiesta en la tele, desde vuestros móviles. Tus amigos escanean el código QR y juegan en el navegador: no hay nada que instalar en los móviles, iPhone o Android.
Primer juego: Mish Ana!, el juego del impostor. Todos reciben la misma palabra secreta, menos el Topo. Una pista cada uno, una votación, y a desenmascararlo en la pantalla grande.
De 3 a 12 jugadores · español, inglés, francés y árabe · sin anuncios, sin cuentas.
¿Estás en el móvil? Toca la flecha junto a Instalar y elige tu tele.

Vuestros móviles. Una tele. Toda la pandilla.

Jamaa (se pronuncia «ya-MAA») significa «la pandilla, la reunión» en árabe: todos los que estáis en el salón, jugando juntos en la misma pantalla. Abre Jamaa en tu Android TV o Google TV, cada uno escanea el QR con su móvil y la tele dirige la partida.

MISH ANA!: ¿QUIÉN ES EL TOPO?
Todos son inocentes. Alguien miente.
Mish Ana! («¡Yo no!» en libanés) es el juego del impostor para la tele: un juego de palabras, de faroles y de «¿quién es el espía?», todo en uno. Todos reciben la misma palabra secreta en el móvil, menos el Topo. El Topo no tiene palabra, solo una carta que dice «¡Eres el Topo!», y tiene que pasar desapercibido con pistas vagas. Por turnos, cada uno da una pista: escuchad bien y votad contra quien suene raro. Si pilláis al Topo, tiene una última oportunidad: si adivina la palabra, se lleva la victoria.

Tu móvil guarda el secreto. La tele pone el drama.

CÓMO SE JUEGA
1. Abre Jamaa en la tele: aparecen un código de sala y un código QR.
2. Cada jugador escanea el QR con la cámara del móvil. El juego se abre en el navegador: sin descargas, sin cuenta, solo un apodo.
3. Mantén pulsado para ver tu palabra secreta, o para descubrir que eres el Topo. Nadie más lo ve.
4. Por turnos, decid una pista en voz alta y luego votad desde el móvil.
5. Descubrid al Topo antes de que se camufle. Si lo pilláis, tiene una última oportunidad: adivinar vuestra palabra y robaros la victoria.

¿Queréis más caos? Añadid un Infiltrado: recibe una palabra parecida y no lo sabe (pizza contra pasta). O mezclad los dos papeles.

POR QUÉ ENGANCHA
• De 3 a 12 jugadores: noches de juegos, reuniones familiares, cumpleaños, cenas con amigos.
• Los móviles hacen de mando: todos juegan desde el sofá, sin mandos extra.
• Se aprende en una ronda. El modo principiante muestra a cada uno su papel.
• La tele es el escenario: revelaciones, cuenta atrás de las votaciones y un marcador que sigue cuando volvéis a jugar.
• Los secretos siguen siendo secretos: tu palabra solo aparece en tu móvil, nunca en la tele mientras jugáis.

PALABRAS EN ESPAÑOL
• Más de 370 parejas de palabras en español neutro, pensadas para jugar igual en España y en Latinoamérica: luna y sol, playa y río, churro y buñuelo, tango y flamenco.
• Categorías: día a día, lugares, comida, naturaleza, cosas y ocio.
• También en inglés, francés y árabe (con árabe de derecha a izquierda en la tele y en los móviles): más de 1300 parejas en total.
• Dificultad de Fácil a Sutil, y un filtro apto para toda la familia.

A TU MANERA
• Temporizador para las pistas y los votos, o sin temporizador y el anfitrión decide cuándo seguir.
• Elige cuántos Topos hay y añade Infiltrados si os apetece.
• Regla de victoria oficial o por paridad.
• Se juega entero con el mando de la tele: flechas, OK y Atrás.

PRIVACIDAD
• Sin anuncios. Sin cuentas. Sin rastreo.
• Los jugadores solo escriben un apodo. Las salas y los apodos se borran solos cuando se cierra la sala.

QUÉ NECESITAS
• Una Android TV o Google TV conectada a internet.
• Un smartphone por jugador con navegador e internet (wifi o datos). Sirven Android y iPhone.
• Al menos 3 jugadores en la misma habitación.

¿Buscas el juego del impostor (o «imposter», como lo llaman en inglés) para jugar en la tele? ¿Quién es el Topo en tu grupo? Abre Jamaa, escanea y descúbrelo.
```

### Full description — es-419 — 3865/4000
```
Juegos de fiesta en tu TV, desde sus celulares. Tus amigos escanean el código QR y juegan en el navegador: no hay nada que instalar en los celulares, iPhone o Android.
Primer juego: Mish Ana!, el juego del impostor. Todos reciben la misma palabra secreta, menos el Topo. Una pista cada uno, una votación, y a desenmascararlo en la pantalla grande.
De 3 a 12 jugadores · español, inglés, francés y árabe · sin anuncios, sin cuentas.
¿Estás en el celular? Toca la flecha junto a Instalar y elige tu TV.

Sus celulares. Una TV. Toda la banda.

Jamaa (se pronuncia «ya-MAA») significa «la banda, la reunión» en árabe: todos los que están en la sala, jugando juntos en la misma pantalla. Abre Jamaa en tu Android TV o Google TV, cada uno escanea el QR con su celular y la TV dirige la partida.

MISH ANA!: ¿QUIÉN ES EL TOPO?
Todos son inocentes. Alguien miente.
Mish Ana! («¡Yo no!» en libanés) es el juego del impostor para la TV: un juego de palabras, de engaños y de «¿quién es el espía?», todo en uno. Todos reciben la misma palabra secreta en el celular, menos el Topo. El Topo no tiene palabra, solo una carta que dice «¡Eres el Topo!», y tiene que pasar desapercibido con pistas vagas. Por turnos, cada uno da una pista: escuchen bien y voten contra quien suene raro. Si atrapan al Topo, tiene una última oportunidad: si adivina la palabra, se lleva la victoria.

Tu celular guarda el secreto. La TV pone el drama.

CÓMO SE JUEGA
1. Abre Jamaa en la TV: aparecen un código de sala y un código QR.
2. Cada jugador escanea el QR con la cámara del celular. El juego se abre en el navegador: sin descargas, sin cuenta, solo un apodo.
3. Mantén presionado para ver tu palabra secreta, o para descubrir que eres el Topo. Nadie más lo ve.
4. Por turnos, digan una pista en voz alta y luego voten desde el celular.
5. Descubran al Topo antes de que se camufle. Si lo atrapan, tiene una última oportunidad: adivinar su palabra y robarles la victoria.

¿Quieren más caos? Agreguen un Infiltrado: recibe una palabra parecida y no lo sabe (pizza contra pasta). O mezclen los dos papeles.

POR QUÉ ENGANCHA
• De 3 a 12 jugadores: noches de juegos, reuniones familiares, cumpleaños, cenas con amigos.
• Los celulares son los controles: todos juegan desde el sofá, sin controles extra.
• Se aprende en una ronda. El modo principiante muestra a cada uno su papel.
• La TV es el escenario: revelaciones, cuenta regresiva de las votaciones y un marcador que sigue cuando vuelven a jugar.
• Los secretos siguen siendo secretos: tu palabra solo aparece en tu celular, nunca en la TV mientras juegan.

PALABRAS EN ESPAÑOL
• Más de 370 parejas de palabras en español neutro, pensadas para jugar igual en Latinoamérica y en España: luna y sol, playa y río, churro y buñuelo, tango y flamenco.
• Categorías: día a día, lugares, comida, naturaleza, cosas y pasatiempos.
• También en inglés, francés y árabe (con árabe de derecha a izquierda en la TV y en los celulares): más de 1300 parejas en total.
• Dificultad de Fácil a Sutil, y un filtro apto para toda la familia.

A TU MANERA
• Temporizador para las pistas y los votos, o sin temporizador y el anfitrión decide cuándo seguir.
• Elige cuántos Topos hay y agrega Infiltrados si quieren.
• Regla de victoria oficial o por paridad.
• Se juega entero con el control remoto de la TV: flechas, OK y Atrás.

PRIVACIDAD
• Sin anuncios. Sin cuentas. Sin rastreo.
• Los jugadores solo escriben un apodo. Las salas y los apodos se borran solos cuando se cierra la sala.

QUÉ NECESITAS
• Una Android TV o Google TV conectada a internet.
• Un smartphone por jugador con navegador e internet (wifi o datos móviles). Sirven Android y iPhone.
• Al menos 3 jugadores en la misma habitación.

¿Buscas el juego del impostor (o «imposter», como lo llaman en inglés) para jugar en la TV? ¿Quién es el Topo en tu grupo? Abre Jamaa, escanea y descúbrelo.
```

### What's new — es-ES 390/500 · es-419 387/500
The `<es-ES>` and `<es-419>` blocks of the multi-language paste block above.

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | JAMAA: Juegos de fiesta en TV (29) | JAMAA: Juego del Impostor TV (28) | JAMAA: Juegos para la tele (26; es-ES only) |
| Short description (es-ES) | Juegos de fiesta en la tele, con tu móvil. El primero: el juego del impostor. (77) | ¿Quién es el impostor? El juego de la palabra secreta en la tele, con tu móvil. (79) | Vuestros móviles. Una tele. Toda la pandilla. Juegos de fiesta para la tele. (76) |
| Short description (es-419) | Juegos de fiesta en tu TV, con tu celular. El primero: el juego del impostor. (77) | ¿Quién es el impostor? El juego de la palabra secreta en tu TV, con tu celular. (79) | Sus celulares. Una TV. Toda la banda. Juegos de fiesta para tu TV. (66) |

Graphics: `feature-1024x500-es.png` (rendered 2026-11-08, draft copy), `tv-banner-1280x720-es.png` (Latin banner), `screenshots/tv-0[1-8]-*-es.png` (Spanish-UI captures, still to make; one set serves both es-ES and es-419). Screenshot 6 caption: "Más de 370 parejas de palabras en español".

## 4. Billing-release replacements (use only when the JAMAA Pass / packs ship, `BILLING_ENABLED`)

When the release with Play Billing goes live, update all listings **in the same rollout** (otherwise the word-pair bullet misdescribes the free tier, a Play policy issue, and TV-G3 requires the app to match its listing). Products (JAMAA-PLATFORM §4.1): the **JAMAA Pass** subscription (`jamaa_pass`, monthly or yearly, 7-day free trial for new subscribers) unlocks every pack of every game; single packs (`pack_<family>`) are sold one by one; every game stays free to play with its starter content.

| Replace this bullet | With (EN) | FR | AR | ES (both) |
|---|---|---|---|---|
| "1,300+ word pairs across the four languages…" | `• Free starter pack in every language. The JAMAA Pass (monthly or yearly, with a free trial) unlocks every pack of every game, 1,300+ word pairs for Mish Ana! alone, and every new one; single packs are also sold.` | `• Un pack de départ gratuit dans chaque langue. Le JAMAA Pass (mensuel ou annuel, avec un essai gratuit) débloque tous les packs de tous les jeux, plus de 1 300 paires de mots rien que pour Mish Ana!, et les suivants ; chaque pack est aussi vendu à l’unité.` | `• حزمة بداية مجانية بكل لغة. «JAMAA Pass» (شهري أو سنوي، مع فترة تجربة مجانية) يفتح كل حزم كل الألعاب، منها أكثر من 1300 زوج من الكلمات لـ«مش أنا!» وحدها، وكل حزمة جديدة، ويمكن شراء كل حزمة وحدها.` | `• Un pack inicial gratis en cada idioma. El JAMAA Pass (mensual o anual, con prueba gratis) desbloquea todos los packs de todos los juegos, y cada pack también se vende por separado.` (replaces the first bullet of PALABRAS EN ESPAÑOL) |
| "No ads. No accounts. No tracking." | `• No ads. No accounts. No tracking. Only the host's TV can buy; phones never pay.` | `• Pas de pub. Pas de compte. Pas de pistage. Seule la télé de l’hôte peut acheter ; les téléphones ne paient jamais.` | `• بلا إعلانات، بلا حسابات، بلا تتبّع. الشراء فقط من تلفزيون المضيف، والهواتف لا تدفع أبدًا.` | `• Sin anuncios. Sin cuentas. Sin rastreo. Solo la tele del anfitrión puede comprar; los móviles nunca pagan.` (es-419: *la TV*, *los celulares*) |

Also at that point: re-answer the content-rating questionnaire (digital purchases = Yes), update Data safety (DATA-SAFETY.md §1.B), insert the privacy-policy block (PRIVACY-POLICY.md Appendix B, already written for the JAMAA Pass), and switch the EU trader declaration (RELEASE-CHECKLIST.md step 0.6). Play adds the "In-app purchases" badge automatically. Do **not** write prices or "free trial" in the title/short description (metadata policy); the trial is shown by Play on the subscription offer.

## 5. A/B testing plan (store listing experiments)

Facts that shape the plan ([Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/6227309)):
- Experiments run on a **published** app only, so start them after production launch (not during the closed test).
- Testable: icon, feature graphic, screenshots, promo video (default graphics experiment) and **short + full description** (localized experiment, up to 5 languages at once). **The app name cannot be A/B tested** with experiments.
- One default graphics experiment **or** up to five localized experiments at the same time.

Order (each run until Play declares a result or ~2–3 weeks; TV traffic is small, so prefer **2 arms** (control + 1 variant) and a 50/50 split to reach significance faster):

| # | Experiment | Arms | Hypothesis |
|---|---|---|---|
| 1 | Localized, EN-US: short description | Control vs Variant A ("Game night on your TV: 3-12 players…") | Concrete numbers + "nothing to install" beat the "who's the Mole?" hook for TV browsers who don't know the genre |
| 2 | Localized, EN-US: short description | Winner of 1 vs Variant B (platform slogan) | Brand slogan vs benefit line |
| 3 | Default graphics: first TV screenshot / feature graphic | Lobby-with-QR first vs Vote-reveal first (see GRAPHICS-SPEC.md §4) | Showing "scan to join" first removes the "do we need controllers?" objection |
| 4 | FR, AR and ES short description (localized, run together) | Control vs Variant A | Same as 1 in other markets; for ES, Variant A also tests the impostor keyword |

**App-name alternatives** (no experiment possible): change the name once after ~4 weeks of stable traffic and compare store-listing conversion (Play Console → Grow users → Store performance → Store listing acquisition) for 4 weeks before vs after. Recommended order: Control → Variant A. Avoid frequent renames (search ranking resets and review re-triggers).

## 6. Category, tags, contact details (Store settings)

Play Console → **Grow users → Store presence → Store settings**.

| Field | Value | Notes |
|---|---|---|
| App or game | **Game** | Needed for the Games row on Android TV too (see RELEASE-CHECKLIST.md blocker B1, `android:isGame`) |
| Category | **Word** (recommended) · alternative: **Casual** | Word is a smaller category where a party word game stands out and matches the "word game" intent; Casual is larger but crowded with mobile hyper-casual games. There is no "Party" category |
| Tags (pick up to 5 from Play's list) | Prefer, in this order, whichever exist in the picker: **Party**, **Multiplayer** / **Local multiplayer**, **Word**, **Casual**, **Stylized** (or **Offline** only if true, it is not: the game needs internet) | The tag list is fixed by Google and changes; choose the closest matches shown in the picker. Do not pick "Single player" or "Offline" |
| Email address (public, required) | `{{SUPPORT_EMAIL}}` (e.g. a dedicated `hello@<your-domain>`, not a personal Gmail) | Shown on the listing. Use the same address in `SUPPORT_EMAIL` (`shared/src/billing/products.ts:31`, currently empty) and the privacy policy |
| Phone number | Leave empty | Optional; avoid exposing a personal number |
| Website | `{{WEBSITE_URL}}` (the landing page) | Optional but helps trust and the privacy-policy check |
| Privacy policy URL (App content → Privacy policy) | `{{WEBSITE_URL}}/privacy` | Must be a public, non-geofenced, non-PDF web page. Note: `https://play.jamaa.workers.dev/privacy` currently returns the phone app's SPA shell (HTTP 200, not a policy), so do **not** use the Worker URL |
| External marketing | Leave on | Lets Google promote the app outside Play |
| Default language | English (United States) – en-US | Add translations: French (France) – fr-FR, Arabic – ar, Spanish (Spain) – es-ES and Spanish (Latin America) – es-419 (§3b). Optionally en-GB and fr-CA by copying the same text |

### Store listing graphics per language
Files in `graphics/` (spec and render command: GRAPHICS-SPEC.md). Upload per listing (Play Console → Main store listing → Manage translations → language → "Add own graphics"):
- **en-US**: `icon-512.png`, `feature-1024x500-en.png`, `tv-banner-1280x720-en.png`, `screenshots/tv-0[1-8]-*-en.png`.
- **fr-FR**: same icon, `feature-1024x500-fr.png`, `tv-banner-1280x720-fr.png` (Latin name, same art as EN), `screenshots/tv-0[1-8]-*-fr.png`.
- **ar**: same icon, `feature-1024x500-ar.png`, `tv-banner-1280x720-ar.png`, `screenshots/tv-0[1-8]-*-ar.png` (Arabic-UI captures). Otherwise Arabic users see English graphics.
- **es-ES and es-419**: same icon, `feature-1024x500-es.png`, `tv-banner-1280x720-es.png` (Latin name, same art as EN), `screenshots/tv-0[1-8]-*-es.png` (Spanish-UI captures, to make).
- `*-placeholder.jpg` screenshots are browser-TV stand-ins: **never upload them** (D4: the real ones come from the native TV app).
