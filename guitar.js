/* guitar.js — violão animado (SVG) visto de frente, como se alguém tocasse diante do usuário:
 * corpo à esquerda, braço para a direita com a cabeça à direita, cordas graves em cima (E A D G B e).
 * Mão esquerda: dedos 1-4. Mão direita: p i m a. Duas aparências: 'nylon' e 'aco'.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var VW = 1920, VH = 420;
  var NUT = 1600, BRIDGE = 150;
  var LF_COL = { 1: '#e2483c', 2: '#2f80d8', 3: '#2fa752', 4: '#e5a21d' };
  var RF_COL = { p: '#c0482a', i: '#2b86b8', m: '#35a24b', a: '#d9a21b' };
  var LABELS = ['', 'e', 'B', 'G', 'D', 'A', 'E'];

  var THEMES = {
    nylon: {
      panel: '#3a2616', panel2: '#241509', top0: '#f2d394', top1: '#d9a352', top2: '#a8702c', edge: '#6b3f17', bind: '#f4e6c2',
      board: '#2b1a10', neck: '#8a5a2b', fret: '#e1dccf', nut: '#f3ead2', inlay: '#e6d9b8', trebleStr: '#f3eedd', woundStr: '#d7cfae',
      hole: '#1a0f08', rosette: ['#6b3a16', '#f0dfae', '#2a5a7a', '#f0dfae'], bridge: '#2a1a10', head: '#2b1a10', label: '#f6ecd2', accent: '#f0c060', peg: '#efe4c4'
    },
    aco: {
      panel: '#0f1a26', panel2: '#070d14', top0: '#f2b650', top1: '#b8561d', top2: '#2e0f06', edge: '#1a0803', bind: '#f7f0df',
      board: '#12100e', neck: '#4a2c18', fret: '#cfd8e0', nut: '#eef2f4', inlay: '#e6f0f7', trebleStr: '#e5ebf0', woundStr: '#c68a4a',
      hole: '#0b0504', rosette: ['#111', '#f2f2f2', '#111'], bridge: '#1c110c', head: '#14100e', label: '#dbe9f5', accent: '#6db6ff', peg: '#c9d3dc'
    }
  };

  /* geometria com perspectiva: u=0 na pestana (longe), u=1 no cavalete (perto) */
  function U(x) { return (NUT - x) / (NUT - BRIDGE); }
  function SP(x) { return 22 + 15 * U(x); }
  function CY(x) { return 188 + 30 * U(x); }
  function Y(s, x) { return CY(x) + (s - 3.5) * SP(x); } // corda 6 em cima, corda 1 embaixo
  // s: 1 (aguda) .. 6 (grave) -> y crescente quando s diminui (grave em cima)
  function YS(s, x) { return CY(x) + (3.5 - s) * SP(x); }

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

  Guitar.prototype.fretX = function (n) {
    var span = NUT - 690;
    var Lk = span / (1 - Math.pow(2, -this.nF / 12));
    return NUT - Lk * (1 - Math.pow(2, -n / 12));
  };
  Guitar.prototype.fretCenter = function (n) {
    if (n <= 0) return NUT + 16;
    return (this.fretX(n - 1) + this.fretX(n)) / 2;
  };
  Guitar.prototype.sy = function (s, x) { return YS(s, x); };

  Guitar.prototype.build = function () {
    var T = THEMES[this.voice], self = this, i, s, v = this.voice;
    this.container.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + VW + ' ' + VH, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' }, this.container);
    svg.style.display = 'block'; this.svg = svg;
    var defs = el('defs', null, svg);
    var gr = el('radialGradient', { id: 'top' + v, cx: '42%', cy: '45%', r: '70%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.top0 }, gr);
    el('stop', { offset: '55%', 'stop-color': T.top1 }, gr);
    el('stop', { offset: '100%', 'stop-color': T.top2 }, gr);
    var gp = el('linearGradient', { id: 'bg' + v, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': T.panel }, gp);
    el('stop', { offset: '100%', 'stop-color': T.panel2 }, gp);
    var gs = el('radialGradient', { id: 'glow' + v, cx: '40%', cy: '60%', r: '60%' }, defs);
    el('stop', { offset: '0%', 'stop-color': T.accent, 'stop-opacity': 0.12 }, gs);
    el('stop', { offset: '100%', 'stop-color': T.accent, 'stop-opacity': 0 }, gs);
    el('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'url(#bg' + v + ')' }, svg);
    el('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'url(#glow' + v + ')' }, svg);

    /* ---- cabeça (à direita) ---- */
    var hx0 = NUT + 4, hy = CY(NUT), hw0 = SP(NUT) * 3.3;
    var head = v === 'aco'
      ? 'M' + hx0 + ',' + (hy - hw0) + ' L' + (hx0 + 200) + ',' + (hy - hw0 - 24) + ' Q' + (hx0 + 262) + ',' + (hy - hw0 - 22) + ' ' + (hx0 + 266) + ',' + (hy - hw0 + 14) + ' L' + (hx0 + 266) + ',' + (hy + hw0 - 14) + ' Q' + (hx0 + 262) + ',' + (hy + hw0 + 22) + ' ' + (hx0 + 200) + ',' + (hy + hw0 + 24) + ' L' + hx0 + ',' + (hy + hw0) + ' Z'
      : 'M' + hx0 + ',' + (hy - hw0) + ' L' + (hx0 + 210) + ',' + (hy - hw0 - 16) + ' Q' + (hx0 + 270) + ',' + (hy - hw0 - 14) + ' ' + (hx0 + 270) + ',' + (hy - hw0 + 30) + ' L' + (hx0 + 270) + ',' + (hy + hw0 - 30) + ' Q' + (hx0 + 270) + ',' + (hy + hw0 + 14) + ' ' + (hx0 + 210) + ',' + (hy + hw0 + 16) + ' L' + hx0 + ',' + (hy + hw0) + ' Z';
    // pinos (3 + 3, como no violão clássico visto de frente)
    for (i = 0; i < 3; i++) {
      var px = hx0 + 70 + i * 62;
      el('rect', { x: px - 5, y: hy - hw0 - 34, width: 10, height: 34, fill: T.peg, opacity: 0.8 }, svg);
      el('rect', { x: px - 5, y: hy + hw0 + 2, width: 10, height: 34, fill: T.peg, opacity: 0.8 }, svg);
      el('ellipse', { cx: px, cy: hy - hw0 - 40, rx: 17, ry: 12, fill: T.peg, stroke: '#00000055', 'stroke-width': 2 }, svg);
      el('ellipse', { cx: px, cy: hy + hw0 + 42, rx: 17, ry: 12, fill: T.peg, stroke: '#00000055', 'stroke-width': 2 }, svg);
    }
    el('path', { d: head, fill: T.head, stroke: T.bind, 'stroke-width': 3, 'stroke-opacity': 0.6 }, svg);
    for (i = 0; i < 3; i++) {
      el('circle', { cx: hx0 + 70 + i * 62, cy: hy - hw0 + 18, r: 8, fill: '#00000066' }, svg);
      el('circle', { cx: hx0 + 70 + i * 62, cy: hy + hw0 - 18, r: 8, fill: '#00000066' }, svg);
    }

    /* ---- corpo (à esquerda) ---- */
    var body = 'M800,128 C770,128 748,90 690,84 C640,80 612,108 586,122 C548,142 520,62 360,46 C230,34 110,56 66,122 C40,162 40,200 40,218 C40,236 40,274 66,314 C110,380 230,402 360,390 C520,374 548,294 586,314 C612,328 640,356 690,352 C748,346 770,308 800,308 Z';
    el('path', { d: body, fill: T.edge, transform: 'translate(0,6)' }, svg);
    el('path', { d: body, fill: 'url(#top' + v + ')' }, svg);
    el('path', { d: body, fill: 'none', stroke: T.bind, 'stroke-width': 7, 'stroke-linejoin': 'round' }, svg);
    el('path', { d: body, fill: 'none', stroke: T.edge, 'stroke-width': 2, 'stroke-opacity': 0.7, transform: 'translate(420,218) scale(0.93,0.9) translate(-420,-218)' }, svg);
    // pescoço sob o corpo
    var nTopX = 690;
    // braço (madeira) e escala
    var edge = function (x, sgn) { return CY(x) + sgn * SP(x) * 3.05; };
    var neckPts = [[790, -1], [NUT + 6, -1], [NUT + 6, 1], [790, 1]].map(function (p) { return p[0] + ',' + edge(p[0], p[1]); }).join(' ');
    el('polygon', { points: neckPts, fill: T.neck }, svg);
    var fx0 = this.fretX(this.nF) - 26;
    var boardPts = [[fx0, -1], [NUT, -1], [NUT, 1], [fx0, 1]].map(function (p) { return p[0] + ',' + edge(p[0], p[1]); }).join(' ');
    var gb = el('linearGradient', { id: 'bd' + v, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': T.board }, gb);
    el('stop', { offset: '50%', 'stop-color': v === 'aco' ? '#26201b' : '#46291a' }, gb);
    el('stop', { offset: '100%', 'stop-color': T.board }, gb);
    el('polygon', { points: boardPts, fill: 'url(#bd' + v + ')', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 2 }, svg);

    // boca e rosácea
    var hcx = 370, hcy = 216, hr = v === 'aco' ? 74 : 66;
    el('circle', { cx: hcx, cy: hcy, r: hr, fill: T.hole }, svg);
    T.rosette.forEach(function (c, k) { el('circle', { cx: hcx, cy: hcy, r: hr + 5 + k * 5, fill: 'none', stroke: c, 'stroke-width': 3.5 }, svg); });
    // arabesco decorativo
    el('path', { d: 'M262,336 C186,336 150,280 198,248 C222,232 252,246 244,270', fill: 'none', stroke: T.bind, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.8 }, svg);
    if (v === 'aco') el('path', { d: 'M468,266 C520,250 572,262 590,292 C540,298 498,292 468,266 Z', fill: '#2a120a', opacity: 0.75 }, svg);
    // cavalete
    var bx = BRIDGE;
    var by1 = YS(6, bx) - 36, by2 = YS(1, bx) + 36;
    el('rect', { x: bx - 26, y: by1, width: 46, height: by2 - by1, rx: 10, fill: T.bridge }, svg);
    el('rect', { x: bx - 8, y: by1 + 8, width: 10, height: by2 - by1 - 16, rx: 5, fill: '#f3e9cf', opacity: 0.3 }, svg);
    for (s = 1; s <= 6; s++) el('circle', { cx: bx - 12, cy: YS(s, bx), r: 4.2, fill: v === 'aco' ? '#f0e8d8' : '#e8dcc0' }, svg);

    // marcações (inlays) e trastes
    [3, 5, 7, 9, 12, 15].forEach(function (n) {
      if (n > self.nF) return;
      var cx = self.fretCenter(n), cy = CY(cx);
      if (n === 12) { el('circle', { cx: cx, cy: cy - SP(cx) * 1.1, r: 6.5, fill: T.inlay, opacity: 0.9 }, svg); el('circle', { cx: cx, cy: cy + SP(cx) * 1.1, r: 6.5, fill: T.inlay, opacity: 0.9 }, svg); }
      else el('circle', { cx: cx, cy: cy, r: 7, fill: T.inlay, opacity: 0.9 }, svg);
    });
    el('line', { x1: NUT, x2: NUT, y1: edge(NUT, -1) - 1, y2: edge(NUT, 1) + 1, stroke: T.nut, 'stroke-width': 11, 'stroke-linecap': 'round' }, svg);
    for (i = 1; i <= this.nF; i++) {
      var fxx = this.fretX(i);
      el('line', { x1: fxx, x2: fxx, y1: edge(fxx, -1), y2: edge(fxx, 1), stroke: T.fret, 'stroke-width': 3.4, opacity: 0.9 }, svg);
    }
    // números das casas — acima do braço, como no modelo
    for (i = 1; i <= this.nF; i++) {
      var cxn = this.fretCenter(i);
      var strong = [3, 5, 7, 9, 12, 15].indexOf(i) >= 0;
      el('text', { x: cxn, y: edge(cxn, -1) - 12, 'text-anchor': 'middle', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': strong ? 24 : 18, 'font-weight': strong ? 'bold' : 'normal', fill: T.label, opacity: strong ? 0.9 : 0.5 }, svg).textContent = i;
    }

    // linha de ponteio (mão direita) entre a boca e o braço
    this.pluckX = 590;
    el('line', { x1: this.pluckX, x2: this.pluckX, y1: YS(6, this.pluckX) - 30, y2: YS(1, this.pluckX) + 30, stroke: T.accent, 'stroke-width': 2, 'stroke-dasharray': '6 8', opacity: 0.4 }, svg);

    // cordas
    this.strPath = []; this.vib = [];
    var tailX = NUT + 120;
    for (s = 1; s <= 6; s++) {
      var wound = s >= 4;
      var w = (v === 'aco' ? [1.4, 1.8, 2.4, 3.1, 3.9, 4.7] : [2.4, 2.8, 3.3, 3.4, 3.9, 4.4])[s - 1];
      var col = wound ? T.woundStr : T.trebleStr;
      el('line', { x1: NUT, x2: tailX, y1: YS(s, NUT), y2: YS(s, NUT) + (3.5 - s) * 2, stroke: col, 'stroke-width': Math.max(1.2, w * 0.7), opacity: 0.8 }, svg);
      var p = el('path', { d: this.line(s), stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', opacity: (v === 'nylon' && !wound) ? 0.85 : 1 }, svg);
      this.strPath[s] = p;
      if (wound) el('path', { d: this.line(s), stroke: '#000', 'stroke-width': 0.8, 'stroke-dasharray': '2 3', opacity: 0.35, fill: 'none' }, svg);
      el('text', { x: NUT + 26, y: YS(s, NUT) + 6, 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 19, 'font-weight': 'bold', fill: T.label, opacity: 0.85 }, svg).textContent = LABELS[s];
    }
    // pestana (barre)
    this.barre = el('rect', { x: 0, y: 0, width: 0, height: 0, rx: 16, fill: LF_COL[1], opacity: 0 }, svg);

    // dedos da mão esquerda
    this.lf = {};
    for (i = 1; i <= 4; i++) {
      var g = el('g', { opacity: 0 }, svg);
      g.style.transition = 'transform .1s ease-out, opacity .08s';
      el('circle', { r: 17, fill: LF_COL[i], stroke: '#fff', 'stroke-width': 3 }, g);
      var t = el('text', { y: 8, 'text-anchor': 'middle', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 22, 'font-weight': 'bold', fill: '#fff' }, g);
      t.textContent = i;
      this.lf[i] = g;
    }
    // marcas do ponteio por corda
    this.rfMark = [];
    for (s = 1; s <= 6; s++) {
      var gm = el('g', { opacity: 0 }, svg);
      el('circle', { r: 19, fill: '#fff', stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 2 }, gm);
      var tt = el('text', { y: 9, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 26, 'font-weight': 'bold', fill: '#fff' }, gm);
      this.rfMark[s] = { g: gm, t: tt, c: gm.firstChild };
    }
    // legenda
    this.rfLeg = {};
    el('text', { x: 40, y: 38, 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 20, fill: T.label, opacity: 0.85 }, svg).textContent = 'Mão direita';
    ['p', 'i', 'm', 'a'].forEach(function (f, k) {
      var gg = el('g', { transform: 'translate(' + (190 + k * 54) + ',32)' }, svg);
      var c = el('circle', { r: 20, fill: RF_COL[f], opacity: 0.3, stroke: '#fff', 'stroke-width': 2 }, gg);
      var tx = el('text', { y: 9, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-style': 'italic', 'font-size': 26, 'font-weight': 'bold', fill: '#fff' }, gg);
      tx.textContent = f;
      self.rfLeg[f] = { c: c, g: gg, k: k };
    });
    el('text', { x: 1560, y: 38, 'text-anchor': 'end', 'font-family': 'Trebuchet MS,Verdana,sans-serif', 'font-size': 20, fill: T.label, opacity: 0.85 }, svg).textContent = 'Mão esquerda (números = dedos)';
    this.capoEl = el('rect', { x: 0, y: 0, width: 22, height: 10, rx: 8, fill: '#9a9a9a', stroke: '#444', 'stroke-width': 2, opacity: 0 }, svg);
  };

  Guitar.prototype.line = function (s) {
    return 'M' + BRIDGE + ',' + YS(s, BRIDGE) + ' L' + NUT + ',' + YS(s, NUT);
  };

  Guitar.prototype.setCapo = function (c) {
    if (c > 0) {
      var x = this.fretX(Math.min(c, this.nF)) + 10;
      var y1 = CY(x) - SP(x) * 3.3, y2 = CY(x) + SP(x) * 3.3;
      this.capoEl.setAttribute('x', x - 11); this.capoEl.setAttribute('y', y1); this.capoEl.setAttribute('height', y2 - y1); this.capoEl.setAttribute('opacity', 0.92);
    } else this.capoEl.setAttribute('opacity', 0);
  };

  Guitar.prototype.setHeld = function (st) {
    var used = {}, i, h;
    if (st) {
      for (i = 0; i < st.held.length; i++) {
        h = st.held[i];
        var g = this.lf[h.n]; if (!g) continue;
        used[h.n] = true;
        var x = this.fretCenter(h.f), y = YS(h.s, x);
        g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        g.setAttribute('opacity', 1);
        var r = Math.min(19, SP(x) * 0.58) * (h.mel ? 1.1 : 1);
        g.firstChild.setAttribute('r', r.toFixed(1));
      }
      if (st.barre) {
        var b = st.barre, xm = this.fretCenter(b.f);
        var y1 = YS(b.s2, xm) - 15, y2 = YS(b.s1, xm) + 15;
        this.barre.setAttribute('x', xm - 14); this.barre.setAttribute('width', 28);
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
      if (!(p.s in amp) || p.age < amp[p.s].age) amp[p.s] = { age: p.age, hand: p.hand };
      if (p.age < 0.22) { active[p.hand] = 1; strActive[p.s] = p; }
    }
    for (s = 1; s <= 6; s++) {
      var a = amp[s];
      if (a && a.age < 1.6) {
        var A = 8 * Math.exp(-a.age * 3.2) * Math.sin(a.age * 2 * Math.PI * (14 + (7 - s) * 1.5));
        var mx = (this.pluckX + BRIDGE) / 2 + 150, my = (YS(s, mx)) + A;
        this.strPath[s].setAttribute('d', 'M' + BRIDGE + ',' + YS(s, BRIDGE) + ' Q' + mx + ',' + my + ' ' + NUT + ',' + YS(s, NUT));
        this.vib[s] = true;
      } else if (this.vib[s]) {
        this.strPath[s].setAttribute('d', this.line(s));
        this.vib[s] = false;
      }
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
      L.g.setAttribute('transform', 'translate(' + (190 + L.k * 54) + ',32)' + (active[f] ? ' scale(1.18)' : ''));
    }
  };

  root.GuitarView = Guitar;
})(window);
