/* audio.js — sintetizador de violão (Karplus-Strong estendido) + player sincronizado.
 * Duas vozes: "nylon" (corda de náilon, timbre quente e curto) e "aco" (corda de aço, brilhante e longo).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuitarAudio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VOICES = {
    nylon: { t60ref: 1.9, gamma: 0.55, t60min: 0.55, t60max: 4.2, S: 0.5, exFc: 2300, beta: 0.16, pre: 0.0, gain: 0.95, click: 0.0 },
    aco: { t60ref: 3.4, gamma: 0.5, t60min: 1.0, t60max: 6.5, S: 0.3, exFc: 7500, beta: 0.12, pre: 0.0, gain: 0.8, click: 0.18 }
  };

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // PRNG determinístico para reproduzir sempre o mesmo timbre por nota
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1; };
  }

  function renderPluck(sr, midi, voice, vel) {
    var p = VOICES[voice] || VOICES.nylon;
    var f = mtof(midi);
    var t60 = Math.max(p.t60min, Math.min(p.t60max, p.t60ref * Math.pow(220 / f, p.gamma)));
    var dur = Math.min(t60 * 1.05 + 0.25, p.t60max + 0.5);
    var n = Math.floor(sr * dur);
    var out = new Float32Array(n);
    var S = p.S;
    var D = sr / f - S;
    var N = Math.floor(D - 0.5);
    if (N < 2) N = 2;
    var frac = D - N;
    var a = (1 - frac) / (1 + frac);
    var rho = Math.pow(10, -3 / (f * t60));
    var rnd = rng(midi * 7919 + (voice === 'aco' ? 13 : 3));
    var buf = new Float32Array(N);
    var i;
    for (i = 0; i < N; i++) buf[i] = rnd();
    // filtro passa-baixa da excitação (mais forte no náilon)
    var k = Math.exp(-2 * Math.PI * p.exFc / sr);
    var y1 = 0;
    for (var pass = 0; pass < 2; pass++) {
      y1 = 0;
      for (i = 0; i < N; i++) { y1 = (1 - k) * buf[i] + k * y1; buf[i] = y1; }
    }
    // posição da palheta (comb)
    var kk = Math.max(1, Math.round(p.beta * N));
    var tmp = new Float32Array(N);
    for (i = 0; i < N; i++) tmp[i] = buf[i] - buf[(i - kk + N) % N];
    var mean = 0, mx = 0;
    for (i = 0; i < N; i++) mean += tmp[i];
    mean /= N;
    for (i = 0; i < N; i++) { tmp[i] -= mean; if (Math.abs(tmp[i]) > mx) mx = Math.abs(tmp[i]); }
    for (i = 0; i < N; i++) buf[i] = tmp[i] / (mx || 1);

    var ptr = 0, x1 = 0, ap1 = 0, zprev = 0;
    var att = Math.floor(sr * 0.0015);
    for (i = 0; i < n; i++) {
      var x = buf[ptr];
      var y = rho * ((1 - S) * x + S * x1);
      x1 = x;
      var z = a * y + ap1 - a * zprev;
      ap1 = y; zprev = z;
      buf[ptr] = z;
      ptr++; if (ptr >= N) ptr = 0;
      out[i] = x;
    }
    // envelope de ataque e fade-out
    for (i = 0; i < att; i++) out[i] *= i / att;
    var fade = Math.floor(sr * 0.08);
    for (i = 0; i < fade && i < n; i++) out[n - 1 - i] *= i / fade;
    // clique de unha (aço) — ruído curtíssimo filtrado
    if (p.click > 0) {
      var r2 = rng(midi * 31 + 5), c1 = 0, cl = Math.floor(sr * 0.012);
      for (i = 0; i < cl && i < n; i++) { c1 = 0.55 * c1 + 0.45 * r2(); out[i] += p.click * c1 * Math.pow(1 - i / cl, 2); }
    }
    // normaliza (RMS dos primeiros 200ms)
    var w = Math.min(n, Math.floor(sr * 0.2)), e = 0;
    for (i = 0; i < w; i++) e += out[i] * out[i];
    var rms = Math.sqrt(e / w) || 1;
    var g = (0.2 / rms) * p.gain;
    // graves um pouco mais baixos para não dominar
    if (f < 120) g *= 0.9;
    var pk = 0;
    for (i = 0; i < n; i++) { var av = Math.abs(out[i] * g); if (av > pk) pk = av; }
    if (pk > 0.85) g *= 0.85 / pk;
    for (i = 0; i < n; i++) out[i] *= g;
    return out;
  }

  function makeImpulse(ctx, secs, decay) {
    var sr = ctx.sampleRate, len = Math.floor(sr * secs);
    var ir = ctx.createBuffer(2, len, sr);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c), r = rng(1234 + c * 77), lp = 0;
      for (var i = 0; i < len; i++) {
        lp = 0.6 * lp + 0.4 * r();
        d[i] = lp * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return ir;
  }

  /* ------------------------------------------------------------------ */
  function Synth() {
    this.ctx = null; this.voice = 'nylon'; this.cache = {}; this.strings = {};
  }
  Synth.prototype.init = function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    var ctx = this.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9;
    this.f1 = ctx.createBiquadFilter(); this.f1.type = 'peaking';
    this.f2 = ctx.createBiquadFilter(); this.f2.type = 'peaking';
    this.f3 = ctx.createBiquadFilter(); this.f3.type = 'highshelf';
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 18; this.comp.ratio.value = 3; this.comp.attack.value = 0.005; this.comp.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.rev = ctx.createConvolver(); this.rev.buffer = makeImpulse(ctx, 1.4, 2.6);
    this.wet = ctx.createGain(); this.dry = ctx.createGain();
    this.bus.connect(this.f1); this.f1.connect(this.f2); this.f2.connect(this.f3); this.f3.connect(this.comp);
    this.comp.connect(this.dry); this.comp.connect(this.rev); this.rev.connect(this.wet);
    this.dry.connect(this.master); this.wet.connect(this.master); this.master.connect(ctx.destination);
    this.setVoice(this.voice);
  };
  Synth.prototype.setVoice = function (v) {
    this.voice = v;
    if (!this.ctx) return;
    if (v === 'aco') {
      this.f1.frequency.value = 110; this.f1.gain.value = 3.5; this.f1.Q.value = 1.1;
      this.f2.frequency.value = 2600; this.f2.gain.value = 2.5; this.f2.Q.value = 0.9;
      this.f3.frequency.value = 6000; this.f3.gain.value = 1.5;
      this.wet.gain.value = 0.16; this.dry.gain.value = 0.95;
    } else {
      this.f1.frequency.value = 95; this.f1.gain.value = 3.5; this.f1.Q.value = 1.2;
      this.f2.frequency.value = 210; this.f2.gain.value = 2.0; this.f2.Q.value = 1.0;
      this.f3.frequency.value = 4500; this.f3.gain.value = -3.5;
      this.wet.gain.value = 0.2; this.dry.gain.value = 0.95;
    }
  };
  Synth.prototype.buffer = function (midi) {
    var key = this.voice + midi;
    var b = this.cache[key];
    if (b) return b;
    var data = renderPluck(this.ctx.sampleRate, midi, this.voice, 1);
    b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    b.copyToChannel(data, 0);
    this.cache[key] = b;
    return b;
  };
  Synth.prototype.prepare = function (midis) {
    var seen = {};
    for (var i = 0; i < midis.length; i++) if (!seen[midis[i]]) { seen[midis[i]] = 1; this.buffer(midis[i]); }
  };
  // toca uma nota. string = id da corda p/ abafar a anterior
  Synth.prototype.pluck = function (midi, when, vel, string) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    var g = ctx.createGain();
    g.gain.value = Math.max(0.05, Math.min(1.2, vel));
    src.connect(g); g.connect(this.bus);
    var prev = this.strings[string];
    if (prev && prev.stopAt > when) {
      try {
        prev.g.gain.cancelScheduledValues(Math.max(ctx.currentTime, when - 0.02));
        prev.g.gain.setTargetAtTime(0.0001, Math.max(ctx.currentTime, when), 0.018);
        prev.src.stop(when + 0.12);
      } catch (e) {}
    }
    src.start(when);
    var rec = { src: src, g: g, stopAt: when + src.buffer.duration };
    this.strings[string] = rec;
    var self = this;
    src.onended = function () { try { g.disconnect(); } catch (e) {} if (self.strings[string] === rec) delete self.strings[string]; };
    return rec;
  };
  Synth.prototype.stopAll = function () {
    var ctx = this.ctx; if (!ctx) return;
    for (var k in this.strings) {
      var r = this.strings[k];
      try { r.g.gain.cancelScheduledValues(ctx.currentTime); r.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); r.src.stop(ctx.currentTime + 0.2); } catch (e) {}
    }
    this.strings = {};
  };

  /* ------------------------------------------------------------------ */
  /* Sequência de execução (repetições, estrofes) e linha do tempo */
  function buildSequence(h, verseMode) {
    var ms = h.ms, n = ms.length, V = h.V || 1, seq = [], i;
    var F = 0, Bk = -1, aStart = -1, aEnd = -1, bStart = -1;
    for (i = 0; i < n; i++) { if (ms[i].r && ms[i].r.indexOf('f') >= 0 && F === 0 && i > 0) F = i; }
    for (i = 0; i < n; i++) {
      if (ms[i].r && ms[i].r.indexOf('b') >= 0 && Bk < 0) Bk = i;
      if (ms[i].e && ms[i].e.t === 'start') {
        if (aStart < 0) aStart = i; else if (bStart < 0 && aEnd >= 0) bStart = i;
      }
      if (aStart >= 0 && aEnd < 0 && ms[i].r && ms[i].r.indexOf('b') >= 0) aEnd = i;
    }
    var hasRep = Bk >= 0 && aStart >= 0 && aEnd >= 0 && bStart >= 0;
    var verses = [];
    if (verseMode === 'all' || !verseMode) { for (i = 1; i <= V; i++) verses.push(i); }
    else verses.push(Math.min(V, parseInt(verseMode, 10) || 1));
    verses.forEach(function (v) {
      var j;
      if (!hasRep) { for (j = 0; j < n; j++) seq.push({ mi: j, verse: v }); return; }
      for (j = 0; j < aStart; j++) seq.push({ mi: j, verse: v });
      if (v < V) { for (j = aStart; j <= aEnd; j++) seq.push({ mi: j, verse: v }); }
      else { for (j = bStart; j < n; j++) seq.push({ mi: j, verse: v }); }
    });
    return seq;
  }

  function Player(synth) {
    this.synth = synth;
    this.rate = 1; this.playing = false; this.timeline = []; this.passes = [];
    this.songSec = 0; this.anchorCtx = 0; this.anchorSong = 0; this.nextIdx = 0; this.timer = null;
    this.onEnd = null; this.onPass = null; this.vol = 1;
  }

  // arr: saída do Arranger; h: hino; verseMode
  Player.prototype.load = function (arr, h, verseMode, opts) {
    opts = opts || {};
    var seq = buildSequence(h, verseMode);
    var info = arr.minfo;
    var fm = (h.fm || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    var ferK = opts.fermata == null ? 0.9 : opts.fermata;
    var tl = [], passes = [], sec = 0;
    // eventos por compasso
    var byMeasure = info.map(function () { return { ev: [], st: [] }; });
    function mOf(t) {
      var lo = 0, hi = info.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (info[mid].t0 <= t + 0.5) lo = mid; else hi = mid - 1; }
      return lo;
    }
    arr.events.forEach(function (e) { byMeasure[mOf(e.t)].ev.push(e); });
    arr.states.forEach(function (s) { byMeasure[mOf(s.t)].st.push(s); });
    var tpOf = function (m) { return 60 / (m.tempo * 96); };
    var stl = [];
    seq.forEach(function (p, pi) {
      var m = info[p.mi], spt = tpOf(m);
      var fers = fm.filter(function (f) { return f[0] >= m.t0 - 0.5 && f[0] < m.t0 + m.len - 0.5; });
      function eff(t) {
        var x = t - m.t0;
        for (var q = 0; q < fers.length; q++) {
          if (fers[q][0] + fers[q][1] <= t + 0.5) x += fers[q][1] * ferK;
        }
        return x;
      }
      var start = sec;
      byMeasure[p.mi].ev.forEach(function (e) { tl.push({ sec: start + eff(e.t) * spt, e: e, pass: pi, verse: p.verse }); });
      byMeasure[p.mi].st.forEach(function (s) { stl.push({ sec: start + eff(s.t) * spt, s: s, pass: pi }); });
      var extra = 0; fers.forEach(function (f) { extra += f[1] * ferK; });
      var len = (m.len + extra) * spt;
      passes.push({ mi: p.mi, verse: p.verse, start: start, len: len, spt: spt, t0: m.t0, mlen: m.len, eff: eff });
      sec += len;
    });
    tl.sort(function (a, b) { return a.sec - b.sec; });
    stl.sort(function (a, b) { return a.sec - b.sec; });
    this.timeline = tl; this.states = stl; this.passes = passes; this.total = sec + 1.2;
    this.nextIdx = 0; this.songSec = 0;
    var midis = arr.events.map(function (e) { return e.midi; });
    this.midis = midis;
  };

  Player.prototype.passAt = function (sec) {
    var p = this.passes, lo = 0, hi = p.length - 1;
    if (!p.length) return -1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (p[mid].start <= sec) lo = mid; else hi = mid - 1; }
    return lo;
  };
  Player.prototype.now = function () {
    if (!this.synth.ctx) return this.songSec;
    if (!this.playing) return this.songSec;
    return this.anchorSong + (this.synth.ctx.currentTime - this.anchorCtx) * this.rate;
  };
  Player.prototype.tickAt = function (sec) {
    var pi = this.passAt(sec); if (pi < 0) return { pass: -1, tick: 0 };
    var p = this.passes[pi], local = (sec - p.start) / p.spt, t = 0;
    // inverte eff (aproximação linear por trechos)
    var lo = 0, hi = p.mlen;
    for (var it = 0; it < 24; it++) { var mid = (lo + hi) / 2; if (p.eff(p.t0 + mid) < local) lo = mid; else hi = mid; }
    t = (lo + hi) / 2;
    return { pass: pi, tick: p.t0 + t, local: local };
  };
  Player.prototype.findIdx = function (sec) {
    var tl = this.timeline, lo = 0, hi = tl.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (tl[mid].sec < sec - 1e-6) lo = mid + 1; else hi = mid; }
    return lo;
  };

  Player.prototype.start = function (fromSec) {
    var s = this.synth; s.init();
    if (s.ctx.state === 'suspended') s.ctx.resume();
    s.prepare(this.midis || []);
    this.songSec = fromSec == null ? this.songSec : fromSec;
    if (this.songSec >= this.total - 1.0) this.songSec = 0;
    this.anchorCtx = s.ctx.currentTime + 0.08; this.anchorSong = this.songSec;
    this.nextIdx = this.findIdx(this.songSec);
    this.playing = true; this.scheduled = [];
    var self = this;
    clearInterval(this.timer);
    this.timer = setInterval(function () { self.pump(); }, 30);
    this.pump();
  };
  Player.prototype.pump = function () {
    if (!this.playing) return;
    var ctx = this.synth.ctx, now = this.now(), look = now + 0.35 * this.rate;
    var tl = this.timeline;
    while (this.nextIdx < tl.length && tl[this.nextIdx].sec <= look) {
      var it = tl[this.nextIdx++];
      var when = this.anchorCtx + (it.sec - this.anchorSong) / this.rate;
      if (when < ctx.currentTime - 0.01) continue;
      var e = it.e;
      this.synth.pluck(e.midi, Math.max(when, ctx.currentTime), e.vel * this.vol, e.s);
    }
    if (now >= this.total) { this.stop(true); if (this.onEnd) this.onEnd(); }
  };
  Player.prototype.pause = function () {
    if (!this.playing) return;
    this.songSec = this.now();
    this.playing = false;
    clearInterval(this.timer);
    this.synth.stopAll();
  };
  Player.prototype.stop = function (ended) {
    this.playing = false; clearInterval(this.timer);
    if (this.synth.ctx) this.synth.stopAll();
    this.songSec = ended ? this.total : 0;
  };
  Player.prototype.seek = function (sec) {
    var was = this.playing;
    if (was) { this.playing = false; clearInterval(this.timer); this.synth.stopAll(); }
    this.songSec = Math.max(0, sec);
    if (was) this.start(this.songSec);
  };
  Player.prototype.setRate = function (r) {
    var was = this.playing, sec = this.now();
    this.rate = r;
    if (was) { this.synth.stopAll(); this.start(sec); }
  };

  return { Synth: Synth, Player: Player, renderPluck: renderPluck, buildSequence: buildSequence, VOICES: VOICES };
});
