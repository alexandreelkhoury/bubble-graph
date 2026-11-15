// JAMAA-PLATFORM §7.5: the owner's monitoring page, GET /admin (+ /admin/app.js), served by the Worker (never part of
// the phone bundle). Plain HTML + JS. The page itself holds no data: it asks for ADMIN_TOKEN once, keeps it in
// sessionStorage (never in the URL), and reads GET /api/admin/overview with `Authorization: Bearer`. 404 while
// ADMIN_TOKEN is unset or too short, like the API. Strict CSP: same-origin script only, no inline script.
import { adminToken } from "../admin";
import type { Env } from "../env";
import { notFound } from "../request";

export const ADMIN_PAGE_PATH = "/admin";
export const ADMIN_SCRIPT_PATH = "/admin/app.js";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>JAMAA monitor</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1b18;--mute:#6b665e;--line:#e4e0d8;--accent:#5b3fd6;--bad:#b3261e;--badbg:#fdecea;--ok:#1e7a46;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--card:#1f1d1a;--ink:#f1eee8;--mute:#a59f95;--line:#34312c;--accent:#a996ff;--bad:#ff8a80;--badbg:#3a1d1b;--ok:#6fdc9c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:16px}
header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 8px;color:var(--mute);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.muted{color:var(--mute);font-size:13px}
button,input{font:inherit;border-radius:8px;border:1px solid var(--line);padding:8px 12px;background:var(--card);color:var(--ink)}
button{cursor:pointer}button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums;line-height:1.2}
.banner{border-radius:12px;padding:12px 14px;margin-bottom:12px;background:var(--badbg);color:var(--bad);border:1px solid var(--bad)}
.banner.info{background:var(--card);color:var(--ink);border-color:var(--line)}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line);font-size:14px}th{color:var(--mute);font-weight:600}
.bars{display:flex;align-items:flex-end;gap:2px;height:80px}.bars span{flex:1;background:var(--accent);min-height:1px;border-radius:2px 2px 0 0;opacity:.85}
.err{border-bottom:1px solid var(--line);padding:8px 0}.err:last-child{border:0}
.err .t{font-weight:600;word-break:break-word}.err pre{white-space:pre-wrap;word-break:break-all;font-size:12px;margin:6px 0 0;color:var(--mute)}
.pill{display:inline-block;font-size:12px;padding:1px 8px;border-radius:99px;border:1px solid var(--line);margin-right:6px}
.pill.server{color:var(--bad);border-color:var(--bad)}
.meter{height:10px;border-radius:99px;background:var(--line);overflow:hidden}.meter i{display:block;height:100%;background:var(--ok)}
.meter.hot i{background:var(--bad)}
form{display:flex;gap:8px;flex-wrap:wrap}form input{flex:1;min-width:200px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:720px){.cols{grid-template-columns:1fr}}
[hidden]{display:none!important}
</style></head>
<body><main>
<header><h1>JAMAA monitor</h1><div><span id="updated" class="muted"></span> <button id="logout" hidden>Sign out</button></div></header>
<section id="login" class="card" hidden><h2>Admin token</h2>
<form id="loginForm"><input id="token" type="password" autocomplete="current-password" placeholder="ADMIN_TOKEN" aria-label="Admin token"><button class="primary">Open</button></form>
<p class="muted">Kept in this tab only (sessionStorage), sent as an Authorization header. Never put it in a URL.</p><p id="loginError" class="muted"></p></section>
<section id="app" hidden>
<div id="banners"></div>
<div class="tiles" id="tiles"></div>
<div class="cols">
<div class="card"><h2>Today by game (UTC)</h2><table><thead><tr><th>Game</th><th>Started</th><th>Finished</th><th>Live</th></tr></thead><tbody id="games"></tbody></table>
<p class="muted" id="ended"></p></div>
<div class="card"><h2>Estimated free-plan use today</h2><div id="quota"></div>
<h2 style="margin-top:14px">Rooms created, last 24 h</h2><div class="bars" id="bars" aria-label="Rooms created per hour"></div><p class="muted" id="barsNote"></p></div>
</div>
<div class="card"><h2>Recent errors</h2><div id="errors"></div></div>
<p class="muted">Counts come from the Stats Durable Object (live rooms and games expire after a TTL if a room crashed). Detailed history: Workers Analytics Engine dataset <code>jamaa_events</code> and Workers Logs.</p>
</section>
</main><script src="/admin/app.js"></script></body></html>
`;

const JS = `"use strict";
(function(){
var KEY="jamaa-admin-token",timer=null;
function $(id){return document.getElementById(id)}
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e}
function getTok(){try{return sessionStorage.getItem(KEY)}catch(e){return null}}
function setTok(t){try{t?sessionStorage.setItem(KEY,t):sessionStorage.removeItem(KEY)}catch(e){}}
function fmt(n){return (n||0).toLocaleString()}
function ago(t){var s=Math.max(0,Math.round((Date.now()-t)/1000));if(s<60)return s+" s ago";if(s<3600)return Math.round(s/60)+" min ago";if(s<86400)return Math.round(s/3600)+" h ago";return new Date(t).toISOString().slice(0,16).replace("T"," ")+" UTC"}
function showLogin(msg){$("app").hidden=true;$("logout").hidden=true;$("login").hidden=false;$("loginError").textContent=msg||"";if(timer){clearInterval(timer);timer=null}}
function load(){
  var t=getTok();if(!t)return showLogin();
  fetch("/api/admin/overview",{headers:{Authorization:"Bearer "+t},cache:"no-store"}).then(function(r){
    if(r.status===401){setTok(null);return showLogin("That token was refused.")}
    if(r.status===429){$("updated").textContent="Rate limited, retrying";return}
    if(!r.ok){$("updated").textContent="Error "+r.status;return}
    return r.json().then(render);
  }).catch(function(){$("updated").textContent="Offline, retrying"});
}
function tile(label,value,sub){var d=el("div","tile");d.appendChild(el("span","muted",label));d.appendChild(el("b",null,value));if(sub)d.appendChild(el("span","muted",sub));return d}
function render(d){
  $("login").hidden=true;$("app").hidden=false;$("logout").hidden=false;
  $("updated").textContent="Updated "+new Date().toLocaleTimeString();
  var s=d.stats,b=$("banners");b.textContent="";
  (d.alerting.open||[]).forEach(function(a){b.appendChild(el("div","banner","ALERT "+a.rule+": "+fmt(a.value)+" (threshold "+fmt(a.threshold)+"), open since "+ago(a.openedAt)))});
  if(!d.bindings.stats)b.appendChild(el("div","banner info","The STATS Durable Object binding is missing: no live numbers. See docs/DEV.md Monitoring."));
  if(!d.bindings.events)b.appendChild(el("div","banner info","The EVENTS Analytics Engine binding is missing: no event history is recorded."));
  if(!d.alerting.email)b.appendChild(el("div","banner info","Alert email is not set up: alerts are only logged (code ALERT) and shown here."));
  if(!s)return;
  var c=s.today||{},tl=$("tiles");tl.textContent="";
  tl.appendChild(tile("Rooms live",fmt(s.live.rooms)));
  tl.appendChild(tile("Games live",fmt(s.live.games),fmt(s.live.players)+" players"));
  tl.appendChild(tile("Rooms today",fmt(c.rooms_created)));
  tl.appendChild(tile("Games today",fmt(c.games_started),fmt(c["ended:finished"])+" finished"));
  tl.appendChild(tile("Players today",fmt(c.players_joined),"joins reported"));
  tl.appendChild(tile("Client errors",fmt(c.client_errors),fmt((s.lastHour||{}).client_errors)+" last hour"));
  tl.appendChild(tile("Server errors",fmt(c.server_errors),fmt((s.lastHour||{}).server_errors)+" last hour"));
  var ids={};Object.keys(c).forEach(function(k){var m=/^(started|finished):(.+)$/.exec(k);if(m)ids[m[2]]=1});Object.keys(s.live.byGame||{}).forEach(function(k){ids[k]=1});
  var gb=$("games");gb.textContent="";var list=Object.keys(ids).sort();
  if(!list.length){var tr=el("tr");var td=el("td","muted","No games yet today");td.colSpan=4;tr.appendChild(td);gb.appendChild(tr)}
  list.forEach(function(g){var tr=el("tr");[g,fmt(c["started:"+g]),fmt(c["finished:"+g]),fmt((s.live.byGame||{})[g])].forEach(function(v){tr.appendChild(el("td",null,v))});gb.appendChild(tr)});
  $("ended").textContent="Ended today: "+["finished","aborted","abandoned","expired"].map(function(r){return fmt(c["ended:"+r])+" "+r}).join(", ");
  var q=d.quota,pct=Math.min(100,Math.round(q.ratio*100)),qd=$("quota");qd.textContent="";
  var m=el("div","meter"+(q.ratio>=q.alertAt?" hot":""));var i=el("i");i.style.width=pct+"%";m.appendChild(i);qd.appendChild(m);
  qd.appendChild(el("p","muted","About "+fmt(q.estimate)+" of "+fmt(q.limit)+" Worker requests ("+pct+"%). An estimate from these counters; the real number is in the Cloudflare dashboard."));
  var bars=$("bars");bars.textContent="";var mx=1;s.hours.forEach(function(h){mx=Math.max(mx,h.c.rooms_created||0)});
  s.hours.forEach(function(h){var sp=el("span");sp.style.height=Math.round(100*(h.c.rooms_created||0)/mx)+"%";sp.title=new Date(h.hour).toISOString().slice(11,13)+":00 UTC: "+(h.c.rooms_created||0)+" rooms";bars.appendChild(sp)});
  $("barsNote").textContent="Peak "+mx+" rooms in an hour";
  var ed=$("errors");ed.textContent="";
  if(!s.errors.length)ed.appendChild(el("p","muted","No errors recorded."));
  s.errors.slice(0,100).forEach(function(e){var w=el("div","err");var top=el("div");top.appendChild(el("span","pill "+e.kind,e.kind));
    top.appendChild(el("span","t",e.code+(e.message?": "+e.message:"")));w.appendChild(top);
    var meta=[e.platform,e.v&&("v"+e.v),e.screen,e.room&&("room "+e.room),(e.n>1?e.n+"x":null),ago(e.last)].filter(Boolean).join(" · ");
    w.appendChild(el("div","muted",meta));if(e.stack){var det=el("details");det.appendChild(el("summary","muted","stack"));det.appendChild(el("pre",null,e.stack));w.appendChild(det)}
    ed.appendChild(w)});
}
$("loginForm").addEventListener("submit",function(ev){ev.preventDefault();var v=$("token").value.trim();$("token").value="";if(v){setTok(v);start()}});
$("logout").addEventListener("click",function(){setTok(null);showLogin()});
function start(){load();if(!timer)timer=setInterval(function(){if(!document.hidden)load()},30000)}
if(getTok())start();else showLogin();
})();
`;

export function handleAdminPage(req: Request, env: Env): Response {
  if (adminToken(env) === null) return notFound();
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
  const path = new URL(req.url).pathname;
  if (path === ADMIN_SCRIPT_PATH) return new Response(JS, { headers: { ...HEADERS, "Content-Type": "text/javascript; charset=utf-8" } });
  if (path === ADMIN_PAGE_PATH || path === ADMIN_PAGE_PATH + "/") return new Response(HTML, { headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" } });
  return notFound();
}
