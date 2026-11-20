/* guitar.js — violão animado (SVG), visto de frente como se alguém tocasse diante do usuário:
 * corpo à esquerda, braço à direita com a cabeça (3+3 pinos), cordas graves em cima (E A D G B e),
 * 19 casas com números acima do braço. Mão esquerda: dedos 1-4 (0 = corda solta). Mão direita: p i m a.
 * Duas aparências: 'nylon' e 'aco'.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var VX = 0, VY = 66, VW = 1080, VH = 520;
  var NUT = 898, BRIDGE = 118, SCALE = 766, NF = 19;
  var LF_COL = { 1: '#e2483c', 2: '#2f80d8', 3: '#2fa752', 4: '#e5a21d' };
  var RF_COL = { p: '#c0482a', i: '#2b86b8', m: '#35a24b', a: '#d9a21b' };
  var LABELS = ['', 'e', 'B', 'G', 'D', 'A', 'E'];
  var FONT = 'Trebuchet MS,Verdana,sans-serif';
  var NUMS = [3, 5, 7, 9, 12, 15, 17, 19];

  var THEMES = {
    nylon: {
      panel: '#3a2616', panel2: '#241509', top0: '#f2d394', top1: '#d9a352', top2: '#a8702c', edge: '#6b3f17', bind: '#f4e6c2',
      board: '#1d120b', fret: '#e1dccf', nut: '#f3ead2', inlay: '#e6d9b8', trebleStr: '#f3eedd', woundStr: '#d2b878',
      hole: '#1a0f08', ring: '#6b3a16', bridge: '#2a1a10', head: '#2b1a10', label: '#f6ecd2', accent: '#f0c060', peg: '#e8dcb8', guard: null
    },
    aco: {
      panel: '#0f1a26', panel2: '#070d14', top0: '#f2b650', top1: '#b8561d', top2: '#2e0f06', edge: '#1a0803', bind: '#f7f0df',
      board: '#0c0c0e', fret: '#cfd8e0', nut: '#eef2f4', inlay: '#e6f0f7', trebleStr: '#e5ebf0', woundStr: '#c68a4a',
      hole: '#0b0504', ring: '#111', bridge: '#1c110c', head: '#14100e', label: '#dbe9f5', accent: '#6db6ff', peg: '#c9d3dc', guard: '#1b0b05'
    }
  };

  /* geometria */
  function sp(x) { return 28.8 - 6.8 * (x - BRIDGE) / (NUT - BRIDGE); }
  function cy(x) { return 327 - 1.2 * (x - BRIDGE) / (NUT - BRIDGE); }
  function YS(s, x) { return cy(x) + (3.5 - s) * sp(x); } // corda 6 (grave) em cima
  function hw(x) { return 2.5 * sp(x) + 6.5; }
  function top(x) { return cy(x) - hw(x); }
  function bot(x) { return cy(x) + hw(x); }
  function fretX(n) { return NUT - SCALE * (1 - Math.pow(2, -n / 12)); }
  function fretCenter(n) { return n <= 0 ? NUT + 11 : (fretX(n - 1) + fretX(n)) / 2; }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function Guitar(container, voice) {
    this.container = container; this.voice = voice || 'nylon'; this.nF = NF;
    this.build();
  }
  Guitar.prototype.fretX = fretX;
  Guitar.prototype.fretCenter = fretCenter;

  Guitar.prototype.line = function (s) {
    return 'M' + BRIDGE + ',' + YS(s, BRIDGE) + ' L' + NUT + ',' + YS(s, NUT);
  };

  Guitar.prototype.build = function () {
    var T = THEMES[this.voice], self = this, i, s, v = this.voice;
    this.container.innerHTML = '';
    var svg = el('svg', { viewBox: VX + ' ' + VY + ' ' + VW + ' ' + VH, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' }, this.container);
    svg.style.display = 'block'; this.svg = svg;
    var defs = el('defs', null, svg);
    var gr = el('radialGradient', { id: 'top' + v, cx: '38%', cy: '48%', r: '70%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.top0 }, gr);
    el('stop', { offset: '55%', 'stop-color': T.top1 }, gr);
    el('stop', { offset: '100%', 'stop-color': T.top2 }, gr);
    var gp = el('linearGradient', { id: 'bg' + v, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': T.panel }, gp);
    el('stop', { offset: '100%', 'stop-color': T.panel2 }, gp);
    var gs = el('radialGradient', { id: 'glow' + v, cx: '40%', cy: '55%', r: '65%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.accent, 'stop-opacity': 0.14 }, gs);
    el('stop', { offset: '100%', 'stop-color': T.accent, 'stop-opacity': 0 }, gs);
    el('rect', { x: VX, y: VY, width: VW, height: VH, fill: 'url(#bg' + v + ')' }, svg);
    el('rect', { x: VX, y: VY, width: VW, height: VH, fill: 'url(#glow' + v + ')' }, svg);

    /* ---- corpo ---- */
    var body = 'M535,262 C535,200 500,152 440,150 C400,148 370,160 335,160 C280,160 240,92 150,90 C70,88 22,170 22,320 L22,335 C22,485 70,567 150,565 C240,563 280,495 335,495 C370,495 400,507 440,505 C500,503 535,455 535,393 Z';
    el('path', { d: body, fill: '#000', stroke: '#050403', 'stroke-width': 14, 'stroke-linejoin': 'round' }, svg);
    el('path', { d: body, fill: 'url(#top' + v + ')', stroke: T.bind, 'stroke-width': 7, 'stroke-linejoin': 'round' }, svg);
    el('path', { d: body, fill: 'none', stroke: T.edge, 'stroke-width': 1.6, opacity: 0.8, transform: 'translate(280,327) scale(0.94,0.95) translate(-280,-327)' }, svg);
    el('path', { d: body, fill: 'none', stroke: T.bind, 'stroke-width': 1.4, opacity: 0.7, transform: 'translate(280,327) scale(0.955,0.96) translate(-280,-327)' }, svg);

    // boca, anéis e arabesco
    var hcx = 310, hcy = 326;
    if (T.guard) el('path', { d: 'M338,384 C392,372 462,386 496,420 C446,436 376,434 338,384 Z', fill: T.guard, opacity: 0.85 }, svg);
    el('circle', { cx: hcx, cy: hcy, r: 71, fill: 'none', stroke: T.bind, 'stroke-width': 1.6, 'stroke-dasharray': '3 4', opacity: 0.85 }, svg);
    el('circle', { cx: hcx, cy: hcy, r: 62, fill: 'none', stroke: T.ring, 'stroke-width': 4 }, svg);
    el('circle', { cx: hcx, cy: hcy, r: 57, fill: T.hole, stroke: T.bind, 'stroke-width': 2.5 }, svg);
    el('path', { d: 'M240,368 C262,432 200,488 160,468 C138,452 150,420 178,426 C196,432 196,452 180,452', fill: 'none', stroke: T.bind, 'stroke-width': 2.6, 'stroke-linecap': 'round', opacity: 0.9 }, svg);

    // cavalete
    var by1 = YS(6, BRIDGE) - 30, by2 = YS(1, BRIDGE) + 31;
    el('rect', { x: 105, y: by1, width: 38, height: by2 - by1, rx: 9, fill: T.bridge, stroke: T.bind, 'stroke-width': 3 }, svg);
    el('line', { x1: 132, x2: 132, y1: YS(6, BRIDGE) - 2, y2: YS(1, BRIDGE) + 2, stroke: T.bind, 'stroke-width': 3, opacity: 0.55 }, svg);
    for (s = 1; s <= 6; s++) el('circle', { cx: BRIDGE, cy: YS(s, BRIDGE), r: 3.8, fill: T.bind }, svg);

    /* ---- braço ---- */
    var fx0 = fretX(this.nF);
    var pts = [[fx0, top(fx0)], [NUT, top(NUT)], [NUT, bot(NUT)], [fx0, bot(fx0)]].map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
    el('polygon', { points: pts, fill: T.board, stroke: T.bind, 'stroke-opacity': 0.35, 'stroke-width': 1.5 }, svg);
    // marcações
    NUMS.forEach(function (n) {
      var cx = fretCenter(n), c = cy(cx);
      if (n === 12) { el('circle', { cx: cx, cy: c - 22, r: 5.2, fill: T.inlay, opacity: 0.85 }, svg); el('circle', { cx: cx, cy: c + 22, r: 5.2, fill: T.inlay, opacity: 0.85 }, svg); }
      else el('circle', { cx: cx, cy: c, r: 5.2, fill: T.inlay, opacity: 0.85 }, svg);
    });
    // trastes
    for (i = 1; i <= this.nF; i++) {
      var fxx = fretX(i);
      el('line', { x1: fxx, x2: fxx, y1: top(fxx), y2: bot(fxx), stroke: T.fret, 'stroke-width': 1.7, opacity: 0.85 }, svg);
    }
    // números (acima do braço)
    NUMS.forEach(function (n) {
      var cx = fretCenter(n);
      el('text', { x: cx, y: top(cx) - 12, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 21, 'font-weight': 'bold', fill: T.label, stroke: T.panel2, 'stroke-width': 4, 'paint-order': 'stroke', opacity: 0.9 }, svg).textContent = n;
    });
    // pestana
    el('rect', { x: NUT - 5, y: top(NUT) - 3, width: 10, height: bot(NUT) - top(NUT) + 6, rx: 3, fill: T.nut }, svg);

    /* ---- cabeça ---- */
    var hx0 = NUT + 2, hy0 = 258, hy1 = 392, hx1 = 1056;
    var headP = 'M' + hx0 + ',' + hy0 + ' L1022,' + hy0 + ' Q' + hx1 + ',' + hy0 + ' ' + hx1 + ',292 L' + hx1 + ',358 Q' + hx1 + ',' + hy1 + ' 1022,' + hy1 + ' L' + hx0 + ',' + hy1 + ' Z';
    var px = [947, 981, 1013];
    for (i = 0; i < 3; i++) {
      el('rect', { x: px[i] - 4, y: 238, width: 8, height: 24, fill: T.peg, opacity: 0.85 }, svg);
      el('rect', { x: px[i] - 4, y: 388, width: 8, height: 32, fill: T.peg, opacity: 0.85 }, svg);
      el('ellipse', { cx: px[i], cy: 230, rx: 14, ry: 10, fill: T.peg, stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 2 }, svg);
      el('ellipse', { cx: px[i], cy: 425, rx: 14, ry: 10, fill: T.peg, stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 2 }, svg);
    }
    el('path', { d: headP, fill: T.head, stroke: '#000', 'stroke-width': 3 }, svg);
    el('path', { d: headP, fill: 'none', stroke: T.bind, 'stroke-width': 1.4, opacity: 0.75, transform: 'translate(978,325) scale(0.93,0.9) translate(-978,-325)' }, svg);

    /* ---- cordas ---- */
    var postY = { 6: 302, 5: 302, 4: 302, 3: 351, 2: 351, 1: 351 };
    var postX = { 6: 1013, 5: 981, 4: 947, 3: 947, 2: 981, 1: 1013 };
    this.strPath = []; this.glow = []; this.vib = []; this.lbl = [];
    var W = v === 'aco' ? [1.2, 1.6, 2.1, 2.8, 3.4, 4.0] : [1.6, 2.0, 2.5, 2.9, 3.3, 3.7];
    for (s = 1; s <= 6; s++) {
      var wound = s >= 4, col = wound ? T.woundStr : T.trebleStr;
      el('line', { x1: NUT, y1: YS(s, NUT), x2: postX[s], y2: postY[s], stroke: col, 'stroke-width': Math.max(1.2, W[s - 1] * 0.7), opacity: 0.85 }, svg);
      el('circle', { cx: postX[s], cy: postY[s], r: 4.8, fill: T.peg, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 1.2 }, svg);
    }
    // brilho de corda tocada (acento)
    for (s = 1; s <= 6; s++) this.glow[s] = el('path', { d: this.line(s), stroke: T.accent, 'stroke-width': W[s - 1] + 7, fill: 'none', 'stroke-linecap': 'round', opacity: 0 }, svg);
    for (s = 1; s <= 6; s++) {
      var wd = s >= 4;
      this.strPath[s] = el('path', { d: this.line(s), stroke: wd ? T.woundStr : T.trebleStr, 'stroke-width': W[s - 1], fill: 'none', 'stroke-linecap': 'round', opacity: (v === 'nylon' && !wd) ? 0.9 : 1 }, svg);
      this.lbl[s] = el('text', { x: NUT + 15, y: YS(s, NUT) + 7, 'font-family': FONT, 'font-size': 20, 'font-weight': 'bold', fill: T.label, opacity: 0.75 }, svg);
      this.lbl[s].textContent = LABELS[s];
    }

    // pestana (barre)
    this.barre = el('rect', { x: 0, y: 0, width: 0, height: 0, rx: 14, fill: LF_COL[1], opacity: 0 }, svg);
    // dedos da mão esquerda
    this.lf = {};
    for (i = 1; i <= 4; i++) {
      var g = el('g', { opacity: 0 }, svg);
      g.style.transition = 'transform .1s ease-out, opacity .08s';
      el('circle', { r: 14, fill: LF_COL[i], stroke: '#fff', 'stroke-width': 2.6 }, g);
      el('text', { y: 7, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 19, 'font-weight': 'bold', fill: '#fff' }, g).textContent = i;
      this.lf[i] = g;
    }
    // corda solta (anel com 0 na pestana)
    this.openR = [];
    for (s = 1; s <= 6; s++) {
      var go = el('g', { opacity: 0, transform: 'translate(' + fretCenter(0) + ',' + YS(s, fretCenter(0)) + ')' }, svg);
      el('circle', { r: 12.5, fill: '#00000066', stroke: T.accent, 'stroke-width': 3 }, go);
      el('text', { y: 6.5, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 17, 'font-weight': 'bold', fill: '#fff' }, go).textContent = '0';
      this.openR[s] = go;
    }
    // marcas do ponteio (mão direita) sobre a boca
    this.pluckX = 300;
    this.rfMark = [];
    for (s = 1; s <= 6; s++) {
      var gm = el('g', { opacity: 0 }, svg);
      el('circle', { r: 14.5, fill: '#fff', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 2 }, gm);
      var tt = el('text', { y: 7.5, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 21, 'font-weight': 'bold', fill: '#fff' }, gm);
      this.rfMark[s] = { g: gm, t: tt, c: gm.firstChild };
    }

    // legendas (canto superior direito)
    this.rfLeg = {};
    el('text', { x: 590, y: 111, 'font-family': FONT, 'font-size': 18, fill: T.label, opacity: 0.85 }, svg).textContent = 'Mão direita';
    ['p', 'i', 'm', 'a'].forEach(function (f, k) {
      var gg = el('g', { transform: 'translate(' + (772 + k * 42) + ',104)' }, svg);
      var c = el('circle', { r: 16, fill: RF_COL[f], opacity: 0.3, stroke: '#fff', 'stroke-width': 1.8 }, gg);
      el('text', { y: 7.5, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 21, 'font-weight': 'bold', fill: '#fff' }, gg).textContent = f;
      self.rfLeg[f] = { c: c, g: gg, k: k };
    });
    el('text', { x: 590, y: 159, 'font-family': FONT, 'font-size': 18, fill: T.label, opacity: 0.85 }, svg).textContent = 'Mão esquerda';
    for (i = 1; i <= 4; i++) {
      var lg = el('g', { transform: 'translate(' + (772 + (i - 1) * 42) + ',152)' }, svg);
      el('circle', { r: 14, fill: LF_COL[i], stroke: '#fff', 'stroke-width': 2, opacity: 0.95 }, lg);
      el('text', { y: 7, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 18, 'font-weight': 'bold', fill: '#fff' }, lg).textContent = i;
    }
    // capotraste
    this.capoEl = el('rect', { x: 0, y: 0, width: 20, height: 10, rx: 7, fill: '#9a9a9a', stroke: '#444', 'stroke-width': 2, opacity: 0 }, svg);
  };

  Guitar.prototype.setCapo = function (c) {
    if (c > 0) {
      var x = fretX(Math.min(c, this.nF)) + 9;
      var y1 = top(x) - 6, y2 = bot(x) + 6;
      this.capoEl.setAttribute('x', x - 10); this.capoEl.setAttribute('y', y1); this.capoEl.setAttribute('height', y2 - y1); this.capoEl.setAttribute('opacity', 0.92);
    } else this.capoEl.setAttribute('opacity', 0);
  };

  Guitar.prototype.setHeld = function (st) {
    var used = {}, i, h;
    if (st) {
      for (i = 0; i < st.held.length; i++) {
        h = st.held[i];
        var g = this.lf[h.n]; if (!g) continue;
        used[h.n] = true;
        var x = fretCenter(h.f), y = YS(h.s, x);
        g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        g.setAttribute('opacity', 1);
        g.firstChild.setAttribute('r', (Math.min(15, sp(x) * 0.56) * (h.mel ? 1.1 : 1)).toFixed(1));
      }
      if (st.barre) {
        var b = st.barre, xm = fretCenter(b.f);
        var y1 = YS(b.s2, xm) - 13, y2 = YS(b.s1, xm) + 13;
        this.barre.setAttribute('x', xm - 12); this.barre.setAttribute('width', 24);
        this.barre.setAttribute('y', y1); this.barre.setAttribute('height', y2 - y1);
        this.barre.setAttribute('opacity', 0.9);
      } else this.barre.setAttribute('opacity', 0);
    } else this.barre.setAttribute('opacity', 0);
    for (i = 1; i <= 4; i++) if (!used[i]) this.lf[i].setAttribute('opacity', 0);
  };

  Guitar.prototype.frame = function (st, plucks, now) {
    this.setHeld(st);
    var s, amp = {}, active = {}, strActive = {}, k;
    for (k = 0; k < plucks.length; k++) {
      var p = plucks[k];
      if (!(p.s in amp) || p.age < amp[p.s].age) amp[p.s] = { age: p.age, hand: p.hand, f: p.f };
      if (p.age < 0.22) { active[p.hand] = 1; strActive[p.s] = p; }
    }
    for (s = 1; s <= 6; s++) {
      var a = amp[s];
      if (a && a.age < 1.6) {
        var A = 7 * Math.exp(-a.age * 3.2) * Math.sin(a.age * 2 * Math.PI * (14 + (7 - s) * 1.5));
        var mx = 480, my = YS(s, mx) + A;
        var d = 'M' + BRIDGE + ',' + YS(s, BRIDGE) + ' Q' + mx + ',' + my + ' ' + NUT + ',' + YS(s, NUT);
        this.strPath[s].setAttribute('d', d);
        this.glow[s].setAttribute('d', d);
        this.glow[s].setAttribute('opacity', Math.max(0, 0.55 * Math.exp(-a.age * 2.6)).toFixed(2));
        this.vib[s] = true;
      } else if (this.vib[s]) {
        var d0 = this.line(s);
        this.strPath[s].setAttribute('d', d0); this.glow[s].setAttribute('d', d0); this.glow[s].setAttribute('opacity', 0);
        this.vib[s] = false;
      }
      // corda solta: anel "0" na pestana
      var isOpen = a && a.f === 0 && a.age < 0.45;
      this.openR[s].setAttribute('opacity', isOpen ? Math.min(1, 1.3 - a.age * 2) : 0);
      this.lbl[s].setAttribute('opacity', a && a.age < 0.45 ? 1 : 0.75);
      var m = this.rfMark[s], pk = strActive[s];
      if (pk) {
        var sc = 1 + 0.25 * (1 - pk.age / 0.22);
        m.g.setAttribute('transform', 'translate(' + this.pluckX + ',' + YS(s, this.pluckX) + ') scale(' + sc.toFixed(2) + ')');
        m.g.setAttribute('opacity', Math.min(1, 1.2 - pk.age * 3));
        m.c.setAttribute('fill', RF_COL[pk.hand]);
        m.t.textContent = pk.hand;
      } else m.g.setAttribute('opacity', 0);
    }
    for (var f in this.rfLeg) {
      var L = this.rfLeg[f];
      L.c.setAttribute('opacity', active[f] ? 1 : 0.3);
      L.g.setAttribute('transform', 'translate(' + (772 + L.k * 42) + ',104)' + (active[f] ? ' scale(1.18)' : ''));
    }
  };

  root.GuitarView = Guitar;
})(window);
