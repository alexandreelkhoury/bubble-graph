# Arabic native check — design v3 (Lebanese colloquial, gender-neutral, DESIGN.md §1.5)

Please mark each line OK or write the correction. Product strings are live now on play.mishana.workers.dev.

## 1. Game (phone + TV) — 43 new/changed strings (`shared/i18n/ar.json`)

| Key | English | Arabic |
|---|---|---|
| `winner.moles.zero` |  | ربحوا الجواسيس! |
| `winner.moles.one` | The Mole wins! | ربح الجاسوس! |
| `winner.moles.two` |  | ربحوا الجاسوسين! |
| `winner.moles.few` |  | ربحوا الجواسيس! |
| `winner.moles.many` |  | ربحوا الجواسيس! |
| `winner.moles.other` | The Moles win! | ربحوا الجواسيس! |
| `winner.molesBlank.zero` |  | ربحوا الجواسيس والفاضي! |
| `winner.molesBlank.one` | The Mole & the Blank win! | ربحوا الجاسوس والفاضي! |
| `winner.molesBlank.two` |  | ربحوا الجاسوسين والفاضي! |
| `winner.molesBlank.few` |  | ربحوا الجواسيس والفاضي! |
| `winner.molesBlank.many` |  | ربحوا الجواسيس والفاضي! |
| `winner.molesBlank.other` | The Moles & the Blank win! | ربحوا الجواسيس والفاضي! |
| `winner.molesBlanks.zero` |  | ربحوا الجواسيس والفاضيين! |
| `winner.molesBlanks.one` | The Mole & the Blanks win! | ربحوا الجاسوس والفاضيين! |
| `winner.molesBlanks.two` |  | ربحوا الجاسوسين والفاضيين! |
| `winner.molesBlanks.few` |  | ربحوا الجواسيس والفاضيين! |
| `winner.molesBlanks.many` |  | ربحوا الجواسيس والفاضيين! |
| `winner.molesBlanks.other` | The Moles & the Blanks win! | ربحوا الجواسيس والفاضيين! |
| `howto.title` | How to play | كيف منلعب؟ |
| `howto.step1` | Everyone gets a secret word, except… | كل حدا بياخد كلمة سرّية، إلا… |
| `howto.step2` | Give one clue each, out loud. | كل حدا بيعطي تلميح، بصوت عالي. |
| `howto.step3` | Vote out the odd one. | منصوّت لنطلّع يلّي مش منّا. |
| `howto.step4` | The Blank gets one last guess. | الفاضي إلو محاولة أخيرة. |
| `home.hostHint` | No code? Host the game on a TV or laptop: | ما في كود؟ اللعبة بتنفتح على تلفزيون أو لابتوب: |
| `reveal.twist` | Most of you have this word. Not everyone. Maybe not you. | الأغلبية معها هالكلمة. مش الكل. ويمكن مش انت. |
| `clues.speaking` | {name}, your clue! | يلّا {name}، تلميحك! |
| `tie.yourTurn` | You're in the tie. Make this clue count! | انت بالتعادل: هالتلميح لازم يفرق! |
| `vote.pickFirst` | Pick one first | نقّي حدا أوّل |
| `vote.revoteBetween` | Re-vote: {names}. Another tie? {outcome}. | تصويت تاني: {names}. تعادل كمان؟ {outcome}. |
| `tie.persist` | {names} are tied. One more clue each, then a re-vote. | تعادل بين {names}. تلميح كمان لكل واحد، وبعدين تصويت تاني. |
| `elim.nextIn` | Next in {count} | الجاية بعد {count} |
| `guess.sayAloud` | {name}: type it, then say it out loud! | {name}: الجواب عالتلفون، وبعدين بصوت عالي! |
| `guess.stakes` | Get it right and you win the game. | الجواب الصح بيربّحك اللعبة. |
| `guess.accept` | Count it: Blank wins | منقبلها: الفاضي بيربح |
| `conn.phonesAsleepTimer` | Everyone's phone is asleep? Wake them up, or the timer decides. | التلفونات نايمة؟ فيّقوها، وإلا الوقت بيقرّر. |
| `tv.pressAgainWeb` | Enter or click again to confirm | Enter أو كليك كمان مرّة للتأكيد |
| `tv.skipHintWeb` | Enter or click to skip | Enter أو كليك للتخطّي |
| `tv.browserTip` | F = full screen · arrows + Enter, or click | F = شاشة كاملة · الأسهم + Enter، أو كليك |
| `tv.pauseNote` | Timers keep running | الوقت ماشي |
| `tv.resume` | Back to game | رجوع للعبة |
| `tv.closeRoomConfirm` | Close this room? | نسكّر هالغرفة؟ |
| `tv.closeRoomBody` | Everyone will need a new code. | الكل رح يحتاج كود جديد. |
| `tv.keepRoom` | Keep room | منخلّي الغرفة |

