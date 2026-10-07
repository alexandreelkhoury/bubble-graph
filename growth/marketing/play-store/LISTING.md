# Mish Ana! — Google Play store listing (EN / FR / AR)

Package `app.mishana.tv` · prepared 2026-10-04 · paste-ready.
**Rule change 2026-10-07.** Descriptions and short descriptions now follow the new default: everyone gets the same word except **the Mole**, whose phone shows "You're the Mole!" and no word; a caught Mole gets one last guess at the word to steal the win. The optional different-word role (in-game name "Undercover", AR «المتخفّي») is described, **not named**, in EN/FR (see §0: "Undercover" stays out of Play metadata for trademark reasons; the AR name is fine). The "Blank" role is gone from the copy. Check the "560+ word pairs" count against `word-packs/` once the new everyday-word packs land.

Character counts are Unicode code points (what Play Console counts). Limits: title 30, short description 80, full description 4000, release notes 500 per language ([metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842): title ≤ 30, no emojis / ALL CAPS / "#1" / "free" / price or ranking claims in the title or icon).

## 0. Decisions behind the copy (read once)

| Decision | Why |
|---|---|
| **The word "Undercover" is not used anywhere** (title, descriptions, tags, screenshots) even though it is a high-volume search term | Another developer claims "Undercover" as a trademark (® on Google Play); the project already renamed the role to "Mole" for this reason (`docs/DESIGN.md:149`, `docs/RESEARCH.md:104-105`). Play's metadata/IP policy can remove listings that use another app's mark as a keyword. "Who's the spy?" is used instead: it is a generic name for the game genre, written in lower-case quotes, not an app title. Also avoided: "Mr. White", "Spyfall", "Imposter Party" |
| **No mention of Premium, subscriptions or word-pack purchases** | Play Billing is **not shipped**: the TV app has no billing library (`tv-app/app/build.gradle.kts:86-110`), and the server still plays the whole catalogue for every room (`server/src/room-core.ts:654-657`, PAY-GAP). Today every one of the 563 pairs is playable. **When billing ships, swap in §4 "Billing-release replacements"** — the "560+ word pairs" line becomes untrue for free users (free tier = 1 starter pack of 24 pairs per language, `docs/PAYMENTS-SPEC.md` §0) |
| "560+ word pairs" | EN 217 + FR 215 + AR 131 = 563 (counted from `word-packs/packs/*/*.json`); AR 131 incl. 50 Lebanese (`lb-food-01` 27 + `lb-life-01` 23) |
| "Android TV" is named in every description | Required by Google's TV distribution checklist: "Mention 'Android TV' in your app's description" ([developer.android.com/training/tv/publishing/distribute](https://developer.android.com/training/tv/publishing/distribute)) |
| "Nothing to install on phones", "Android phones and iPhones" | Phones join through the browser page served by the Worker (`README.md:3`, `server/wrangler.jsonc` `assets`); the web client is plain web (Preact), iOS Safari is a supported target (`docs/PLAN.md:136`) |
| "Your word never appears on the TV while you play" | Words never reach the TV projection; they are sent to the TV only in RESULTS (`docs/PLAN.md:97-101`, CI leak test `docs/PLAN.md:109`). Hence "while you play" |
| "Rooms and nicknames are deleted automatically" | Alarm deletes all room storage on expiry (`server/src/room-core.ts:284-287`, `server/src/room-store.ts:70-71`; TTLs `shared/src/constants.ts:21-23`) |
| **First 4 lines of every full description** = mechanic, "nothing to install on phones", facts, then "On your phone? Tap the arrow next to Install and choose your TV." (design-v3 D6) | Play shows only the first lines before "About this game ›", to TV and phone visitors alike. They now sell the mechanic and the no-app-on-phones promise; the slogan moves to line 6. Ad traffic lands on the listing on phones, where a TV-only app reads "not compatible": the 4th line tells them to pick their TV from the Install drop-down. It is an instruction, not a "Download now"-style call to action (those are banned in graphics and the title; [answer/9866151](https://support.google.com/googleplay/android-developer/answer/9866151)) |
| Exclamation marks | Kept to the brand name and two hooks; body copy is plain, per the copywriting brief |
| Keywords targeted (natural use, no stuffing) | party game, game night, TV game / game for TV, friends, family, word game, bluffing, who's the spy, secret word, phones as controllers, Android TV, Google TV, Lebanese, Arabic. FR: jeu d'ambiance, soirée jeux, jeu de mots, qui est l'espion, manette. AR: لعبة سهرات، لعبة جماعية، الكلمة السرّية، مين الجاسوس، العائلة |


## 1. English (United States) – en-US (default listing)

### App name — 27/30
```
Mish Ana! Party Game for TV
```

### Short description — 76/80
```
Who's the Mole? A secret-word party game for TV. Phones are the controllers.
```

### Full description — 3140/4000
```
Everyone gets the same secret word on their phone, except the Mole: their phone just says "You're the Mole!". Give one clue each, vote, and catch the Mole on the big screen.
Install it on your TV. Friends join by scanning the QR code: nothing to install on phones, iPhone or Android.
3–12 players · English, French & Arabic · no ads, no accounts.
On your phone? Tap the arrow next to Install and choose your TV.

Everyone's innocent. Someone's lying.

Mish Ana! (Lebanese for "Not me!") is the secret-word party game for Android TV and Google TV: a word game, a bluffing game and a "who's the spy?" game in one. Everyone gets the same secret word on their phone, except the Mole. The Mole gets no word, just a card that says "You're the Mole!", and has to blend in with vague clues. Take turns giving one clue each, listen closely, and vote out whoever sounds off. A caught Mole gets one last guess at the word: get it right and steal the win.

Your phone holds the secret. The TV holds the drama.

HOW IT WORKS
1. Open Mish Ana! on your TV. A room code and a QR code appear.
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

WORDS IN THREE LANGUAGES
• English, French and Arabic, with full right-to-left Arabic on the TV and on phones.
• 560+ word pairs across the three languages, in easy, everyday words: moon, escalator, Paris, forest, pizza, coffee.
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

Who's the Mole at your table? Open Mish Ana!, scan, and find out.
```

### What's new (release notes, v0.1.0 / first release) — 283/500
```
Mish Ana! is here: the secret-word party game for your TV.
• 3–12 players, phones as controllers (no app to install on phones)
• English, French and Arabic, with Lebanese word packs
• Timers, Beginner mode, family-friendly filter
• No ads, no accounts
Tell us what your group thinks.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | Mish Ana! Party Game for TV (27) | Mish Ana! Secret Word Party (27) | Mish Ana!: TV Word Party Game (29) |
| Short description | Who's the Mole? A secret-word party game for TV. Phones are the controllers. (76) | Game night on your TV: 3-12 players, phones as controllers, nothing to install (78) | Everyone's innocent. Someone's lying. The secret-word party game for your TV. (77) |

## 2. French (France) – fr-FR (also copy to fr-CA if you add it)

### App name — 27/30
```
Mish Ana! Jeu d’ambiance TV
```

### Short description — 71/80
```
Qui est la Taupe ? Le jeu du mot secret sur la télé, téléphone en main.
```

### Full description — 3542/4000
```
Tout le monde reçoit le même mot secret sur son téléphone, sauf la Taupe : son écran affiche juste « Tu es la Taupe ! ». Un indice chacun, un vote, et démasquez la Taupe sur grand écran.
Installez-le sur la télé. Vos amis scannent le QR code : rien à installer sur les téléphones, iPhone ou Android.
3 à 12 joueurs · français, anglais et arabe · sans pub, sans compte.
Sur votre téléphone ? Touchez la flèche à côté d’Installer et choisissez votre télé.

Tout le monde est innocent. Quelqu’un ment.

Mish Ana! (« Pas moi ! » en libanais) est le jeu d’ambiance du mot secret pour Android TV et Google TV : un jeu de mots, de bluff et de « qui est l’espion ? » à la fois. Tout le monde reçoit le même mot secret sur son téléphone, sauf la Taupe. La Taupe n’a aucun mot, juste une carte « Tu es la Taupe ! », et doit se fondre dans le groupe avec des indices vagues. Chacun donne un indice à son tour : écoutez bien, puis votez contre celui qui sonne faux. Une Taupe démasquée a une dernière chance de deviner le mot : si elle trouve, elle vole la victoire.

Ton téléphone garde le secret. La télé fait le show.

COMMENT ÇA MARCHE
1. Lancez Mish Ana! sur la télé : un code de salle et un QR code s’affichent.
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

DES MOTS EN TROIS LANGUES
• Français, anglais et arabe, avec l’arabe de droite à gauche sur la télé comme sur les téléphones.
• Plus de 560 paires de mots dans les trois langues, avec des mots simples du quotidien : lune, escalator, Paris, forêt, pizza, café.
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

Qui est la Taupe autour de vous ? Lancez Mish Ana!, scannez, et découvrez-le.
```

### What's new (release notes, v0.1.0 / first release) — 299/500
```
Mish Ana! arrive : le jeu d’ambiance du mot secret sur votre télé.
• 3 à 12 joueurs, les téléphones servent de manettes (rien à installer)
• Français, anglais et arabe, avec des packs libanais
• Minuteurs, mode débutant, filtre famille
• Sans pub, sans compte
Dites-nous ce qu’en pense votre groupe.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | Mish Ana! Jeu d’ambiance TV (27) | Mish Ana! Jeu du mot secret (27) | Mish Ana! Jeu de soirée TV (26) |
| Short description | Qui est la Taupe ? Le jeu du mot secret sur la télé, téléphone en main. (71) | Soirée jeux sur la télé : 3 à 12 joueurs, le téléphone sert de manette. (71) | Tout le monde est innocent. Quelqu’un ment. Le jeu du mot secret sur la télé. (77) |

## 3. Arabic – ar (Lebanese-friendly Modern Standard Arabic; brand lines kept in Lebanese as in shared/i18n/ar.json)

### App name — 29/30
```
مش أنا! لعبة سهرات عالتلفزيون
```

### Short description — 71/80
```
مين الجاسوس؟ لعبة الكلمة السرّية للسهرات على التلفزيون، والهواتف للتحكم
```

### Full description — 2770/4000
```
الكل بتوصلو نفس الكلمة السرّية عالتلفون، إلّا الجاسوس: عتلفونو بس «دورك: الجاسوس!». تلميح لكل واحد، تصويت، واكشفوا الجاسوس على الشاشة الكبيرة.
نزّلوها عالتلفزيون، والأصحاب بيفوتوا بمسح كود QR: ما في شي ينزّلوه عالتلفونات، آيفون أو أندرويد.
من 3 لـ12 لاعب · عربي وإنجليزي وفرنسي · بلا إعلانات وبلا حسابات.
عم تشوفها عالتلفون؟ اكبس عالسهم حدّ «تثبيت» واختار التلفزيون.

كلّنا أبرياء… بس في حدا عم يكذب.

«مش أنا!» هي لعبة الكلمة السرّية للسهرات على Android TV و Google TV: لعبة كلمات وخداع و«مين الجاسوس؟» بنفس الوقت. كل اللاعبين يحصلون على الكلمة السرّية نفسها على هواتفهم، إلّا «الجاسوس»: لا كلمة له، فقط بطاقة «دورك: الجاسوس!»، وعليه أن يضيع بين الكل بتلميحات عامّة. كل لاعب يقول تلميحًا واحدًا بدوره: ركّزوا جيدًا، ثم صوّتوا لإخراج من يبدو كلامه غريبًا. وإذا انكشف الجاسوس تبقى له فرصة أخيرة لحزر الكلمة: إذا عرفها يخطف الفوز.

السرّ عالتلفون… والدراما عالتلفزيون.

كيف تلعبون؟
1. افتحوا «مش أنا!» على التلفزيون، فيظهر رمز الغرفة ورمز QR.
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

كلمات بثلاث لغات
• العربية والإنجليزية والفرنسية، مع واجهة عربية كاملة من اليمين إلى اليسار على التلفزيون والهواتف.
• أكثر من 560 زوجًا من الكلمات في اللغات الثلاث، منها أكثر من 130 بالعربية، وكلها كلمات سهلة من كل يوم: قمر، درج كهربائي، باريس، غابة، بيتزا، قهوة.
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

مين الجاسوس بينكم؟ افتحوا «مش أنا!»، امسحوا الرمز، واكتشفوا.
```

### What's new (release notes, v0.1.0 / first release) — 275/500
```
وصلت «مش أنا!»: لعبة الكلمة السرّية للسهرات على تلفزيونك.
• من 3 إلى 12 لاعبًا، والهواتف هي أدوات التحكم (بلا تحميل على الهاتف)
• العربية والإنجليزية والفرنسية، مع حزم كلمات لبنانية
• مؤقّتات، وضع المبتدئين، فلتر مناسب للعائلة
• بلا إعلانات وبلا حسابات
خبّرونا شو رأي شلّتكم.
```

### A/B alternatives

| Field | Control (above) | Variant A | Variant B |
|---|---|---|---|
| App name | مش أنا! لعبة سهرات عالتلفزيون (29) | مش أنا! لعبة الكلمة السرّية (27) | مش أنا! لعبة جماعية للتلفزيون (29) |
| Short description | مين الجاسوس؟ لعبة الكلمة السرّية للسهرات على التلفزيون، والهواتف للتحكم (71) | سهرة ألعاب على التلفزيون: من 3 إلى 12 لاعبًا، وهاتفك هو جهاز التحكم (67) | كلّنا أبرياء… بس في حدا عم يكذب. لعبة الكلمة السرّية على تلفزيونك. (66) |

### Release notes in Play Console's multi-language paste format
Play Console → Release → (track) → Create release → Release notes → paste this whole block:
```
<en-US>
Mish Ana! is here: the secret-word party game for your TV.
• 3–12 players, phones as controllers (no app to install on phones)
• English, French and Arabic, with Lebanese word packs
• Timers, Beginner mode, family-friendly filter
• No ads, no accounts
Tell us what your group thinks.
</en-US>
<fr-FR>
Mish Ana! arrive : le jeu d’ambiance du mot secret sur votre télé.
• 3 à 12 joueurs, les téléphones servent de manettes (rien à installer)
• Français, anglais et arabe, avec des packs libanais
• Minuteurs, mode débutant, filtre famille
• Sans pub, sans compte
Dites-nous ce qu’en pense votre groupe.
</fr-FR>
<ar>
وصلت «مش أنا!»: لعبة الكلمة السرّية للسهرات على تلفزيونك.
• من 3 إلى 12 لاعبًا، والهواتف هي أدوات التحكم (بلا تحميل على الهاتف)
• العربية والإنجليزية والفرنسية، مع حزم كلمات لبنانية
• مؤقّتات، وضع المبتدئين، فلتر مناسب للعائلة
• بلا إعلانات وبلا حسابات
خبّرونا شو رأي شلّتكم.
</ar>
```
## 4. Billing-release replacements (use only when Premium / packs ship)

When the release with Play Billing goes live, update all three listings **in the same rollout** (otherwise the "560+ word pairs" bullet misdescribes the free tier, a Play policy issue, and TV-G3 requires the app to match its listing):

| Replace this bullet | With (EN) | FR | AR |
|---|---|---|---|
| "560+ word pairs across the three languages…" | `• Free starter pack in every language. Premium unlocks every pack (560+ word pairs) and every new one; single packs are also sold.` | `• Un pack de départ gratuit dans chaque langue. Premium débloque tous les packs (plus de 560 paires de mots) et les suivants ; chaque pack est aussi vendu à l’unité.` | `• حزمة بداية مجانية بكل لغة. «بريميوم» يفتح كل الحزم (أكثر من 560 زوجًا من الكلمات) وكل حزمة جديدة، ويمكن شراء كل حزمة وحدها.` |
| "No ads. No accounts. No tracking." | `• No ads. No accounts. No tracking. Only the host's TV can buy; phones never pay.` | `• Pas de pub. Pas de compte. Pas de pistage. Seule la télé de l’hôte peut acheter ; les téléphones ne paient jamais.` | `• بلا إعلانات، بلا حسابات، بلا تتبّع. الشراء فقط من تلفزيون المضيف، والهواتف لا تدفع أبدًا.` |

Also at that point: re-answer the content-rating questionnaire (digital purchases = Yes), update Data safety (DATA-SAFETY.md §1.B), update the privacy policy (§"In-app purchases" block is already drafted in PRIVACY-POLICY.md), and switch the EU trader declaration (RELEASE-CHECKLIST.md step 0.6). Play adds the "In-app purchases" badge automatically. Do **not** write prices in the title/short description (metadata policy).

## 5. A/B testing plan (store listing experiments)

Facts that shape the plan ([Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/6227309)):
- Experiments run on a **published** app only, so start them after production launch (not during the closed test).
- Testable: icon, feature graphic, screenshots, promo video (default graphics experiment) and **short + full description** (localized experiment, up to 5 languages at once). **The app name cannot be A/B tested** with experiments.
- One default graphics experiment **or** up to five localized experiments at the same time.

Order (each run until Play declares a result or ~2–3 weeks; TV traffic is small, so prefer **2 arms** (control + 1 variant) and a 50/50 split to reach significance faster):

| # | Experiment | Arms | Hypothesis |
|---|---|---|---|
| 1 | Localized, EN-US: short description | Control vs Variant A ("Game night on your TV: 3-12 players…") | Concrete numbers + "nothing to install" beat the "Find who's lying!" hook for TV browsers who don't know the genre |
| 2 | Localized, EN-US: short description | Winner of 1 vs Variant B (slogan) | Brand slogan vs benefit line |
| 3 | Default graphics: first TV screenshot / feature graphic | Lobby-with-QR first vs Vote-reveal first (see GRAPHICS-SPEC.md §4) | Showing "scan to join" first removes the "do we need controllers?" objection |
| 4 | FR and AR short description (localized, run together) | Control vs Variant A | Same as 1 in other markets |

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
| Privacy policy URL (App content → Privacy policy) | `{{WEBSITE_URL}}/privacy` | Must be a public, non-geofenced, non-PDF web page. Note: `https://play.mishana.workers.dev/privacy` currently returns the phone app's SPA shell (HTTP 200, not a policy), so do **not** use the Worker URL |
| External marketing | Leave on | Lets Google promote the app outside Play |
| Default language | English (United States) – en-US | Add translations: French (France) – fr-FR, Arabic – ar. Optionally en-GB and fr-CA by copying the same text |

### Store listing graphics per language
Files in `graphics/` (spec and render command: GRAPHICS-SPEC.md). Upload per listing (Play Console → Main store listing → Manage translations → language → "Add own graphics"):
- **en-US**: `icon-512.png`, `feature-1024x500-en.png`, `tv-banner-1280x720-en.png`, `screenshots/tv-0[1-8]-*-en.png`.
- **fr-FR**: same icon, `feature-1024x500-fr.png`, `tv-banner-1280x720-fr.png` (Latin name, same art as EN), `screenshots/tv-0[1-8]-*-fr.png`.
- **ar**: same icon, `feature-1024x500-ar.png`, `tv-banner-1280x720-ar.png`, `screenshots/tv-0[1-8]-*-ar.png` (Arabic-UI captures). Otherwise Arabic users see English graphics.
- `*-placeholder.jpg` screenshots are browser-TV stand-ins: **never upload them** (D4: the real ones come from the native TV app).
