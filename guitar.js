/* guitar.js — violão animado (SVG): mão esquerda (dedos 1-4) e mão direita (p i m a)
 * Duas aparências: 'nylon' (clássico, madeira clara) e 'aco' (folk, sunburst escuro).
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var VW = 1920, VH = 420;
  var NUT = 190, BRIDGE = 1768;
  var SY = function (s) { return 210 + (s - 3.5) * 34; };
  var LF_COL = { 1: '#e2483c', 2: '#2f80d8', 3: '#2fa752', 4: '#e5a21d' };
  var RF_COL = { p: '#c0482a', i: '#2b86b8', m: '#35a24b', a: '#d9a21b' };

  var THEMES = {
    nylon: {
      panel: '#3a2616', panel2: '#241509', top0: '#f0cf8d', top1: '#d49b4c', top2: '#a8702c', edge: '#7a4a1c',
      board: '#2b1a10', fret: '#d9d4c7', nut: '#efe6cf', inlay: '#e6d9b8', trebleStr: '#f3eedd', woundStr: '#cfc7a4',
      hole: '#1a0f08', rosette: ['#6b3a16', '#e9d7a8', '#2a5a7a', '#e9d7a8'], bridge: '#2a1a10', head: '#2b1a10', label: '#f6ecd2', accent: '#f0c060', pins: false
    },
    aco: {
      panel: '#0f1a26', panel2: '#070d14', top0: '#f1b24a', top1: '#b8561d', top2: '#2e0f06', edge: '#1a0803',
      board: '#12100e', fret: '#c9d3dc', nut: '#e9edf0', inlay: '#e6f0f7', trebleStr: '#e5ebf0', woundStr: '#c68a4a',
      hole: '#0b0504', rosette: ['#111', '#f2f2f2', '#111'], bridge: '#1c110c', head: '#14100e', label: '#dbe9f5', accent: '#6db6ff', pins: true
    }
  };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function Guitar(container, voice, nFrets) {
    this.container = container; this.voice = voice || 'nylon'; this.nF = Math.max(12, Math.min(15, nFrets || 12));
    this.build();
  }

  Guitar.prototype.fretX = function (n) { // posição da barra n (0 = pestana)
    var L = (BRIDGE - NUT - 480) / (1 - Math.pow(2, -this.nF / 12));
    // comprimento escalonado até a última casa
    var scaleEnd = 1250;
    var Lk = (scaleEnd - NUT) / (1 - Math.pow(2, -this.nF / 12));
    return NUT + Lk * (1 - Math.pow(2, -n / 12));
  };
  Guitar.prototype.fretCenter = function (n) {
    if (n <= 0) return NUT - 14;
    return (this.fretX(n - 1) + this.fretX(n)) / 2 + (n === 1 ? 2 : 0);
  };

  Guitar.prototype.build = function () {
    var T = THEMES[this.voice], self = this, i, s;
    this.container.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + VW + ' ' + VH, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' }, this.container);
    svg.style.display = 'block';
    this.svg = svg;
    var defs = el('defs', null, svg);
    var gr = el('radialGradient', { id: 'top' + this.voice, cx: '38%', cy: '50%', r: '75%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.top0 }, gr);
    el('stop', { offset: '55%', 'stop-color': T.top1 }, gr);
    el('stop', { offset: '100%', 'stop-color': T.top2 }, gr);
    var gb = el('linearGradient', { id: 'board' + this.voice, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': T.board }, gb);
    el('stop', { offset: '50%', 'stop-color': this.voice === 'aco' ? '#241e1a' : '#43291a' }, gb);
    el('stop', { offset: '100%', 'stop-color': T.board }, gb);
    var gp = el('linearGradient', { id: 'bg' + this.voice, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': T.panel }, gp);
    el('stop', { offset: '100%', 'stop-color': T.panel2 }, gp);
    el('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'url(#bg' + this.voice + ')' }, svg);

    // corpo
    var body = this.voice === 'aco'
      ? 'M1250,112 C1310,108 1340,50 1420,34 C1540,8 1700,10 1810,56 C1890,92 1910,160 1900,210 C1910,260 1890,328 1810,364 C1700,410 1540,412 1420,386 C1340,370 1310,312 1250,308 Z'
      : 'M1250,118 C1300,114 1330,72 1410,52 C1520,26 1670,24 1780,64 C1860,96 1884,160 1874,210 C1884,260 1860,324 1780,356 C1670,396 1520,394 1410,368 C1330,348 1300,306 1250,302 Z';
    el('path', { d: body, fill: T.edge, transform: 'translate(0,5)' }, svg);
    el('path', { d: body, fill: 'url(#top' + this.voice + ')', stroke: T.edge, 'stroke-width': 6 }, svg);
    // filetes
    el('path', { d: body, fill: 'none', stroke: this.voice === 'aco' ? '#f5efe0' : '#3a2412', 'stroke-width': 2, opacity: 0.55, transform: 'translate(0,0) scale(0.985) translate(14,3)' }, svg);
    // pestana do braço (cabeça)
    var hd = this.voice === 'aco'
      ? 'M18,150 L150,138 Q182,136 184,152 L184,268 Q182,284 150,282 L18,270 Q4,262 4,240 L4,180 Q4,158 18,150 Z'
      : 'M10,138 L166,142 Q186,144 186,160 L186,260 Q186,276 166,278 L10,282 Q2,282 2,270 L2,150 Q2,138 10,138 Z';
    el('path', { d: hd, fill: T.head, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 3 }, svg);
    // afinadores
    for (i = 0; i < 6; i++) {
      var ty = this.voice === 'aco' ? SY(i + 1) : (i < 3 ? 156 + i * 26 : 218 + (i - 3) * 26 + 0);
      var tx = this.voice === 'aco' ? 70 : 80;
      if (this.voice === 'nylon') { ty = i < 3 ? 160 + i * 30 : 250 - (i - 3) * 30; }
      el('circle', { cx: tx, cy: ty, r: 11, fill: '#c9c3b2', stroke: '#6d6759', 'stroke-width': 3 }, svg);
      el('rect', { x: tx - 3, y: ty - 3, width: 56, height: 6, fill: '#cfc9b9', opacity: 0.5 }, svg);
    }
    // braço
    var nTop = SY(1) - 26, nBot = SY(6) + 26;
    el('rect', { x: NUT, y: nTop, width: this.fretX(this.nF) - NUT + 20, height: nBot - nTop, fill: 'url(#board' + this.voice + ')' }, svg);
    el('rect', { x: this.fretX(this.nF), y: nTop + 4, width: 1250 - this.fretX(this.nF) + 20, height: nBot - nTop - 8, fill: 'url(#board' + this.voice + ')' }, svg);
    // marcações (inlays)
    [3, 5, 7, 9, 12, 15].forEach(function (n) {
      if (n > self.nF) return;
      var cx = self.fretCenter(n), cy = 210;
      if (n === 12) { el('circle', { cx: cx, cy: cy - 52, r: 9, fill: T.inlay, opacity: 0.85 }, svg); el('circle', { cx: cx, cy: cy + 52, r: 9, fill: T.inlay, opacity: 0.85 }, svg); }
      else el('circle', { cx: cx, cy: cy, r: 10, fill: T.inlay, opacity: 0.85 }, svg);
    });
    // traste
    el('rect', { x: NUT - 8, y: nTop - 2, width: 10, height: nBot - nTop + 4, fill: T.nut, rx: 3 }, svg);
    for (i = 1; i <= this.nF; i++) el('rect', { x: this.fretX(i) - 2.2, y: nTop, width: 4.4, height: nBot - nTop, fill: T.fret, opacity: 0.9 }, svg);
    // números das casas
    for (i = 1; i <= this.nF; i++) {
      el('text', { x: this.fretCenter(i), y: nBot + 30, 'text-anchor': 'middle', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 22, fill: T.label, opacity: 0.75 }, svg).textContent = i;
    }
    // boca
    var hx = 1545, hy = 210;
    el('circle', { cx: hx, cy: hy, r: this.voice === 'aco' ? 78 : 70, fill: T.hole }, svg);
    var rr = this.voice === 'aco' ? 78 : 70;
    T.rosette.forEach(function (c, k) { el('circle', { cx: hx, cy: hy, r: rr + 6 + k * 5, fill: 'none', stroke: c, 'stroke-width': 4 }, svg); });
    if (this.voice === 'aco') { // escudo (pickguard)
      el('path', { d: 'M1478,330 C1560,352 1650,330 1690,282 C1640,300 1560,308 1478,300 Z', fill: '#2a120a', opacity: 0.8 }, svg);
    }
    // cavalete
    if (this.voice === 'aco') {
      el('rect', { x: BRIDGE - 18, y: SY(1) - 34, width: 34, height: SY(6) - SY(1) + 68, rx: 10, fill: T.bridge }, svg);
      for (s = 1; s <= 6; s++) el('circle', { cx: BRIDGE - 22, cy: SY(s), r: 5, fill: '#f0e8d8' }, svg);
    } else {
      el('rect', { x: BRIDGE - 26, y: SY(1) - 40, width: 56, height: SY(6) - SY(1) + 80, rx: 12, fill: T.bridge }, svg);
      el('rect', { x: BRIDGE + 4, y: SY(1) - 30, width: 18, height: SY(6) - SY(1) + 60, rx: 8, fill: '#e8dcc0', opacity: 0.35 }, svg);
    }
    // linha de ponteio
    this.pluckX = 1672;
    el('line', { x1: this.pluckX, x2: this.pluckX, y1: SY(1) - 30, y2: SY(6) + 30, stroke: T.accent, 'stroke-width': 2, 'stroke-dasharray': '6 8', opacity: 0.45 }, svg);

    // cordas
    this.strPath = [];
    for (s = 1; s <= 6; s++) {
      var wound = s >= 4;
      var w = (this.voice === 'aco' ? [1.3, 1.7, 2.3, 3.0, 3.8, 4.6] : [2.4, 2.8, 3.3, 3.4, 3.9, 4.4])[s - 1];
      var col = wound ? T.woundStr : T.trebleStr;
      var p = el('path', { d: 'M' + NUT + ',' + SY(s) + ' L' + BRIDGE + ',' + SY(s), stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', opacity: this.voice === 'nylon' && !wound ? 0.82 : 1 }, svg);
      this.strPath[s] = p;
      if (wound) el('path', { d: 'M' + NUT + ',' + SY(s) + ' L' + BRIDGE + ',' + SY(s), stroke: '#000', 'stroke-width': 0.8, 'stroke-dasharray': '2 3', opacity: 0.35, fill: 'none' }, svg);
      el('text', { x: 205 - 30, y: SY(s) + 7, 'text-anchor': 'middle', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 20, fill: T.label, opacity: 0.0 }, svg);
    }
    // pestana (barre)
    this.barre = el('rect', { x: 0, y: 0, width: 0, height: 0, rx: 18, fill: LF_COL[1], opacity: 0 }, svg);
    this.barre.style.transition = 'opacity .1s';

    // dedos mão esquerda
    this.lf = {};
    for (i = 1; i <= 4; i++) {
      var g = el('g', { opacity: 0 }, svg);
      g.style.transition = 'transform .1s ease-out, opacity .08s';
      el('circle', { r: 19, fill: LF_COL[i], stroke: '#fff', 'stroke-width': 3 }, g);
      var t = el('text', { y: 8, 'text-anchor': 'middle', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 24, 'font-weight': 'bold', fill: '#fff' }, g);
      t.textContent = i;
      this.lf[i] = g;
    }
    // marcas de ponteio por corda (mão direita)
    this.rfMark = [];
    for (s = 1; s <= 6; s++) {
      var gm = el('g', { opacity: 0, transform: 'translate(' + this.pluckX + ',' + SY(s) + ')' }, svg);
      el('circle', { r: 20, fill: '#fff', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 2 }, gm);
      var tt = el('text', { y: 9, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 28, 'font-weight': 'bold', fill: '#fff' }, gm);
      this.rfMark[s] = { g: gm, t: tt, c: gm.firstChild };
    }
    // legenda mão direita (p i m a)
    this.rfLeg = {};
    ['p', 'i', 'm', 'a'].forEach(function (f, k) {
      var gx = 1500 + k * 90, gy = 400 - 26;
      var gg = el('g', { transform: 'translate(' + (1790 - 3 * 78 + k * 78 - 20) + ',46)' }, svg);
      var c = el('circle', { r: 21, fill: RF_COL[f], opacity: 0.35, stroke: '#fff', 'stroke-width': 2 }, gg);
      var tx = el('text', { y: 9, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 28, 'font-weight': 'bold', fill: '#fff' }, gg);
      tx.textContent = f;
      self.rfLeg[f] = { c: c, g: gg };
    });
    el('text', { x: 1790 - 3 * 78 - 20 - 34, y: 56, 'text-anchor': 'end', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 20, fill: T.label, opacity: 0.8 }, svg).textContent = 'Mão direita';
    el('text', { x: NUT + 4, y: 40, 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 20, fill: T.label, opacity: 0.8 }, svg).textContent = 'Mão esquerda (números = dedos)';
    this.capoEl = el('rect', { x: 0, y: nTop - 10, width: 20, height: nBot - nTop + 20, rx: 8, fill: '#8c8c8c', stroke: '#444', 'stroke-width': 2, opacity: 0 }, svg);
    this.vib = [];
    this.nTop = nTop; this.nBot = nBot;
    this.lastKey = '';
  };

  Guitar.prototype.setCapo = function (c) {
    if (c > 0) { var x = this.fretX(Math.min(c, this.nF)) - 14; this.capoEl.setAttribute('x', x); this.capoEl.setAttribute('opacity', 0.9); }
    else this.capoEl.setAttribute('opacity', 0);
  };

  /* estado da mão esquerda */
  Guitar.prototype.setHeld = function (st) {
    var key = st ? st.t + ':' + st.held.length : '';
    var used = {}, i, h;
    if (st) {
      for (i = 0; i < st.held.length; i++) {
        h = st.held[i];
        var g = this.lf[h.n]; if (!g) continue;
        used[h.n] = true;
        g.style.transform = 'translate(' + this.fretCenter(h.f) + 'px,' + SY(h.s) + 'px)';
        g.setAttribute('opacity', 1);
        g.firstChild.setAttribute('r', h.mel ? 21 : 19);
      }
      if (st.barre) {
        var b = st.barre, x1 = this.fretX(b.f - 1) + 4, x2 = this.fretX(b.f) - 4;
        var y1 = SY(b.s1) - 19, y2 = SY(b.s2) + 19;
        this.barre.setAttribute('x', (x1 + x2) / 2 - 17); this.barre.setAttribute('width', 34);
        this.barre.setAttribute('y', y1); this.barre.setAttribute('height', y2 - y1);
        this.barre.setAttribute('opacity', 0.9);
      } else this.barre.setAttribute('opacity', 0);
    } else this.barre.setAttribute('opacity', 0);
    for (i = 1; i <= 4; i++) if (!used[i]) this.lf[i].setAttribute('opacity', 0);
  };

  /* chamado a cada quadro: plucks = [{s,hand,age}] (age em segundos) */
  Guitar.prototype.frame = function (st, plucks, now) {
    this.setHeld(st);
    var s, amp = {}, active = {}, strActive = {};
    var k;
    for (k = 0; k < plucks.length; k++) {
      var p = plucks[k];
      if (!(p.s in amp) || p.age < amp[p.s].age) amp[p.s] = { age: p.age, hand: p.hand };
      if (p.age < 0.22) { active[p.hand] = 1; strActive[p.s] = p; }
    }
    for (s = 1; s <= 6; s++) {
      var a = amp[s], d;
      var y = SY(s);
      if (a && a.age < 1.6) {
        var A = 9 * Math.exp(-a.age * 3.2) * Math.sin(a.age * 2 * Math.PI * (14 + s * 1.5));
        var xm = (this.pluckX + NUT) / 2 + 260;
        d = 'M' + NUT + ',' + y + ' Q' + xm + ',' + (y + A) + ' ' + BRIDGE + ',' + y;
        this.strPath[s].setAttribute('d', d);
        this.vib[s] = true;
      } else if (this.vib[s]) {
        this.strPath[s].setAttribute('d', 'M' + NUT + ',' + y + ' L' + BRIDGE + ',' + y);
        this.vib[s] = false;
      }
      var m = this.rfMark[s];
      var pk = strActive[s];
      if (pk) {
        var sc = 1 + 0.25 * (1 - pk.age / 0.22);
        m.g.setAttribute('transform', 'translate(' + this.pluckX + ',' + y + ') scale(' + sc.toFixed(2) + ')');
        m.g.setAttribute('opacity', Math.min(1, 1.2 - pk.age * 3));
        m.c.setAttribute('fill', RF_COL[pk.hand]);
        m.t.textContent = pk.hand;
      } else m.g.setAttribute('opacity', 0);
    }
    for (var f in this.rfLeg) {
      this.rfLeg[f].c.setAttribute('opacity', active[f] ? 1 : 0.3);
      this.rfLeg[f].g.setAttribute('transform', this.rfLeg[f].g.getAttribute('transform').replace(/scale\([^)]*\)/, '') + (active[f] ? ' scale(1.15)' : ''));
    }
  };

  root.GuitarView = Guitar;
})(window);
