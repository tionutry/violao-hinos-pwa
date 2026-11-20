/* sheet.js — folha 16:9 (1920x1080): pauta (VexFlow) + letra + diagramas + tablatura
 * Depende de VexFlow (window.Vex) e do resultado de Arranger.arrange().
 */
(function (root) {
  'use strict';
  var W = 1920, H = 1080, S = 1.75;
  var NS = 'http://www.w3.org/2000/svg';
  var INK = '#3a2713', INK2 = '#6b4a2b', ACCENT = '#a3361a';
  var FINGER_COL = { p: '#7a2e12', i: '#1f5f7a', m: '#2d7a3a', a: '#8a5a00' };
  var SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
  var SANS = '"Trebuchet MS", "DejaVu Sans", Verdana, sans-serif';

  var KEYS_MAJOR = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  var SPELL_FLAT = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
  var SPELL_SHARP = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  var SPELL_C = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  var measCanvas = null;
  function textW(str, font) {
    if (!measCanvas) measCanvas = document.createElement('canvas').getContext('2d');
    measCanvas.font = font;
    return measCanvas.measureText(str).width;
  }

  function spell(midi, fifths) {
    var w = midi + 12; // oitava escrita da notação de violão
    var pc = ((w % 12) + 12) % 12, oct = Math.floor(w / 12) - 1;
    var tab = fifths > 0 ? SPELL_SHARP : (fifths < 0 ? SPELL_FLAT : SPELL_C);
    var n = tab[pc];
    return n.charAt(0) + (n.length > 1 ? n.charAt(1) : '') + '/' + oct;
  }

  /* ---- quantização de durações ---- */
  var DUR = [
    { t: 384, v: 'w', dots: 0, base: 384 }, { t: 288, v: 'h', dots: 1, base: 192 }, { t: 192, v: 'h', dots: 0, base: 192 },
    { t: 144, v: 'q', dots: 1, base: 96 }, { t: 96, v: 'q', dots: 0, base: 96 }, { t: 72, v: '8', dots: 1, base: 48 },
    { t: 48, v: '8', dots: 0, base: 48 }, { t: 36, v: '16', dots: 1, base: 24 }, { t: 24, v: '16', dots: 0, base: 24 },
    { t: 12, v: '32', dots: 0, base: 12 }
  ];
  var TUP = [{ t: 128, v: 'h' }, { t: 64, v: 'q' }, { t: 32, v: '8' }, { t: 16, v: '16' }];

  function pieces(p, r) { // p posição relativa, r duração restante
    var out = [];
    var guard = 0;
    while (r > 0.5 && guard++ < 40) {
      var done = false, i;
      var tupl = (Math.abs(p % 24) > 0.5 || Math.abs(r % 12) > 0.5);
      if (tupl) {
        for (i = 0; i < TUP.length; i++) {
          if (TUP[i].t <= r + 0.5) { out.push({ rel: p, dur: TUP[i].t, v: TUP[i].v, dots: 0, tup: true }); p += TUP[i].t; r -= TUP[i].t; done = true; break; }
        }
        if (!done) { out.push({ rel: p, dur: r, v: '16', dots: 0, tup: true }); r = 0; }
        continue;
      }
      for (i = 0; i < DUR.length; i++) {
        var d = DUR[i];
        if (d.t <= r + 0.5 && Math.abs(p % (d.base >= 192 ? 96 : Math.min(d.base, 48))) < 0.5) { out.push({ rel: p, dur: d.t, v: d.v, dots: d.dots }); p += d.t; r -= d.t; done = true; break; }
      }
      if (!done) { out.push({ rel: p, dur: 12, v: '32', dots: 0 }); p += 12; r -= 12; }
    }
    return out;
  }

  /* monta, para um compasso, as duas vozes: lista de {rel,dur,v,dots,midi,ev,rest,tieFromPrev,tup} */
  function buildVoices(arr, mi, hasMelCont) {
    var m = arr.minfo[mi], t0 = m.t0, t1 = m.t0 + m.len;
    var mel = [], other = [];
    arr.events.forEach(function (e) {
      if (e.t >= t0 - 0.5 && e.t < t1 - 0.5) (e.role === 'mel' ? mel : other).push(e);
    });
    function voice(list, isMel) {
      var out = [], cursor = 0, i;
      var carry = voice.carry && voice.carry[isMel ? 'mel' : 'oth'];
      var evs = list.slice().sort(function (a, b) { return a.t - b.t; });
      // notas por tempo (acordes simultâneos na voz 2: usa a mais grave só como apoio, cada evento vira nota separada se instantes distintos)
      var groups = [];
      evs.forEach(function (e) {
        var g = groups[groups.length - 1];
        if (g && Math.abs(g.t - e.t) < 1) g.ev.push(e); else groups.push({ t: e.t, ev: [e] });
      });
      groups.forEach(function (g, gi) {
        var start = g.t - t0;
        var next = groups[gi + 1] ? groups[gi + 1].t - t0 : m.len;
        var dur;
        if (isMel) {
          dur = Math.min(g.ev[0].d, m.len - start);
          if (gi + 1 < groups.length) dur = Math.min(dur, next - start);
        } else {
          dur = next - start;
        }
        if (dur < 6) dur = Math.max(dur, 12);
        if (start > cursor + 0.5) {
          pieces(cursor, start - cursor).forEach(function (pc) { pc.rest = true; out.push(pc); });
        }
        var rem = isMel ? g.ev[0].d : dur; // para continuação
        var ps = pieces(start, dur);
        ps.forEach(function (pc, k) { pc.midis = g.ev.map(function (x) { return x.midi; }); pc.evs = g.ev; pc.tieNext = k < ps.length - 1; pc.first = k === 0; out.push(pc); });
        cursor = start + dur;
        if (isMel && g.ev[0].d > m.len - start + 0.5) {
          // continuação no compasso seguinte
          out.cont = { mi: mi + 1, midi: g.ev[0].midi, dur: g.ev[0].d - (m.len - start), evs: g.ev };
          out[out.length - 1].tieNext = true;
        }
      });
      if (cursor < m.len - 0.5) {
        pieces(cursor, m.len - cursor).forEach(function (pc) { pc.rest = true; out.push(pc); });
      }
      return out;
    }
    var v1 = voice(mel, true), v2 = voice(other, false);
    return { v1: v1, v2: v2, m: m };
  }

  /* ================================================================== */
  function Sheet(opts) {
    this.h = opts.hymn; this.arr = opts.arr; this.opts = opts;
    this.pages = [];
    this.showFingers = opts.showLeftFingers !== false;
    this.theme = opts.theme || {};
  }

  Sheet.prototype.verseText = function (ev, verse, mi) {
    var ly = ev.ly; if (!ly) return null;
    var s = ly[verse - 1];
    if (s) return s;
    if (!this.hasLy[mi] || !this.hasLy[mi][verse]) return ly[0] || null;
    return null;
  };

  Sheet.prototype.prepare = function () {
    var self = this, arr = this.arr, h = this.h;
    this.hasLy = arr.minfo.map(function () { return {}; });
    arr.events.forEach(function (e) {
      if (e.role !== 'mel' || !e.ly) return;
      var m = arr.minfo.length; var lo = 0, hi = m - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (arr.minfo[mid].t0 <= e.t + 0.5) lo = mid; else hi = mid - 1; }
      e.mi_ = lo;
      e.ly.forEach(function (s, i) { if (s) self.hasLy[lo][i + 1] = true; });
    });
    // vozes por compasso
    this.mv = arr.minfo.map(function (m, mi) { return buildVoices(arr, mi); });
    // continuação de notas ligadas entre compassos
    for (var mi = 0; mi < this.mv.length - 1; mi++) {
      var c = this.mv[mi].v1.cont;
      if (c) {
        var nxt = this.mv[mi + 1].v1;
        // substitui o primeiro pedaço (repouso) do próximo compasso pela continuação
        if (nxt.length && nxt[0].rest) {
          var rest = nxt.shift();
          var ps = pieces(0, Math.min(c.dur, arr.minfo[mi + 1].len));
          var add = ps.map(function (pc, k) { pc.midis = [c.midi]; pc.evs = []; pc.cont = true; pc.tieNext = k < ps.length - 1; return pc; });
          // preenche o que sobrar com repouso
          var used = add.reduce(function (a, b) { return a + b.dur; }, 0);
          var restLeft = rest.dur - used;
          var tail = [];
          if (restLeft > 0.5) pieces(used, restLeft).forEach(function (pc) { pc.rest = true; tail.push(pc); });
          nxt.unshift.apply(nxt, add.concat(tail));
        }
      }
    }
  };

  /* colunas e larguras mínimas de um compasso */
  Sheet.prototype.measureColumns = function (mi, verse) {
    var mv = this.mv[mi], m = mv.m, cols = {};
    function add(rel) { var k = Math.round(rel); if (!cols[k]) cols[k] = { rel: k }; return cols[k]; }
    mv.v1.concat(mv.v2).forEach(function (pc) { add(pc.rel); });
    var list = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return cols[k]; });
    return list;
  };

  /* calcula layout de uma sequência de compassos [a..b] numa linha; retorna null se não cabe */
  Sheet.prototype.layoutSystem = function (a, b, avail, first, verses) {
    var self = this, arr = this.arr;
    var cols = [], mstarts = [];
    for (var mi = a; mi <= b; mi++) {
      var mc = this.measureColumns(mi);
      mstarts.push(cols.length);
      mc.forEach(function (c) { cols.push({ mi: mi, rel: c.rel, t: arr.minfo[mi].t0 + c.rel }); });
    }
    var n = cols.length, i, j;
    // restrições: x_j >= x_i + w
    var gaps = new Array(n).fill(0); // distância mínima ao próximo
    for (i = 0; i < n - 1; i++) {
      var dt = cols[i + 1].t - cols[i].t;
      var g = Math.max(30, Math.min(150, 28 + 0.5 * dt));
      if (cols[i + 1].mi !== cols[i].mi) g = Math.max(g, 74);
      gaps[i] = g;
    }
    var cons = []; // pares extras
    var colByT = {};
    cols.forEach(function (c, k) { colByT[Math.round(c.t)] = k; });
    // letra: melodia
    var melCols = [];
    arr.events.forEach(function (e) {
      if (e.role !== 'mel') return;
      var k = colByT[Math.round(e.t)];
      if (k == null) return;
      var best = 0, txt = '';
      verses.forEach(function (v) {
        var s = self.verseText(e, v, e.mi_);
        if (s) { var w = textW(s.replace(/-$/, ''), '38px ' + SERIF); if (w > best) best = w; txt = s; }
      });
      melCols.push({ k: k, w: best, hy: /-$/.test(txt) });
    });
    melCols.sort(function (p, q) { return p.k - q.k; });
    for (i = 0; i + 1 < melCols.length; i++) {
      var p = melCols[i], q = melCols[i + 1];
      var need = p.w / 2 + q.w / 2 + (p.hy ? 34 : 16);
      cons.push({ i: p.k, j: q.k, w: need });
    }
    // diagramas: acordes
    var chCols = [];
    arr.chords.forEach(function (c) {
      var k = colByT[Math.round(c.t)];
      if (k == null) {
        // acorde cuja primeira nota cai antes do primeiro compasso da linha ou entre colunas
        return;
      }
      chCols.push({ k: k, w: Math.max(104, textW(c.name, 'bold 34px ' + SANS) + 16) });
    });
    chCols.sort(function (p, q) { return p.k - q.k; });
    for (i = 0; i + 1 < chCols.length; i++) {
      var need2 = (chCols[i].w + chCols[i + 1].w) / 2;
      cons.push({ i: chCols[i].k, j: chCols[i + 1].k, w: need2 });
    }
    // posições mínimas
    var x = new Array(n).fill(0);
    var left = first ? 0 : 0;
    for (j = 1; j < n; j++) {
      x[j] = x[j - 1] + gaps[j - 1];
      cons.forEach(function (c) { if (c.j === j) x[j] = Math.max(x[j], x[c.i] + c.w); });
    }
    var minW = n ? x[n - 1] + 44 : 0; // espaço após a última nota
    return { cols: cols, x: x, minW: minW, mstarts: mstarts, gaps: gaps };
  };

  Sheet.prototype.paginate = function (verses) {
    var arr = this.arr, nm = arr.minfo.length;
    var pages = [], a = 0;
    var contentL = 64, contentR = W - 64;
    while (a < nm) {
      var first = true;
      var clefW = 270; // clave + armadura + fórmula
      var avail = contentR - contentL - clefW - 20;
      var b = a, best = null;
      while (b < nm) {
        var lay = this.layoutSystem(a, b, avail, true, verses);
        if (lay.minW <= avail || b === a) { best = lay; best.b = b; if (lay.minW > avail) break; b++; }
        else break;
      }
      pages.push({ a: a, b: best.b, lay: best });
      a = best.b + 1;
    }
    return pages;
  };

  /* ---------------------------------------------------------------- */
  Sheet.prototype.build = function (verse, verses) {
    this.prepare();
    var pgs = this.paginate(verses || [verse]);
    this.pages = pgs.map(this.drawPage.bind(this, verse));
    this.measurePage = {};
    var self = this;
    this.pages.forEach(function (p, pi) { for (var mi = p.a; mi <= p.b; mi++) self.measurePage[mi] = pi; });
    return this.pages;
  };

  Sheet.prototype.drawPage = function (verse, pg, pageIndex, all) {
    var self = this, arr = this.arr, h = this.h, VF = Vex.Flow;
    var lay = pg.lay;
    var host = document.createElement('div');
    var renderer = new VF.Renderer(host, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    var ctx = renderer.getContext();
    var svg = host.querySelector('svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';
    var T = this.theme;

    // ---- papel sépia ----
    var defs = el('defs', null, svg);
    var g1 = el('radialGradient', { id: 'paper' + pageIndex, cx: '50%', cy: '45%', r: '75%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.paper0 || '#f3e4c3' }, g1);
    el('stop', { offset: '70%', 'stop-color': T.paper1 || '#e8d2a6' }, g1);
    el('stop', { offset: '100%', 'stop-color': T.paper2 || '#d4b684' }, g1);
    var bg = el('g', { 'class': 'bg' }, null);
    svg.insertBefore(bg, svg.firstChild);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#paper' + pageIndex + ')' }, bg);
    el('rect', { x: 18, y: 18, width: W - 36, height: H - 36, fill: 'none', stroke: T.border || '#9c7a45', 'stroke-width': 3, rx: 10, opacity: 0.55 }, bg);
    el('rect', { x: 28, y: 28, width: W - 56, height: H - 56, fill: 'none', stroke: T.border || '#9c7a45', 'stroke-width': 1, rx: 6, opacity: 0.45 }, bg);

    // ---- cabeçalho ----
    var hd = el('g', { 'class': 'head' }, svg);
    var num = ('00' + h.n).slice(-3);
    el('text', { x: 72, y: 84, 'font-family': SERIF, 'font-size': 52, 'font-weight': 'bold', fill: INK }, hd, num + ' — ' + h.t);
    var info = [];
    if (h.c) info.push(h.c);
    info.push('Tom: ' + arr.keyName + (arr.T ? ' (' + (arr.T > 0 ? '+' : '') + arr.T + ' st)' : '') + (arr.capo ? ' · Capotraste ' + arr.capo + 'ª casa' : ''));
    var tp = arr.minfo[0].tempo; var ts0 = arr.minfo[0].ts;
    info.push(ts0[0] + '/' + ts0[1] + ' · ♩ = ' + tp);
    el('text', { x: 74, y: 124, 'font-family': SERIF, 'font-size': 27, 'font-style': 'italic', fill: INK2 }, hd, info.join('   •   '));
    this._verseLabel = el('text', { x: W - 72, y: 84, 'text-anchor': 'end', 'font-family': SERIF, 'font-size': 40, 'font-weight': 'bold', fill: ACCENT, 'class': 'verseLbl' }, hd, '');
    el('text', { x: W - 72, y: 124, 'text-anchor': 'end', 'font-family': SERIF, 'font-size': 24, fill: INK2 }, hd, 'Fingerstyle · ' + (self.opts.voiceLabel || ''));

    // ---- layout final: distribui folga ----
    var avail0 = W - 128;
    var staffX0 = 64;
    var firstMeasure = pg.a;
    // espaço de clave/armadura/fórmula
    var probe = new VF.Stave(0, 0, 400);
    probe.addClef('treble', 'default', '8vb').addKeySignature(KEYS_MAJOR[arr.fifths + 7]);
    var ts = arr.minfo[firstMeasure].ts;
    var showTs = (pg.a === 0) || !!h.ms[pg.a].b;
    if (showTs) probe.addTimeSignature(ts[0] + '/' + ts[1]);
    var noteStartPx = probe.getNoteStartX() * S;
    var firstColX = staffX0 + noteStartPx + 36;
    var avail = (W - 64) - firstColX - 52;
    var comp = lay.minW > avail ? avail / lay.minW : 1;
    var slack = Math.max(0, avail - lay.minW);
    // distribui folga proporcional a dt^0.6
    var n = lay.cols.length, wts = [], tot = 0, i;
    for (i = 0; i < n - 1; i++) {
      var dt = lay.cols[i + 1].t - lay.cols[i].t;
      var wt = Math.pow(Math.max(dt, 12), 0.65) * (lay.cols[i + 1].mi !== lay.cols[i].mi ? 1.2 : 1);
      wts.push(wt); tot += wt;
    }
    var X = [firstColX];
    for (i = 1; i < n; i++) X.push(firstColX + lay.x[i] * comp + slack * (wts.slice(0, i).reduce(function (a, b) { return a + b; }, 0) / (tot || 1)));
    var xByT = {};
    lay.cols.forEach(function (c, k) { xByT[Math.round(c.t)] = X[k]; });
    var rightEdge = W - 64;

    // ---- pauta ----
    var staffTop = 214;
    var staves = [], notesByTick = {};
    var vfStart = svg.childNodes.length;
    ctx.setFillStyle(INK); ctx.setStrokeStyle(INK);
    var tickCenter = {};
    var allBeams = [], allTuplets = [], allTies = [];
    var mStaves = [];
    var curKey = KEYS_MAJOR[arr.fifths + 7];
    for (var mi = pg.a; mi <= pg.b; mi++) {
      var li = mi - pg.a;
      var firstCol = lay.mstarts[li];
      var lastCol = (li + 1 < lay.mstarts.length ? lay.mstarts[li + 1] : n) - 1;
      var sx = (mi === pg.a) ? staffX0 : (X[firstCol] - 40);
      var ex = (mi === pg.b) ? rightEdge : (X[lastCol + 1] - 40);
      var m = arr.minfo[mi];
      var st = new VF.Stave(sx / S, staffTop / S - 40, (ex - sx) / S);
      if (mi === pg.a) {
        st.addClef('treble', 'default', '8vb').addKeySignature(curKey);
        if (showTs) st.addTimeSignature(m.ts[0] + '/' + m.ts[1]);
      } else if (h.ms[mi].b) {
        st.addTimeSignature(m.ts[0] + '/' + m.ts[1]);
      }
      var msd = h.ms[mi];
      if (msd.r && msd.r.indexOf('f') >= 0 && mi > 0) st.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      if (msd.r && msd.r.indexOf('f') >= 0 && mi === 0) st.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      if (msd.r && msd.r.indexOf('b') >= 0) st.setEndBarType(VF.Barline.type.REPEAT_END);
      if (mi === arr.minfo.length - 1) st.setEndBarType(VF.Barline.type.END);
      if (msd.e && msd.e.t === 'start') st.setVoltaType(VF.Volta.type.BEGIN_END, msd.e.n.join(',') + '.', 0);
      st.setContext(ctx);
      mStaves.push({ st: st, mi: mi, sx: sx, ex: ex });
    }

    function vfNote(pc, voiceNo) {
      var keys;
      var dur = pc.v + (pc.dots ? 'd' : '') + (pc.rest ? 'r' : '');
      var sd = voiceNo === 1 ? 1 : -1;
      if (pc.rest) {
        keys = [voiceNo === 1 ? 'd/5' : 'g/4'];
        if (pc.v === 'w') keys = [voiceNo === 1 ? 'd/5' : 'g/4'];
        var rn = new VF.StaveNote({ keys: keys, duration: dur, clef: 'treble' });
        if (pc.dots) VF.Dot.buildAndAttach([rn], { all: true });
        return rn;
      }
      keys = pc.midis.map(function (mm) { return spell(mm, arr.fifths); });
      var sorted = keys.map(function (k, ix) { return { k: k, m: pc.midis[ix] }; }).sort(function (p, q) { return p.m - q.m; });
      var nn = new VF.StaveNote({ keys: sorted.map(function (x) { return x.k; }), duration: dur, stem_direction: sd, clef: 'treble' });
      if (pc.dots) VF.Dot.buildAndAttach([nn], { all: true });
      nn.setStyle({ fillStyle: voiceNo === 1 ? INK : '#5a3d22', strokeStyle: voiceNo === 1 ? INK : '#5a3d22' });
      return nn;
    }

    mStaves.forEach(function (ms) {
      var mi = ms.mi, mv = self.mv[mi], m = mv.m, st = ms.st;
      st.setContext(ctx).draw();
      var v1n = [], v2n = [];
      function conv(list, no, store) {
        var notes = [];
        list.forEach(function (pc) {
          var nn = vfNote(pc, no);
          nn._pc = pc; nn._no = no;
          notes.push(nn);
        });
        // tuplas
        var run = [];
        function flush() {
          if (run.length >= 3) {
            for (var q = 0; q + 2 < run.length; q += 3) allTuplets.push(new VF.Tuplet(run.slice(q, q + 3), { num_notes: 3, notes_occupied: 2, bracketed: false, ratioed: false, location: no === 1 ? 1 : -1 }));
          }
          run = [];
        }
        notes.forEach(function (nn) { if (nn._pc.tup) { run.push(nn); if (run.length === 3) { allTuplets.push(new VF.Tuplet(run.slice(), { num_notes: 3, notes_occupied: 2, bracketed: false, ratioed: false, location: no === 1 ? 1 : -1 })); run = []; } } else run = []; });
        return notes;
      }
      v1n = conv(mv.v1, 1); v2n = conv(mv.v2, 2);
      var voices = [];
      var vA = new VF.Voice({ num_beats: Math.max(1, m.len / 96 * 4 / 4), beat_value: 4 }).setStrict(false);
      var vB = new VF.Voice({ num_beats: Math.max(1, m.len / 96), beat_value: 4 }).setStrict(false);
      vA.addTickables(v1n); vB.addTickables(v2n);
      VF.Accidental.applyAccidentals([vA, vB], curKey);
      var fm = new VF.Formatter().joinVoices([vA, vB]);
      fm.format([vA, vB], Math.max(100, (ms.ex - ms.sx) / S - 40), { auto_beam: false });
      // reposiciona colunas
      v1n.concat(v2n).forEach(function (nn) { nn.setStave(st); });
      var seenTc = [];
      v1n.concat(v2n).forEach(function (nn) {
        var tc = nn.getTickContext();
        if (seenTc.indexOf(tc) >= 0) return;
        seenTc.push(tc);
        var key = Math.round(m.t0 + nn._pc.rel);
        var target = xByT[key];
        if (target != null) {
          var cur = nn.getAbsoluteX();
          tc.setX(tc.getX() + (target / S - 6 - cur));
        }
      });
      // vigas (antes de desenhar, para suprimir bandeirolas)
      var gr = m.beat === 144 ? [new VF.Fraction(3, 8)] : (m.beat === 288 ? [new VF.Fraction(3, 4)] : (m.beat === 192 ? [new VF.Fraction(1, 2)] : [new VF.Fraction(1, 4)]));
      [v1n, v2n].forEach(function (notes, ix) {
        try {
          var beams = VF.Beam.generateBeams(notes, { groups: gr, maintain_stem_directions: true, stem_direction: ix === 0 ? 1 : -1, beam_rests: false });
          beams.forEach(function (b) { allBeams.push(b); });
        } catch (e) { }
      });
      vA.draw(ctx, st); vB.draw(ctx, st);
      // centro das cabeças
      v1n.concat(v2n).forEach(function (nn) {
        if (nn._pc.rest) return;
        var key = Math.round(m.t0 + nn._pc.rel);
        try { tickCenter[key] = ((nn.getNoteHeadBeginX() + nn.getNoteHeadEndX()) / 2) * S; } catch (e) { }
      });
      // ligaduras
      [v1n, v2n].forEach(function (notes) {
        for (var q = 0; q + 1 < notes.length; q++) {
          if (notes[q]._pc.tieNext && !notes[q]._pc.rest && !notes[q + 1]._pc.rest) allTies.push(new VF.StaveTie({ first_note: notes[q], last_note: notes[q + 1], first_indices: [0], last_indices: [0] }));
        }
      });
      // ligadura entre compassos
      ms.v1n = v1n; ms.v2n = v2n;
    });
    // ligadura entre compassos consecutivos
    for (var q = 0; q + 1 < mStaves.length; q++) {
      var A = mStaves[q].v1n, B = mStaves[q + 1].v1n;
      if (A.length && B.length && A[A.length - 1]._pc.tieNext && B[0]._pc.cont) {
        allTies.push(new VF.StaveTie({ first_note: A[A.length - 1], last_note: B[0], first_indices: [0], last_indices: [0] }));
      }
    }
    allBeams.forEach(function (b) { b.setContext(ctx).draw(); });
    allTuplets.forEach(function (t) { try { t.setContext(ctx).draw(); } catch (e) { } });
    allTies.forEach(function (t) { try { t.setContext(ctx).draw(); } catch (e) { } });
    var vfG = el('g', { transform: 'scale(' + S + ')', 'class': 'vf' }, null);
    var kids = Array.prototype.slice.call(svg.childNodes, vfStart);
    kids.forEach(function (k) { vfG.appendChild(k); });
    svg.appendChild(vfG);

    // rótulos (Coro, Final)
    var lbl = el('g', { 'class': 'labels' }, svg);
    mStaves.forEach(function (ms) {
      var d = h.ms[ms.mi];
      if (d.lb) {
        var col = lay.mstarts[ms.mi - pg.a];
        el('text', { x: X[col] - 20, y: staffTop - 62, 'font-family': SERIF, 'font-size': 30, 'font-weight': 'bold', 'font-style': 'italic', fill: ACCENT }, lbl, d.lb);
      }
    });

    // ---- colunas: centro das notas ----
    var cx = {};
    lay.cols.forEach(function (c, k) {
      var key = Math.round(c.t);
      cx[key] = tickCenter[key] != null ? tickCenter[key] : X[k] + 12;
    });

    // ---- letra ----
    var lyr = el('g', { 'class': 'lyr' }, svg);
    var lyrY = 436;
    this.drawLyrics(lyr, pg, cx, lay, verse, lyrY);

    // ---- diagramas ----
    var dg = el('g', { 'class': 'diagrams' }, svg);
    var chordsHere = arr.chords.filter(function (c) { return xByT[Math.round(c.t)] != null; });
    var chordEls = {};
    chordsHere.forEach(function (c) {
      var x = cx[Math.round(c.t)];
      var gEl = el('g', { 'class': 'chord', 'data-t': Math.round(c.t) }, dg);
      self.drawDiagram(gEl, c, x, 468);
    });

    // ---- tablatura ----
    var tab = el('g', { 'class': 'tab' }, svg);
    var tabTop = 742, tsp = 31;
    var tabL = 64, tabR = W - 64;
    for (i = 0; i < 6; i++) el('line', { x1: tabL, x2: tabR, y1: tabTop + i * tsp, y2: tabTop + i * tsp, stroke: INK, 'stroke-width': 1.8, opacity: 0.85 }, tab);
    el('line', { x1: tabL, x2: tabL, y1: tabTop, y2: tabTop + 5 * tsp, stroke: INK, 'stroke-width': 3 }, tab);
    el('line', { x1: tabR, x2: tabR, y1: tabTop, y2: tabTop + 5 * tsp, stroke: INK, 'stroke-width': 3 }, tab);
    ['T', 'A', 'B'].forEach(function (ch, k) { el('text', { x: tabL + 52, y: tabTop + 38 + k * 40, 'text-anchor': 'middle', 'font-family': SERIF, 'font-size': 40, 'font-weight': 'bold', fill: INK }, tab, ch); });
    // barras de compasso na tablatura
    mStaves.forEach(function (ms) {
      var x = ms.ex;
      if (ms.mi < pg.b) el('line', { x1: x, x2: x, y1: tabTop, y2: tabTop + 5 * tsp, stroke: INK, 'stroke-width': 2 }, tab);
    });
    // compasso: barras de repetição/fim na tab (simplificado)
    var colG = {};
    var evsHere = arr.events.filter(function (e) { return xByT[Math.round(e.t)] != null; });
    var stateAt = function (t) {
      var lo = 0, hi = arr.states.length - 1, r = null;
      while (lo <= hi) { var mid = (lo + hi) >> 1; if (arr.states[mid].t <= t + 0.5) { r = arr.states[mid]; lo = mid + 1; } else hi = mid - 1; }
      return r;
    };
    var fRowY = tabTop + 5 * tsp + 46;
    evsHere.forEach(function (e) {
      var key = Math.round(e.t);
      var x = cx[key];
      var gcol = colG[key];
      if (!gcol) {
        gcol = colG[key] = el('g', { 'class': 'col', 'data-t': key }, tab);
      }
      var y = tabTop + (e.s - 1) * tsp;
      var label = '' + e.f;
      var fw = textW(label, 'bold 27px ' + SANS) + 10;
      el('rect', { x: x - fw / 2, y: y - 15, width: fw, height: 30, fill: T.paper0 || '#efdfbc', opacity: 0.95, rx: 4 }, gcol);
      var col = e.role === 'mel' ? ACCENT : INK;
      el('text', { x: x, y: y + 9, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 27, 'font-weight': 'bold', fill: col, 'class': 'fret' }, gcol, label);
      // dedo da mão esquerda
      if (self.showFingers && e.f > 0) {
        var stt = stateAt(e.t), fn = 0;
        if (stt) stt.held.forEach(function (hh) { if (hh.s === e.s && hh.f === e.f) fn = hh.n; });
        if (fn > 0) el('text', { x: x + fw / 2 - 1, y: y - 8, 'font-family': SANS, 'font-size': 15, 'font-weight': 'bold', fill: '#2a5f8a' }, gcol, '' + fn);
      }
      // hammer-on / slide: nota de adorno (pequena) antes da nota de chegada
      if (e.tech && e.from) {
        var gx = x - fw / 2 - 2;
        el('text', { x: gx, y: y - 11, 'text-anchor': 'end', 'font-family': SANS, 'font-size': 17, 'font-weight': 'bold', fill: ACCENT }, gcol, '' + e.from.f);
        if (e.tech === 'h') {
          el('path', { d: 'M' + (gx - 12) + ',' + (y - 24) + ' Q' + (gx - 2) + ',' + (y - 33) + ' ' + (x - 4) + ',' + (y - 22), fill: 'none', stroke: ACCENT, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, gcol);
          el('text', { x: gx - 3, y: y - 36, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 15, 'font-weight': 'bold', fill: ACCENT }, gcol, 'H');
        } else {
          el('line', { x1: gx + 1, y1: y - 4, x2: x - fw / 2 + 4, y2: y - 14, stroke: ACCENT, 'stroke-width': 3, 'stroke-linecap': 'round' }, gcol);
          el('text', { x: gx - 3, y: y - 26, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 15, 'font-weight': 'bold', fill: ACCENT }, gcol, 'sl');
        }
      }
      // dedo da mão direita 
      var row = e.hand === 'p' ? 1 : 0;
      el('text', { x: x, y: fRowY + row * 36, 'text-anchor': 'middle', 'font-family': SERIF, 'font-style': 'italic', 'font-size': 34, 'font-weight': 'bold', fill: FINGER_COL[e.hand] }, gcol, e.hand);
    });
    // legenda
    el('text', { x: tabL, y: fRowY + 40, 'font-family': SANS, 'font-size': 20, fill: INK2, opacity: 0 }, tab, '');

    // rodapé
    var ft = el('g', { 'class': 'foot' }, svg);
    el('text', { x: 72, y: 1052, 'font-family': SANS, 'font-size': 20, fill: INK2 }, ft, 'DigitaHinos · Hinário nº 5 · arranjo fingerstyle  —  números azuis: dedos da mão esquerda · p i m a: mão direita · nº pequeno = nota de adorno: H hammer-on · sl slide');
    el('text', { x: W - 72, y: 1052, 'text-anchor': 'end', 'font-family': SANS, 'font-size': 20, fill: INK2 }, ft, 'Página ' + (pageIndex + 1));

    // cabeça de reprodução
    var ph = el('g', { 'class': 'playhead', opacity: 0 }, svg);
    el('rect', { x: -22, y: 150, width: 44, height: 900, fill: ACCENT, opacity: 0.14, rx: 10 }, ph);
    el('line', { x1: 0, x2: 0, y1: 150, y2: 1020, stroke: ACCENT, 'stroke-width': 3, opacity: 0.7 }, ph);

    // dados para animação
    var colList = lay.cols.map(function (c, k) { return { t: Math.round(c.t), x: cx[Math.round(c.t)] }; });
    return { a: pg.a, b: pg.b, svg: svg, host: host, cols: colList, cx: cx, xByT: xByT, lay: lay, ph: ph, lyr: lyr, colG: colG, melCols: this._lastMelCols };
  };

  Sheet.prototype.drawLyrics = function (g, pg, cx, lay, verse, y) {
    var self = this, arr = this.arr;
    while (g.firstChild) g.removeChild(g.firstChild);
    var items = [];
    arr.events.forEach(function (e) {
      if (e.role !== 'mel') return;
      var key = Math.round(e.t);
      if (cx[key] == null) return;
      var s = self.verseText(e, verse, e.mi_);
      if (s) items.push({ t: key, x: cx[key], s: s });
    });
    items.sort(function (a, b) { return a.x - b.x; });
    // número da estrofe
    el('text', { x: 72, y: y, 'font-family': SERIF, 'font-size': 38, 'font-weight': 'bold', fill: ACCENT }, g, verse + '.');
    var font = '38px ' + SERIF;
    items.forEach(function (it, k) {
      var txt = it.s.replace(/-$/, '');
      var gg = el('g', { 'class': 'syl', 'data-t': it.t }, g);
      el('text', { x: it.x, y: y, 'text-anchor': 'middle', 'font-family': SERIF, 'font-size': 38, fill: INK }, gg, txt);
      if (/-$/.test(it.s)) {
        var nx = items[k + 1];
        var w1 = textW(txt, font);
        var xa = it.x + w1 / 2, xb = nx ? nx.x - textW(nx.s.replace(/-$/, ''), font) / 2 : xa + 30;
        if (xb - xa > 12) el('text', { x: (xa + xb) / 2, y: y, 'text-anchor': 'middle', 'font-family': SERIF, 'font-size': 38, fill: INK2 }, gg, '-');
      }
    });
  };

  Sheet.prototype.setVerse = function (verse) {
    var self = this;
    this.pages.forEach(function (p) {
      self.drawLyrics(p.lyr, { a: p.a, b: p.b }, p.cx, p.lay, verse, 436);
    });
  };

  /* diagrama de acorde */
  Sheet.prototype.drawDiagram = function (g, c, x, y) {
    var sh = c.shape, T = this.theme;
    var gw = 78, fh = 26, nf = 4, sx = gw / 5;
    var left = x - gw / 2;
    var frets = [];
    sh.fretted.forEach(function (f) { if (f.f > 0) frets.push(f.f); });
    var minF = frets.length ? Math.min.apply(null, frets) : 1;
    var maxF = frets.length ? Math.max.apply(null, frets) : 1;
    var base = (maxF > 4) ? minF : 1;
    el('text', { x: x, y: y + 18, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 34, 'font-weight': 'bold', fill: INK }, g, c.name);
    var top = y + 58;
    // marcas acima (soltas / abafadas)
    var used = {};
    used[sh.bass.s] = sh.bass.f; sh.inner.forEach(function (i) { used[i.s] = i.f; });
    for (var s = 1; s <= 6; s++) {
      var sxp = left + (6 - s) * sx;
      var mark = null;
      if (used[s] === 0) mark = 'o';
      else if (s > sh.bass.s) mark = 'x';
      if (mark === 'o') el('circle', { cx: sxp, cy: top - 11, r: 5.5, fill: 'none', stroke: INK, 'stroke-width': 2 }, g);
      else if (mark === 'x') {
        el('path', { d: 'M' + (sxp - 5) + ' ' + (top - 16) + 'l10 10M' + (sxp + 5) + ' ' + (top - 16) + 'l-10 10', stroke: INK2, 'stroke-width': 2 }, g);
      }
    }
    // grade
    for (var r = 0; r <= nf; r++) el('line', { x1: left, x2: left + gw, y1: top + r * fh, y2: top + r * fh, stroke: INK, 'stroke-width': r === 0 && base === 1 ? 5 : 1.6 }, g);
    for (var k = 0; k < 6; k++) el('line', { x1: left + k * sx, x2: left + k * sx, y1: top, y2: top + nf * fh, stroke: INK, 'stroke-width': 1.6 }, g);
    if (base > 1) el('text', { x: left + gw + 6, y: top + fh * 0.7, 'font-family': SANS, 'font-size': 20, fill: INK2 }, g, base + 'ª');
    // pestana
    if (sh.barre) {
      var bf = sh.barre.f - base;
      var bx1 = left + (6 - sh.barre.s2) * sx, bx2 = left + (6 - sh.barre.s1) * sx;
      el('rect', { x: bx1 - 7, y: top + bf * fh + fh / 2 - 8, width: bx2 - bx1 + 14, height: 16, rx: 8, fill: INK }, g);
    }
    // dedos
    sh.fretted.forEach(function (f, i) {
      if (f.f <= 0) return;
      var px = left + (6 - f.s) * sx, py = top + (f.f - base) * fh + fh / 2;
      var isBass = (f.s === sh.bass.s);
      el('circle', { cx: px, cy: py, r: 10.5, fill: isBass ? (T.accent || ACCENT) : INK }, g);
      el('text', { x: px, y: py + 5.5, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 15, 'font-weight': 'bold', fill: '#fff' }, g, '' + sh.fing[i]);
    });
    // baixo aberto: destaque
    if (sh.bass.f === 0) {
      var bxp = left + (6 - sh.bass.s) * sx;
      el('circle', { cx: bxp, cy: top - 11, r: 5.5, fill: 'none', stroke: T.accent || ACCENT, 'stroke-width': 3 }, g);
    }
  };

  /* atualiza cabeça de reprodução: tick absoluto */
  Sheet.prototype.updatePlayhead = function (page, tick) {
    var cols = page.cols; if (!cols.length) return;
    var x = cols[0].x, lo = 0, hi = cols.length - 1;
    if (tick <= cols[0].t) x = cols[0].x;
    else if (tick >= cols[hi].t) x = cols[hi].x + Math.min(40, (tick - cols[hi].t) * 0.3);
    else {
      while (lo + 1 < hi) { var mid = (lo + hi) >> 1; if (cols[mid].t <= tick) lo = mid; else hi = mid; }
      var f = (tick - cols[lo].t) / (cols[lo + 1].t - cols[lo].t);
      x = cols[lo].x + f * (cols[lo + 1].x - cols[lo].x);
    }
    page.ph.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');
    page.ph.setAttribute('opacity', 1);
    // coluna ativa
    var act = null;
    for (var i = 0; i < cols.length; i++) if (cols[i].t <= tick + 0.5) act = cols[i].t; else break;
    if (page._act !== act) {
      if (page._act != null && page.colG[page._act]) page.colG[page._act].classList.remove('on');
      if (act != null && page.colG[act]) page.colG[act].classList.add('on');
      var sy = page.lyr.querySelectorAll('.syl');
      for (var k = 0; k < sy.length; k++) {
        var tt = +sy[k].getAttribute('data-t');
        sy[k].classList.toggle('on', tt <= tick + 0.5 && (k + 1 >= sy.length || +sy[k + 1].getAttribute('data-t') > tick + 0.5));
      }
      page._act = act;
    }
  };

  root.Sheet = Sheet;
  root.SheetConst = { W: W, H: H };
})(typeof window !== 'undefined' ? window : this);
