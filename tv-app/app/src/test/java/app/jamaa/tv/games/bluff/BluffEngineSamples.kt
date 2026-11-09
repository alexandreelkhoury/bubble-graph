package app.jamaa.tv.games.bluff

/**
 * Engine-built Bluff reveals (TV `public.reveal` + `scores` in REVEAL), produced by the shared engine through lane A's
 * seeded bot (`runBluffBotGame`, shared/src/testing/bots/bluff.ts; players 3..12 × seeds, length short) and filtered
 * for the shapes lane A's fixtures do not cover yet: the final (top answer, likes, house answer, co-authors), quick hits,
 * house lies, a helped lie, co-authored lies, a Spot-on prompt with no vote, "found it early" and a 7+ vote lie.
 * Regenerate with scratchpad bluff-c/dump.ts if the reveal shape changes (BluffScriptTest checks `durationMs`).
 */
object BluffEngineSamples {
    val json: String = (
        """
{"finalTop":{"reveal":{"final":true,"steps":[{"optionId":"2cff9fc2","kind":"house","quick":false,"text":"Zhouse n03 apricot","authorIds":[],"helped":false,"vote
Count":1,"voterIds":[],"likerIds":["p_b1uff01"],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]},{"optionId":"001b1b33","kind":"lie","quick":false,"te
xt":"Clouds purple tiny pickles","authorIds":["p_b1uff00"],"helped":false,"voteCount":2,"voterIds":[],"likerIds":["p_b1uff01"],"foundEarlyIds":[],"spotOnIds":[]
,"top":true,"deltas":[{"playerId":"p_b1uff00","points":300,"reason":"fooled"},{"playerId":"p_b1uff00","points":20,"reason":"like"},{"playerId":"p_b1uff00","poin
ts":400,"reason":"convincing"}]}],"spotOnDeltas":[],"unpicked":[{"optionId":"6f2f5cc1","text":"Grandma sideways","authorIds":["p_b1uff01"],"likerIds":[],"deltas
":[]}],"truth":null,"durationMs":16100},"scores":[{"playerId":"p_b1uff00","score":1140,"scoreBefore":420},{"playerId":"p_b1uff01","score":100,"scoreBefore":100}
,{"playerId":"p_b1uff02","score":390,"scoreBefore":390}],"phase":"REVEAL"},"finalCoAuthors":{"reveal":{"final":true,"steps":[{"optionId":"57e1b318","kind":"lie"
,"quick":false,"text":"Pickles grandma under","authorIds":["p_b1uff04"],"helped":false,"voteCount":2,"voterIds":[],"likerIds":["p_b1uff02"],"foundEarlyIds":[],"
spotOnIds":[],"top":true,"deltas":[{"playerId":"p_b1uff04","points":300,"reason":"fooled"},{"playerId":"p_b1uff04","points":20,"reason":"like"},{"playerId":"p_b
1uff04","points":400,"reason":"convincing"}]},{"optionId":"0c02ff7c","kind":"lie","quick":false,"text":"Tiny grandma","authorIds":["p_b1uff03","p_b1uff02"],"hel
ped":false,"voteCount":2,"voterIds":[],"likerIds":["p_b1uff01"],"foundEarlyIds":[],"spotOnIds":[],"top":true,"deltas":[{"playerId":"p_b1uff03","points":150,"rea
son":"fooled"},{"playerId":"p_b1uff02","points":150,"reason":"fooled"},{"playerId":"p_b1uff03","points":10,"reason":"like"},{"playerId":"p_b1uff02","points":10,
"reason":"like"},{"playerId":"p_b1uff03","points":200,"reason":"convincing"},{"playerId":"p_b1uff02","points":200,"reason":"convincing"}]}],"spotOnDeltas":[],"u
npicked":[{"optionId":"a1659641","text":"Jazz moon","authorIds":["p_b1uff01"],"likerIds":[],"deltas":[]}],"truth":null,"durationMs":16100},"scores":[{"playerId"
:"p_b1uff00","score":280,"scoreBefore":280},{"playerId":"p_b1uff01","score":400,"scoreBefore":400},{"playerId":"p_b1uff02","score":620,"scoreBefore":260},{"play
erId":"p_b1uff03","score":740,"scoreBefore":380},{"playerId":"p_b1uff04","score":1270,"scoreBefore":550},{"playerId":"p_b1uff05","score":170,"scoreBefore":170},
{"playerId":"p_b1uff06","score":10,"scoreBefore":10},{"playerId":"p_b1uff07","score":0,"scoreBefore":0}],"phase":"REVEAL"},"quickHits":{"reveal":{"final":false,
"steps":[{"optionId":"8bef2c10","kind":"lie","quick":true,"text":"Tiny purple bakes","authorIds":["p_b1uff00"],"helped":false,"voteCount":1,"voterIds":["p_b1uff
01"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff00","points":120,"reason":"fooled"}]},{"optionId":"15e89857","kin
d":"lie","quick":true,"text":"Pickles tiny","authorIds":["p_b1uff01"],"helped":false,"voteCount":1,"voterIds":["p_b1uff07"],"likerIds":["p_b1uff03"],"foundEarly
Ids":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff01","points":120,"reason":"fooled"},{"playerId":"p_b1uff01","points":10,"reason":"like"}]},{"op
tionId":"e02ee6c6","kind":"lie","quick":true,"text":"Uncle grandma clouds","authorIds":["p_b1uff03"],"helped":false,"voteCount":1,"voterIds":["p_b1uff06"],"like
rIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff03","points":120,"reason":"fooled"}]},{"optionId":"2d2d152a","kind":"lie","
quick":true,"text":"Tiny forever","authorIds":["p_b1uff02"],"helped":false,"voteCount":1,"voterIds":["p_b1uff04"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[
],"top":false,"deltas":[{"playerId":"p_b1uff02","points":120,"reason":"fooled"}]},{"optionId":"fc012f3c","kind":"lie","quick":true,"text":"Sings moon goat goat"
,"authorIds":["p_b1uff06"],"helped":false,"voteCount":1,"voterIds":["p_b1uff02"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerI
d":"p_b1uff06","points":120,"reason":"fooled"}]},{"optionId":"54e3ebc6","kind":"lie","quick":false,"text":"Goat under moon moon","authorIds":["p_b1uff07"],"help
ed":false,"voteCount":2,"voterIds":["p_b1uff03","p_b1uff05"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff07","poin
ts":240,"reason":"fooled"}]},{"optionId":"c9f2f81f","kind":"truth","quick":false,"text":"Ztruth f08 kumquat","authorIds":[],"helped":false,"voteCount":0,"voterI
ds":[],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]}],"spotOnDeltas":[],"unpicked":[{"optionId":"e8804a44","text":"Uncle bakes foreve
r","authorIds":["p_b1uff05"],"likerIds":[],"deltas":[]},{"optionId":"88a24715","text":"Uncle forever goat","authorIds":["p_b1uff04"],"likerIds":["p_b1uff02"],"d
eltas":[{"playerId":"p_b1uff04","points":10,"reason":"like"}]}],"truth":{"text":"Ztruth f08 kumquat","original":null,"note":"Znote f08 explained"},"durationMs":
19740},"scores":[{"playerId":"p_b1uff00","score":320,"scoreBefore":200},{"playerId":"p_b1uff01","score":210,"scoreBefore":80},{"playerId":"p_b1uff02","score":43
0,"scoreBefore":310},{"playerId":"p_b1uff03","score":340,"scoreBefore":220},{"playerId":"p_b1uff04","score":290,"scoreBefore":280},{"playerId":"p_b1uff05","scor
e":540,"scoreBefore":540},{"playerId":"p_b1uff06","score":120,"scoreBefore":0},{"playerId":"p_b1uff07","score":470,"scoreBefore":230}],"phase":"REVEAL"},"houseL
ie":{"reveal":{"final":false,"steps":[{"optionId":"c5672325","kind":"house","quick":false,"text":"Zhouse s06 bramble","authorIds":[],"helped":false,"voteCount":
2,"voterIds":["p_b1uff00","p_b1uff02"],"likerIds":["p_b1uff00"],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]},{"optionId":"022c60a5","kind":"truth"
,"quick":false,"text":"Ztruth s06 kumquat","authorIds":[],"helped":false,"voteCount":0,"voterIds":[],"likerIds":[],"foundEarlyIds":[],"spotOnIds":["p_b1uff01"],
"top":false,"deltas":[]}],"spotOnDeltas":[{"playerId":"p_b1uff01","points":150}],"unpicked":[{"optionId":"3d8fdc45","text":"Sideways forever","authorIds":["p_b1
uff02"],"likerIds":[],"deltas":[]}],"truth":{"text":"Ztruth s06 kumquat","original":null,"note":"Znote s06 explained"},"durationMs":13740},"scores":[{"playerId"
:"p_b1uff00","score":0,"scoreBefore":0},{"playerId":"p_b1uff01","score":150,"scoreBefore":0},{"playerId":"p_b1uff02","score":0,"scoreBefore":0}],"phase":"REVEAL
"},"helped":{"reveal":{"final":false,"steps":[{"optionId":"b9325d59","kind":"lie","quick":false,"text":"Zhouse s09 bramble","authorIds":["p_b1uff01"],"helped":t
rue,"voteCount":1,"voterIds":["p_b1uff00"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff01","points":20,"reason":"f
ooled"}]},{"optionId":"f469c24d","kind":"house","quick":false,"text":"Zhouse s09 apricot","authorIds":[],"helped":false,"voteCount":1,"voterIds":["p_b1uff02"],"
likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]},{"optionId":"4f27ff96","kind":"lie","quick":false,"text":"Uncle pickles quietly","author
Ids":["p_b1uff00"],"helped":false,"voteCount":1,"voterIds":["p_b1uff01"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1
uff00","points":60,"reason":"fooled"}]},{"optionId":"588af6e8","kind":"truth","quick":false,"text":"Ztruth s09 kumquat","authorIds":[],"helped":false,"voteCount
":0,"voterIds":[],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]}],"spotOnDeltas":[],"unpicked":[{"optionId":"a03407ff","text":"Uncle f
orever clouds under","authorIds":["p_b1uff02"],"likerIds":[],"deltas":[]}],"truth":{"text":"Ztruth s09 kumquat","original":null,"note":"Znote s09 explained"},"d
urationMs":19360},"scores":[{"playerId":"p_b1uff00","score":210,"scoreBefore":150},{"playerId":"p_b1uff01","score":120,"scoreBefore":100},{"playerId":"p_b1uff02
","score":100,"scoreBefore":100}],"phase":"REVEAL"},"coAuthors":{"reveal":{"final":false,"steps":[{"optionId":"592a7676","kind":"lie","quick":false,"text":"Zhou
se f05 cobalt","authorIds":["p_b1uff04"],"helped":true,"voteCount":1,"voterIds":["p_b1uff01"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"delta
s":[{"playerId":"p_b1uff04","points":40,"reason":"fooled"}]},{"optionId":"d188fdc6","kind":"lie","quick":false,"text":"Bakes purple purple","authorIds":["p_b1uf
f09"],"helped":false,"voteCount":1,"voterIds":["p_b1uff02"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff09","point
s":120,"reason":"fooled"}]},{"optionId":"b02d863f","kind":"lie","quick":false,"text":"Sideways quietly","authorIds":["p_b1uff06"],"helped":false,"voteCount":1,"
voterIds":["p_b1uff03"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff06","points":120,"reason":"fooled"}]},{"option
Id":"4e94a5a5","kind":"lie","quick":false,"text":"Purple grandma pickles","authorIds":["p_b1uff08"],"helped":false,"voteCount":3,"voterIds":["p_b1uff00","p_b1uf
f04","p_b1uff07"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff08","points":360,"reason":"fooled"}]},{"optionId":"a
a5e9092","kind":"lie","quick":false,"text":"Moon bakes","authorIds":["p_b1uff00","p_b1uff02"],"helped":false,"voteCount":3,"voterIds":["p_b1uff06","p_b1uff08","
p_b1uff09"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff00","points":180,"reason":"fooled"},{"playerId":"p_b1uff02
","points":180,"reason":"fooled"}]},{"optionId":"a80be472","kind":"truth","quick":false,"text":"Ztruth f05 kumquat","authorIds":[],"helped":false,"voteCount":2,
"voterIds":["p_b1uff05","p_b1uff11"],"likerIds":[],"foundEarlyIds":["p_b1uff11"],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff05","points":200,"reas
on":"truth"}]}],"spotOnDeltas":[],"unpicked":[{"optionId":"ddeb57b6","text":"Jazz pickles","authorIds":["p_b1uff03"],"likerIds":[],"deltas":[]},{"optionId":"ffd
9b827","text":"Zhouse f05 apricot","authorIds":["p_b1uff05"],"likerIds":["p_b1uff11"],"deltas":[{"playerId":"p_b1uff05","points":10,"reason":"like"}]},{"optionI
d":"e40ab438","text":"Forever sideways tiny forever","authorIds":["p_b1uff01"],"likerIds":[],"deltas":[]},{"optionId":"b3025f39","text":"Sideways purple moon ba
kes","authorIds":["p_b1uff07"],"likerIds":[],"deltas":[]},{"optionId":"0366558a","text":"Goat sideways uncle forever","authorIds":["p_b1uff11"],"likerIds":[],"d
eltas":[]}],"truth":{"text":"Ztruth f05 kumquat","original":null,"note":"Znote f05 explained"},"durationMs":28580},"scores":[{"playerId":"p_b1uff00","score":300
,"scoreBefore":120},{"playerId":"p_b1uff01","score":510,"scoreBefore":510},{"playerId":"p_b1uff02","score":390,"scoreBefore":210},{"playerId":"p_b1uff03","score
":340,"scoreBefore":340},{"playerId":"p_b1uff04","score":110,"scoreBefore":70},{"playerId":"p_b1uff05","score":210,"scoreBefore":0},{"playerId":"p_b1uff06","sco
re":240,"scoreBefore":120},{"playerId":"p_b1uff07","score":0,"scoreBefore":0},{"playerId":"p_b1uff08","score":470,"scoreBefore":110},{"playerId":"p_b1uff09","sc
ore":120,"scoreBefore":0},{"playerId":"p_b1uff10","score":60,"scoreBefore":60},{"playerId":"p_b1uff11","score":0,"scoreBefore":0}],"phase":"REVEAL"},"spotOnNoVo
ters":{"reveal":{"final":false,"steps":[{"optionId":"6cb75c85","kind":"truth","quick":false,"text":"Ztruth s09 kumquat","authorIds":[],"helped":false,"voteCount
":0,"voterIds":[],"likerIds":[],"foundEarlyIds":[],"spotOnIds":["p_b1uff00","p_b1uff02"],"top":false,"deltas":[]}],"spotOnDeltas":[{"playerId":"p_b1uff00","poin
ts":150},{"playerId":"p_b1uff02","points":150}],"unpicked":[{"optionId":"9fed1531","text":"Clouds goat forever quietly","authorIds":["p_b1uff03"],"likerIds":[],
"deltas":[]},{"optionId":"c766ffd9","text":"Sideways goat pickles uncle","authorIds":["p_b1uff01"],"likerIds":[],"deltas":[]}],"truth":{"text":"Ztruth s09 kumqu
at","original":null,"note":"Znote s09 explained"},"durationMs":8500},"scores":[{"playerId":"p_b1uff00","score":150,"scoreBefore":0},{"playerId":"p_b1uff01","sco
re":60,"scoreBefore":60},{"playerId":"p_b1uff02","score":210,"scoreBefore":60},{"playerId":"p_b1uff03","score":150,"scoreBefore":150}],"phase":"REVEAL"},"foundE
arly":{"reveal":{"final":false,"steps":[{"optionId":"d2871c03","kind":"lie","quick":false,"text":"Pickles clouds tiny bakes","authorIds":["p_b1uff01"],"helped":
false,"voteCount":2,"voterIds":["p_b1uff00","p_b1uff02"],"likerIds":[],"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[{"playerId":"p_b1uff01","points":
240,"reason":"fooled"}]},{"optionId":"8e6927d2","kind":"truth","quick":false,"text":"Ztruth f11 kumquat","authorIds":[],"helped":false,"voteCount":1,"voterIds":
["p_b1uff01"],"likerIds":["p_b1uff01"],"foundEarlyIds":["p_b1uff01"],"spotOnIds":[],"top":false,"deltas":[]}],"spotOnDeltas":[],"unpicked":[{"optionId":"1fbe271
4","text":"Sings tiny purple sings","authorIds":["p_b1uff00"],"likerIds":[],"deltas":[]},{"optionId":"df8b6c79","text":"Quietly purple moon sideways","authorIds
":["p_b1uff02"],"likerIds":[],"deltas":[]}],"truth":{"text":"Ztruth f11 kumquat","original":null,"note":"Znote f11 explained"},"durationMs":13740},"scores":[{"p
layerId":"p_b1uff00","score":70,"scoreBefore":70},{"playerId":"p_b1uff01","score":360,"scoreBefore":120},{"playerId":"p_b1uff02","score":270,"scoreBefore":270}]
,"phase":"REVEAL"},"bigVote":{"reveal":{"final":false,"steps":[{"optionId":"658e317a","kind":"house","quick":false,"text":"Zhouse s01 apricot","authorIds":[],"h
elped":false,"voteCount":8,"voterIds":["p_b1uff00","p_b1uff02","p_b1uff03","p_b1uff05","p_b1uff06","p_b1uff07","p_b1uff08","p_b1uff11"],"likerIds":["p_b1uff06"]
,"foundEarlyIds":[],"spotOnIds":[],"top":false,"deltas":[]},{"optionId":"fabe0fe4","kind":"truth","quick":false,"text":"Ztruth s01 kumquat","authorIds":[],"help
ed":false,"voteCount":3,"voterIds":["p_b1uff04","p_b1uff09","p_b1uff10"],"likerIds":["p_b1uff03","p_b1uff04","p_b1uff10"],"foundEarlyIds":[],"spotOnIds":[],"top
":false,"deltas":[{"playerId":"p_b1uff04","points":100,"reason":"truth"},{"playerId":"p_b1uff09","points":100,"reason":"truth"},{"playerId":"p_b1uff10","points"
:100,"reason":"truth"}]}],"spotOnDeltas":[],"unpicked":[],"truth":{"text":"Ztruth s01 kumquat","original":null,"note":"Znote s01 explained"},"durationMs":11960}
,"scores":[{"playerId":"p_b1uff00","score":0,"scoreBefore":0},{"playerId":"p_b1uff01","score":0,"scoreBefore":0},{"playerId":"p_b1uff02","score":0,"scoreBefore"
:0},{"playerId":"p_b1uff03","score":0,"scoreBefore":0},{"playerId":"p_b1uff04","score":100,"scoreBefore":0},{"playerId":"p_b1uff05","score":0,"scoreBefore":0},{
"playerId":"p_b1uff06","score":0,"scoreBefore":0},{"playerId":"p_b1uff07","score":0,"scoreBefore":0},{"playerId":"p_b1uff08","score":0,"scoreBefore":0},{"player
Id":"p_b1uff09","score":100,"scoreBefore":0},{"playerId":"p_b1uff10","score":100,"scoreBefore":0},{"playerId":"p_b1uff11","score":0,"scoreBefore":0}],"phase":"R
EVEAL"}}
"""
        ).replace("\n", "")
}