## 2. Landing page (`growth/site/assets/js/i18n.js`, `content/prelaunch.json`, `privacy/`)
| Where | Arabic | Meaning |
|---|---|---|
| Hero video captions | تلفزيونك. تلفون كل واحد. وكذّاب واحد. / الرفقات بيفوتوا من تلفوناتن. بلا تطبيق. / كل واحد بتوصلو كلمة سرّية… / …بس وحدة غير شكل. / كل واحد بيعطي تلميح. / مين كلامو غريب؟ / صوّتوا وطلّعوه. / مسكنا الجاسوس! / سامي كان الجاسوس | the 9 film captions |
| Hero | كلّنا أبرياء… بس في حدا عم يكذب. · لعبة سهرات عالتلفزيون · ببلاش · كلمة سرّية على كل تلفون، وحدة منهن مختلفة… · في كلمة مختلفة | headline, kicker, sub, tag |
| Chips | بلا تطبيق عالتلفون · بلا تسجيل | no app on phones · no sign-up |
| Buttons | العبوا عالشاشة الكبيرة · ابعت الرابط للّابتوب أو التلفزيون · ببلاش · ابعتها للتلفزيون · ببلاش · بتنلعب عالتلفزيون | main CTA, sub, sticky bar |
| Send sheet | العبوها عالشاشة الكبيرة · عاللابتوب أو بمتصفّح التلفزيون، اكتب: · اكبس لتنسخ · ابعتلي ياه عالواتساب · غير طرق… · بعدين امسح كود QR اللي عالشاشة بهالتلفون. · بس عم تتفرّج؟ افتحها هون | phone→TV sheet |
| Hints | في تلفزيون أو لابتوب حدّك؟… · حطّ هالشاشة عالتلفزيون… (Chrome: بثّ › بثّ علامة التبويب — check Chrome's real Arabic menu names) | |
| Try-it | عطيني كرت الجاسوس · عطيني كرت الفاضي | deal me the Mole / Blank card |
| Strip | شو بدّكن الليلة (+ its 3 lines) · شوفوا جولة بـ15 ثانية | what you need tonight |
| FAQ | لازم يكون عنّا تلفزيون ذكي؟ (+ answer) | do we need a smart TV? |
| Labels | الرئيسية – مش أنا! · باختصار · روابط | screen-reader labels |
| Also | new About text, SEO title/description, share-image text and alt, **the whole Arabic privacy policy** (`/privacy/?lang=ar`) | longer texts: read on the page |

## 3. Play Store (`growth/marketing/play-store/`)
| Where | Arabic |
|---|---|
| Feature graphic | في حدا عم يكذب. · لعبة الكلمة السرّية للسهرات عالتلفزيون · بيتزا / باستا |
| Screenshot headlines | كل واحد إلو كلمة سرّية… وحدة مختلفة. · امسحوا الكود… وتلفونك هو الجويستيك. · كلمتك بتضلّ عتلفونك. · تلميح لكل واحد… مين كلامو غريب؟ · صوّتوا من عالكنبة. · انكشف؟ الفاضي إلو فرصة أخيرة. · العبوا كمان مرّة… والنقاط محفوظة. |
| Listing, first lines | كل لاعب بتوصلو كلمة سرّية على تلفونو، وفي لاعب كلمتو مختلفة. تلميح لكل واحد، تصويت، واكشفوا الكذّاب على الشاشة الكبيرة. · نزّلوها عالتلفزيون، والأصحاب بيفوتوا بمسح كود QR: ما في شي ينزّلوه عالتلفونات، آيفون أو أندرويد. · من 3 لـ12 لاعب · عربي وإنجليزي وفرنسي · بلا إعلانات وبلا حسابات. · عم تشوفها عالتلفون؟ اكبس عالسهم حدّ «تثبيت» واختار التلفزيون. |

## 4. Videos (`growth/video/`)
| Where | Arabic |
|---|---|
| End card | العبوا ببلاش عالتلفزيون · افتحوها عاللابتوب أو متصفّح التلفزيون: |
| M6 family ad | سهرة العيلة؟ / 12 واحد؟ · أحسن! كلّنا منلعب. · كلّن معن تبولة… · إلّا خالو… وما بيعرف. · كل واحد كلمة. · خبز؟ بالتبولة؟! · مين مش منّا؟ · برّا · خالو: الجاسوس · سهرة العيلة / رح تولّع. · clues: بقدونس · حامض · برغل · خبز؟ — also: "12" or "١٢"? |
