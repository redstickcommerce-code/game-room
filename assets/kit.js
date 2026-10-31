/* Shared helpers for Game Room games: storage, synthesized sounds, callouts, confetti, screen wake lock. */
(function(){
'use strict';

const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sleep = ms => new Promise(r => setTimeout(r, RM ? Math.min(ms, 60) : ms));

function store(prefix){
  return {
    get(k, d){ try{ const v = localStorage.getItem(prefix + ':' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(prefix + ':' + k, JSON.stringify(v)); }catch(e){} }
  };
}

/* Sound: tiny synth, unlocked by the first tap (iOS requires a gesture). */
const prefs = store('gameroom');
const sound = {
  on: prefs.get('sound', true), ctx: null,
  init(){
    if (!this.ctx){ try{ this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  toggle(){ this.on = !this.on; prefs.set('sound', this.on); if (this.on){ this.init(); this.click(); } return this.on; },
  tone(f, d, type, g, delay){
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0), o = this.ctx.createOscillator(), v = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g || 0.1, t + 0.008);
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.03);
  },
  click(){ this.tone(420, 0.06, 'triangle', 0.07); },
  place(){ this.tone(220, 0.08, 'sine', 0.1); this.tone(660, 0.05, 'triangle', 0.05); },
  capture(){ this.tone(523, 0.12, 'triangle', 0.09); this.tone(392, 0.18, 'triangle', 0.09, 0.08); },
  good(){ this.tone(523, 0.12, 'sine', 0.09); this.tone(659, 0.12, 'sine', 0.09, 0.09); this.tone(784, 0.2, 'sine', 0.09, 0.18); },
  dice(){ for (let i = 0; i < 5; i++) this.tone(180 + Math.random() * 260, 0.04, 'square', 0.03, i * 0.05); },
  bad(){ this.tone(330, 0.25, 'sine', 0.09); this.tone(247, 0.4, 'sine', 0.09, 0.18); },
  win(){ [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.09, i * 0.13)); }
};
document.addEventListener('pointerdown', () => sound.init(), {passive: true});
document.addEventListener('keydown', () => sound.init());

/* Wire a button to the shared sound preference. */
function soundButton(btn){
  btn.classList.add('snd');
  const sync = () => { btn.textContent = '♪'; btn.classList.toggle('off', !sound.on); btn.setAttribute('aria-pressed', String(sound.on)); btn.setAttribute('aria-label', sound.on ? 'Sound on' : 'Sound off'); };
  btn.addEventListener('click', () => { sound.toggle(); sync(); });
  sync();
}

let calloutEl = null, calloutT = 0;
function callout(text){
  if (!calloutEl){ calloutEl = document.createElement('div'); calloutEl.className = 'callout'; calloutEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(calloutEl); }
  calloutEl.textContent = text;
  calloutEl.classList.remove('show'); void calloutEl.offsetWidth; calloutEl.classList.add('show');
  clearTimeout(calloutT); calloutT = setTimeout(() => calloutEl.classList.remove('show'), 1400);
}

/* Confetti burst for wins. */
let partyId = 0, canvas = null;
function stopConfetti(){ partyId++; if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
function confetti(colors){
  if (RM) return;
  if (!canvas){ canvas = document.createElement('canvas'); canvas.id = 'confetti'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas); }
  const id = ++partyId, ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = colors || ['#ffd23f', '#ff4f8b', '#22c3c3', '#ffffff', '#a6e22e'];
  const parts = [];
  const burst = (x, y, n, spread) => {
    for (let i = 0; i < n; i++){
      const a = -Math.PI / 2 + (Math.random() - .5) * spread, sp = 9 + Math.random() * 13;
      parts.push({x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 7 + Math.random() * 7, h: 4 + Math.random() * 6,
        r: Math.random() * 6.3, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)], ph: Math.random() * 6.3});
    }
  };
  burst(W * .12, H, 110, 1.1); burst(W * .88, H, 110, 1.1);
  setTimeout(() => { if (id === partyId) burst(W * .5, H * .55, 140, 6.28); }, 450);
  const t0 = performance.now();
  (function frame(now){
    if (id !== partyId) return;
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--){
      const p = parts[i];
      p.vy += .22; p.vx *= .985; p.vy *= .985; if (p.vy > 3.2) p.vy = 3.2;
      p.x += p.vx + Math.sin(t / 300 + p.ph) * .8; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 40){ parts.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(t / 140 + p.ph));
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (parts.length || t < 1000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(t0);
}

/* Keep the screen on during play where the browser allows it. */
async function wake(){ try{ if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); }catch(e){} }
document.addEventListener('visibilitychange', wake);
wake();

/* Segmented control helper: buttons carry data-v; onPick receives the string value. */
function seg(el, get, onPick){
  const sync = () => el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(get()) === b.dataset.v)));
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (b){ onPick(b.dataset.v); sync(); } });
  sync();
  return sync;
}

window.Kit = {RM, sleep, store, sound, soundButton, callout, confetti, stopConfetti, seg};
})();
