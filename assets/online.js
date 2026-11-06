/* Online play for Game Room games over Supabase Realtime (broadcast + presence, no database tables).
   The host's browser runs the game; guests send actions and receive the state. Each game supplies the rules.

   Online.host({game, code?, on:{msg, join, leave, ready}})  -> room
   Online.join({game, code, on:{msg, hostGone, hostBack, ready, fail}}) -> room
   room.send(msg) broadcasts to everyone else; msg.to (a client id) addresses one player.
   room.code, room.link, room.me (this browser's client id), room.close() */
(function(){
'use strict';

const SUPABASE_URL = 'https://uauzyiykakkijkqrwptn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DaoyII_ShU0CxykLmqVY3g_khsYcBxU';   // public publishable key, safe in the page
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L

const prefs = Kit.store('gameroom');
let me = prefs.get('cid', null);
if (!me){ me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); prefs.set('cid', me); }

let client = null, loading = null;
function lib(){
  if (client) return Promise.resolve(client);
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = LIB; s.async = true;
    s.onload = () => { try{ client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); res(client); }catch(e){ rej(e); } };
    s.onerror = () => { loading = null; rej(new Error('Could not load the online library. Check your connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

const newCode = () => Array.from({length: 5}, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
function linkFor(code){
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('room', code);
  return u.toString();
}

/* role: 'host' | 'guest'. Handlers get (msg, fromClientId). */
async function open(role, game, code, on){
  const sb = await lib();
  const ch = sb.channel(`gameroom:${game}:${code}`, {config: {broadcast: {self: false}, presence: {key: me}}});
  const room = {
    code, me, role, link: linkFor(code), present: new Set(), closed: false,
    send(msg){ if (!this.closed) ch.send({type: 'broadcast', event: 'm', payload: Object.assign({from: me}, msg)}); },
    close(){ this.ended = true; removeEventListener('pagehide', bye); shut(); }
  };
  /* Leave the room as soon as the page goes away, so the others see it straight away instead of after a
     server timeout. If the browser later restores the page from its back/forward cache, reload to rejoin. */
  const shut = () => { if (room.closed) return; room.closed = true; try{ ch.untrack(); sb.removeChannel(ch); }catch(e){} };
  const bye = () => { shut(); try{ sb.realtime.disconnect(); }catch(e){} };
  addEventListener('pagehide', bye);
  addEventListener('pageshow', e => { if (e.persisted && room.closed && !room.ended) location.reload(); });
  let hostSeen = false, hostHere = false;
  ch.on('broadcast', {event: 'm'}, ({payload}) => {
    if (!payload || payload.from === me || (payload.to && payload.to !== me)) return;
    on.msg && on.msg(payload, payload.from);
  });
  ch.on('presence', {event: 'sync'}, () => {
    const st = ch.presenceState(), now = new Set(Object.keys(st)), was = room.present;
    room.present = now;
    for (const id of now) if (!was.has(id) && id !== me) on.join && on.join(id);
    for (const id of was) if (!now.has(id)) on.leave && on.leave(id);
    if (role === 'guest'){
      const h = Object.values(st).some(list => list.some(p => p.role === 'host'));
      if (h && !hostHere){ hostHere = true; if (hostSeen) on.hostBack && on.hostBack(); hostSeen = true; }
      else if (!h && hostHere){ hostHere = false; on.hostGone && on.hostGone(); }
    }
  });
  return new Promise((res, rej) => {
    let done = false;
    const t = setTimeout(() => { if (!done){ done = true; room.close(); rej(new Error('Could not reach the game server.')); } }, 12000);
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED'){
        await ch.track({role, at: Date.now()});
        if (!done){ done = true; clearTimeout(t); res(room); on.ready && on.ready(room); }
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !done){
        done = true; clearTimeout(t); room.close(); rej(new Error('Could not reach the game server.'));
      }
    });
  });
}

window.Online = {
  me, newCode, cleanCode, linkFor,
  host: ({game, code, on}) => open('host', game, code || newCode(), on || {}),
  join: ({game, code, on}) => open('guest', game, cleanCode(code), on || {}),
  /* ?room=CODE in the page URL, if any */
  codeFromUrl(){ return cleanCode(new URLSearchParams(location.search).get('room')); },
  clearUrl(){ if (location.search){ history.replaceState(null, '', location.pathname); } },
  async share(link, title){
    if (navigator.share){ try{ await navigator.share({title, url: link}); return 'shared'; }catch(e){ if (e && e.name === 'AbortError') return 'cancelled'; } }
    try{ await navigator.clipboard.writeText(link); return 'copied'; }catch(e){ return 'failed'; }
  }
};
})();
