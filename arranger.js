/* arranger.js — motor de arranjo fingerstyle
 * Entrada: hino (do hinos.json) → saída: acordes com posição no violão, eventos
 * (dedos p/i/m/a, corda, casa), mão esquerda (dedos 1-4) e custo de dificuldade.
 * Funciona no navegador (window.Arranger) e no Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Arranger = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Q = 96;
  var OPEN = [0, 64, 59, 55, 50, 45, 40]; // corda 1..6 (MIDI)
  var QUAL = ['M', 'm', '7', 'm7', 'M7', 'dim', 'm7b5', 'dim7', 'aug', 'sus4', '6'];
  var IV = [
    [0, 4, 7], [0, 3, 7], [0, 4, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11],
    [0, 3, 6], [0, 3, 6, 10], [0, 3, 6, 9], [0, 4, 8], [0, 5, 7], [0, 4, 7, 9]
  ];
  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var SUFFIX = ['', 'm', '7', 'm7', 'maj7', 'dim', 'm7(b5)', 'dim7', 'aug', 'sus4', '6'];

  function mod(a, n) { return ((a % n) + n) % n; }

  function fifthsFromPc(pc) { var f = (pc * 7) % 12; if (f > 6) f -= 12; return f; }
  function pcName(pc, fifths) { return (fifths > 0 ? SHARP : FLAT)[mod(pc, 12)]; }
  function chordName(root, qi, fifths) { return pcName(root, fifths) + SUFFIX[qi]; }

  /* ---------- fingers (mão esquerda) ---------- */
  // notes: [{s,f}] com f>0 apenas. Retorna {fing:[], barre:{f,s1,s2}|null} ou null
  function assignFingers(notes, allNotesForOpenCheck) {
    var n = notes.length;
    if (!n) return { fing: [], barre: null };
    var minF = 99, maxF = 0, i;
    for (i = 0; i < n; i++) { if (notes[i].f < minF) minF = notes[i].f; if (notes[i].f > maxF) maxF = notes[i].f; }
    if (maxF - minF > 3) return null;
    var order = notes.map(function (x, k) { return k; }).sort(function (a, b) {
      return (notes[a].f - notes[b].f) || (notes[b].s - notes[a].s);
    });
    var fing = new Array(n);
    if (n <= 4) {
      for (i = 0; i < n; i++) fing[order[i]] = i + 1;
      // “posição natural”: se só há uma casa por dedo e o mínimo é >=2, mantém sequência
      return { fing: fing, barre: null };
    }
    // pestana no menor traste
    var low = order.filter(function (k) { return notes[k].f === minF; });
    if (low.length < 2) return null;
    var s1 = 99, s2 = 0;
    low.forEach(function (k) { s1 = Math.min(s1, notes[k].s); s2 = Math.max(s2, notes[k].s); });
    // cordas soltas dentro da pestana não são permitidas
    if (allNotesForOpenCheck) {
      for (i = 0; i < allNotesForOpenCheck.length; i++) {
        var o = allNotesForOpenCheck[i];
        if (o.f === 0 && o.s >= s1 && o.s <= s2) return null;
      }
    }
    var next = 2, cnt = 0;
    for (i = 0; i < n; i++) {
      var k = order[i];
      if (notes[k].f === minF) fing[k] = 1;
      else { fing[k] = next++; cnt++; }
    }
    if (next - 1 > 4) return null;
    return { fing: fing, barre: { f: minF, s1: s1, s2: s2 } };
  }

  /* finger for a melody note given held shape notes [{s,f,n}] and optional barre */
  function melodyFinger(held, barre, s, f) {
    if (f === 0) {
      if (barre && s >= barre.s1 && s <= barre.s2) return -1;
      return 0;
    }
    var used = {}, i, h;
    var others = [];
    for (i = 0; i < held.length; i++) {
      h = held[i];
      if (h.s === s) continue;
      others.push(h);
      used[h.n] = true;
    }
    if (barre && s >= barre.s1 && s <= barre.s2 && f === barre.f) return 1;
    var minF = f, maxF = f;
    others.forEach(function (o) { if (o.f < minF) minF = o.f; if (o.f > maxF) maxF = o.f; });
    if (maxF - minF > 3) return -1;
    var natural = Math.max(1, Math.min(4, f - minF + 1));
    var best = -1, bestD = 99;
    for (var c = 1; c <= 4; c++) {
      if (used[c] && !(barre && c === 1 && false)) continue;
      var ok = true;
      for (i = 0; i < others.length; i++) {
        var o2 = others[i];
        if (f > o2.f && !(c > o2.n)) { ok = false; break; }
        if (f < o2.f && !(c < o2.n)) { ok = false; break; }
        if (f === o2.f && c === o2.n) { ok = false; break; }
      }
      if (!ok) continue;
      var d = Math.abs(c - natural);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /* ---------- shapes (formas de acorde) ---------- */
  var shapeCache = {};

  function buildShapes(root, qi, capo) {
    var key = root + '|' + qi + '|' + capo;
    if (shapeCache[key]) return shapeCache[key];
    var iv = IV[qi];
    var pcs = iv.map(function (x) { return mod(root + x, 12); });
    var third = pcs[1], fifth = pcs[2], seventh = pcs.length > 3 ? pcs[3] : -1;
    var out = [], seen = {};
    var bassCands = [];
    [6, 5, 4].forEach(function (b) {
      for (var fb = 0; fb <= 9; fb++) {
        if (mod(OPEN[b] + capo + fb, 12) === root) bassCands.push({ s: b, f: fb });
      }
    });
    bassCands.forEach(function (bc) {
      var windows = bc.f > 0 ? [Math.max(1, bc.f - 3), bc.f] : [1, 2, 3, 4, 5, 6, 7, 8];
      var wset = {};
      (bc.f > 0 ? [bc.f - 3, bc.f - 2, bc.f - 1, bc.f] : windows).forEach(function (w) { if (w >= 1) wset[w] = 1; });
      Object.keys(wset).forEach(function (wk) {
        var w = +wk;
        var inner = [];
        function rec(s, lastPitch) {
          if (s < 2) { finish(); return; }
          // opção: silenciar
          rec(s - 1, lastPitch);
          for (var f = 0; f <= 12; f++) {
            if (f > 0 && (f < w || f > w + 3)) continue;
            var p = OPEN[s] + capo + f;
            if (p <= lastPitch) continue;
            if (pcs.indexOf(mod(p, 12)) < 0) continue;
            inner.push({ s: s, f: f, p: p });
            rec(s - 1, p);
            inner.pop();
          }
        }
        function finish() {
          if (!inner.length) return;
          var pitches = inner.map(function (x) { return mod(x.p, 12); });
          var hasThird = pitches.indexOf(third) >= 0;
          var hasFifth = pitches.indexOf(fifth) >= 0;
          var hasSev = seventh >= 0 && pitches.indexOf(seventh) >= 0;
          var needThird = iv[1] !== 5 || true;
          var sig = bc.s + ':' + bc.f + '|' + inner.map(function (x) { return x.s + ':' + x.f; }).join(',');
          if (seen[sig]) return; seen[sig] = 1;
          var fretted = [{ s: bc.s, f: bc.f }].concat(inner.map(function (x) { return { s: x.s, f: x.f }; })).filter(function (x) { return x.f > 0; });
          var all = [{ s: bc.s, f: bc.f }].concat(inner.map(function (x) { return { s: x.s, f: x.f }; }));
          var af = assignFingers(fretted, all);
          if (!af) return;
          var cost = 0, nz = fretted.map(function (x) { return x.f; });
          var minNZ = nz.length ? Math.min.apply(null, nz) : 0, maxNZ = nz.length ? Math.max.apply(null, nz) : 0;
          cost += 1.0 * (maxNZ - minNZ);
          cost += 0.55 * minNZ + 0.2 * maxNZ;
          cost += 0.45 * fretted.length;
          if (af.barre) cost += 1.4;
          if (!hasThird) cost += 3.0;
          if (seventh >= 0 && !hasSev) cost += (qi === 10 ? 0.4 : 2.6);
          if (!hasFifth && qi !== 5 && qi !== 6 && qi !== 7 && qi !== 8) cost += 0.45;
          if (inner.length === 1) cost += 2.2; else if (inner.length === 2) cost += 0.55;
          if (bc.s === 4) cost += 0.45;
          if (bc.s === 6 && bc.f > 0) cost += 0.1;
          cost += 0.2 * bc.f;
          var open = inner.filter(function (x) { return x.f === 0; }).length + (bc.f === 0 ? 1 : 0);
          cost -= 0.25 * open;
          // lacunas de corda entre baixo e primeira interna
          var gap = bc.s - inner[0].s - 1; if (gap > 0) cost += 0.35 * gap;
          for (var j = 1; j < inner.length; j++) { var g2 = inner[j - 1].s - inner[j].s - 1; if (g2 > 0) cost += 0.5 * g2; }
          var shape = {
            sig: sig, cost: cost, bass: { s: bc.s, f: bc.f },
            inner: inner.map(function (x) { return { s: x.s, f: x.f, midi: x.p }; }),
            bassMidi: OPEN[bc.s] + capo + bc.f,
            fretted: fretted, fing: af.fing, barre: af.barre,
            anchor: minNZ
          };
          out.push(shape);
        }
        rec(bc.s - 1, OPEN[bc.s] + capo + bc.f);
      });
    });
    out.sort(function (a, b) { return a.cost - b.cost; });
    // diversidade: no máx 22 formas
    var res = out.slice(0, 22);
    // garante uma forma só-baixo (fallback)
    bassCands.forEach(function (bc) {
      var af = bc.f > 0 ? assignFingers([{ s: bc.s, f: bc.f }], null) : { fing: [], barre: null };
      res.push({
        sig: 'B' + bc.s + ':' + bc.f, cost: 6 + 0.3 * bc.f + (bc.s === 4 ? 0.3 : 0), bass: { s: bc.s, f: bc.f }, inner: [],
        bassMidi: OPEN[bc.s] + capo + bc.f, fretted: bc.f > 0 ? [{ s: bc.s, f: bc.f }] : [], fing: af.fing, barre: null, anchor: bc.f
      });
    });
    shapeCache[key] = res;
    return res;
  }

  /* ---------- opções de melodia ---------- */
  function melodyOptions(midi, capo) {
    var res = [];
    for (var s = 1; s <= 5; s++) {
      var f = midi - OPEN[s] - capo;
      if (f >= 0 && f <= (s === 1 ? 15 : 12)) res.push({ s: s, f: f });
    }
    if (!res.length) {
      for (var s2 = 1; s2 <= 6; s2++) {
        var f2 = midi - OPEN[s2] - capo;
        if (f2 >= 0 && f2 <= 22) res.push({ s: s2, f: f2 });
      }
    }
    return res;
  }

  function optionBaseCost(o) {
    var c = 0.13 * o.f;
    if (o.f === 0) c -= 0.4;
    if (o.s === 2) c += 0.15;
    else if (o.s === 3) c += 0.7;
    else if (o.s >= 4) c += 1.8;
    return c;
  }

  // feasibilidade de uma nota de melodia com uma forma
  function evalOption(shape, o) {
    if (o.s >= shape.bass.s) return null; // melodia abaixo do baixo
    var held = [];
    for (var i = 0; i < shape.fretted.length; i++) {
      var fr = shape.fretted[i];
      held.push({ s: fr.s, f: fr.f, n: 0 });
    }
    // dedos da forma
    var nz = 0;
    var all = [{ s: shape.bass.s, f: shape.bass.f }].concat(shape.inner.map(function (x) { return { s: x.s, f: x.f }; }));
    var hh = [];
    all.forEach(function (x) {
      if (x.f > 0) {
        // procura o dedo
        for (var k = 0; k < shape.fretted.length; k++) {
          if (shape.fretted[k].s === x.s && shape.fretted[k].f === x.f) { hh.push({ s: x.s, f: x.f, n: shape.fing[k] }); break; }
        }
      }
    });
    var conflicts = 0;
    for (var j = 0; j < shape.inner.length; j++) {
      if (shape.inner[j].s <= o.s) conflicts++;
    }
    var c = optionBaseCost(o) + 0.45 * conflicts;
    // melodia abaixo (grave) de notas internas = cruzamento
    var fing = melodyFinger(hh.filter(function (x) { return x.s !== o.s; }), shape.barre, o.s, o.f);
    if (fing < 0) return null;
    return { s: o.s, f: o.f, cost: c, fing: fing, conflicts: conflicts };
  }

  /* ---------- compasso/pulso ---------- */
  function measureInfo(h, density) {
    var ms = h.ms, starts = [], t = 0, ts = [4, 4], tempo = h.tp || 60, out = [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.b) ts = m.b;
      if (m.tp) tempo = m.tp;
      var num = ts[0], den = ts[1];
      var pulse, beat;
      if (den === 8 && num % 3 === 0 && num >= 6) { beat = 144; pulse = 48; }
      else if (den === 4 && num >= 6 && num % 3 === 0) { beat = 288; pulse = 96; }
      else if (den === 2) { beat = 192; pulse = 96; }
      else { beat = 96; pulse = (density === 'arpejo' && tempo <= 76) ? 48 : 96; }
      if (den === 8 && num % 3 === 0 && num >= 6 && density !== 'arpejo') pulse = 144;
      out.push({ t0: t, len: m.l, pad: m.p || 0, ts: ts.slice(), pulse: pulse, beat: beat, tempo: tempo, idx: i });
      t += m.l;
    }
    return out;
  }

  /* ---------- arranjo para um (T, capo) ---------- */
  function arrangeFor(h, T, capo, density) {
    var fifths = fifthsFromPc(mod(((h.k * 7) % 12 + 12) % 12 + T, 12));
    var minfo = measureInfo(h, density);
    var totalTicks = minfo.length ? minfo[minfo.length - 1].t0 + minfo[minfo.length - 1].len : 0;
    var mel = h.mel.map(function (r) { return { t: r[0], d: r[1], midi: r[2] + T, fer: r[3], ly: r[4] || null }; });

    // slots por compasso
    var slots = [];
    minfo.forEach(function (m) {
      var base = m.t0 - m.pad;
      for (var tt = base; tt < m.t0 + m.len - 0.5; tt += m.pulse) {
        if (tt >= m.t0 - 0.5) slots.push({ t: Math.round(tt), measureStart: m.idx > 0 && Math.abs(tt - m.t0) < 0.5, m: m.idx });
      }
    });

    var chords = h.ch.map(function (c) {
      return { t: c[0], d: c[1], root: mod(c[2] + T, 12), qi: c[3], bass: mod(c[4] + T, 12) };
    });
    // funde acordes idênticos adjacentes
    var merged = [];
    chords.forEach(function (c) {
      var l = merged[merged.length - 1];
      if (l && l.root === c.root && l.qi === c.qi && Math.abs(l.t + l.d - c.t) < 1) l.d += c.d; else merged.push(c);
    });
    chords = merged;

    var meloIdx = 0;
    var spans = chords.map(function (c) {
      var notes = [];
      for (var i = 0; i < mel.length; i++) {
        if (mel[i].t >= c.t - 0.5 && mel[i].t < c.t + c.d - 0.5) notes.push(i);
      }
      c.mel = notes;
      c.shapes = buildShapes(c.root, c.qi, capo);
      return c;
    });

    // avalia cada forma por trecho
    var K = spans.map(function (c) {
      return c.shapes.map(function (sh) {
        var nodes = c.mel.map(function (mi) {
          var opts = melodyOptions(mel[mi].midi, capo).map(function (o) { return evalOption(sh, o); }).filter(Boolean);
          return opts;
        });
        // Viterbi na melodia
        var cost = sh.cost, choice = [], bad = 0;
        var prev = null; // array of {cost, back, opt}
        var layers = [];
        for (var n = 0; n < nodes.length; n++) {
          var opts = nodes[n];
          if (!opts.length) {
            // sem opção viável: pega a melhor ignorando forma
            var raw = melodyOptions(mel[c.mel[n]].midi, capo);
            if (!raw.length) { var nl = [{ cost: 40 + (prev ? Math.min.apply(null, prev.map(function (x) { return x.cost; })) : 0), back: 0, opt: null }]; layers.push(nl); prev = nl; bad++; continue; }
            raw.sort(function (a, b) { return optionBaseCost(a) - optionBaseCost(b); });
            opts = [{ s: raw[0].s, f: raw[0].f, cost: optionBaseCost(raw[0]) + 9, fing: 0, hard: true, conflicts: 0 }];
            bad++;
          }
          var layer = opts.map(function (o) {
            var best = Infinity, bk = 0;
            if (!prev) { best = o.cost; }
            else {
              for (var pi = 0; pi < prev.length; pi++) {
                var po = prev[pi].opt;
                var tr = po ? (0.12 * Math.abs(po.f - o.f) + (po.s !== o.s ? 0.18 * Math.abs(po.s - o.s) : 0)) : 0;
                if (po && po.f > 0 && o.f > 0 && Math.abs(po.f - o.f) > 4) tr += 0.6;
                var v = prev[pi].cost + tr + o.cost;
                if (v < best) { best = v; bk = pi; }
              }
            }
            return { cost: best, back: bk, opt: o };
          });
          layers.push(layer); prev = layer;
        }
        if (layers.length) {
          var last = layers[layers.length - 1], bi = 0, bv = Infinity;
          for (var q = 0; q < last.length; q++) if (last[q].cost < bv) { bv = last[q].cost; bi = q; }
          cost += bv;
          for (var L = layers.length - 1; L >= 0; L--) { choice[L] = layers[L][bi].opt; bi = layers[L][bi].back; }
        }
        return { shape: sh, cost: cost, choice: choice, bad: bad };
      });
    });

    // Viterbi entre trechos
    var dp = [], total = 0;
    for (var i = 0; i < spans.length; i++) {
      var cur = K[i].map(function (st, j) {
        var best = Infinity, bk = -1;
        if (i === 0) best = st.cost;
        else {
          for (var pj = 0; pj < K[i - 1].length; pj++) {
            var pst = K[i - 1][pj], tr = 0;
            if (pst.shape.sig !== st.shape.sig) {
              tr = 0.35 * Math.abs((pst.shape.anchor || 0) - (st.shape.anchor || 0)) + 0.25;
            }
            var v = dp[i - 1][pj].cost + tr + st.cost;
            if (v < best) { best = v; bk = pj; }
          }
        }
        return { cost: best, back: bk };
      });
      dp.push(cur);
    }
    var pick = [];
    if (spans.length) {
      var li = dp.length - 1, bi2 = 0, bv2 = Infinity;
      dp[li].forEach(function (x, j) { if (x.cost < bv2) { bv2 = x.cost; bi2 = j; } });
      total = bv2;
      for (var L2 = li; L2 >= 0; L2--) { pick[L2] = bi2; bi2 = dp[L2][bi2].back; }
    }
    var badTotal = 0;
    pick.forEach(function (pj, i) { badTotal += K[i][pj].bad; });

    // ---- geração de eventos ----
    var events = [];
    var maxFret = 0;
    var vOf = { 6: 'p', 5: 'p', 4: 'p', 3: 'i', 2: 'm', 1: 'a' };
    var melodyAt = []; // por índice de melodia: {s,f,fing}
    var outChords = [];

    spans.forEach(function (c, i) {
      var st = K[i][pick[i]];
      var sh = st.shape;
      var chordObj = {
        t: c.t, d: c.d, root: c.root, qi: c.qi, name: chordName(c.root, c.qi, fifths),
        shape: { bass: sh.bass, inner: sh.inner.map(function (x) { return { s: x.s, f: x.f }; }), fretted: sh.fretted, fing: sh.fing, barre: sh.barre }
      };
      // dedos por nota da forma
      var shapeHeld = [];
      sh.fretted.forEach(function (fr, k) { shapeHeld.push({ s: fr.s, f: fr.f, n: sh.fing[k] }); });
      chordObj.held = shapeHeld;
      chordObj.idx = outChords.length;
      outChords.push(chordObj);
      sh.fretted.forEach(function (fr) { if (fr.f > maxFret) maxFret = fr.f; });

      // melodia escolhida
      c.mel.forEach(function (mi, n) {
        var o = st.choice[n];
        melodyAt[mi] = o;
      });

      var mElem = c.mel.map(function (mi) { return mi; });
      // pool de acompanhamento
      var pool = sh.inner.slice().sort(function (a, b) { return b.s - a.s; }); // grave → agudo
      // slots dentro do acorde
      var sl = slots.filter(function (x) { return x.t >= c.t - 0.5 && x.t < c.t + c.d - 0.5; });
      if (!sl.length || sl[0].t > c.t + 0.5) sl.unshift({ t: c.t, measureStart: false });
      var melStart = {};
      mElem.forEach(function (mi) { melStart[mi] = mel[mi].t; });

      function activeMelodyString(t) {
        // melodia soando em t (nota anterior ainda soando também conta)
        for (var q = 0; q < mel.length; q++) {
          if (mel[q].t <= t + 0.5 && mel[q].t + mel[q].d > t + 0.5 && melodyAt[q]) return melodyAt[q].hard ? { s: melodyAt[q].s, hard: true } : melodyAt[q].s;
        }
        return 0;
      }

      var k = 0, patIdx = 0;
      sl.forEach(function (slot, si) {
        var t = slot.t;
        var isFirst = Math.abs(t - c.t) < 0.5;
        var hasMel = mElem.some(function (mi) { return Math.abs(mel[mi].t - t) < 1; });
        var nearMel = mElem.some(function (mi) { return Math.abs(mel[mi].t - t) < 23 && Math.abs(mel[mi].t - t) >= 1 && false; });
        if (isFirst || slot.measureStart) {
          events.push({ t: t, role: 'bass', s: sh.bass.s, f: sh.bass.f, midi: sh.bassMidi, hand: 'p', vel: isFirst ? 0.95 : 0.8, ci: chordObj.idx });
          if (sh.bass.f > maxFret) maxFret = sh.bass.f;
        } else {
          // acompanhamento
          var am = activeMelodyString(t);
          var ms = am && am.hard ? am.s : am;
          var avail = pool.filter(function (x) { return x.s > ms && !(am && am.hard && x.f > 0); });
          // evita compasso tuplet no meio de nota de melodia irregular
          var inTuplet = mel.some(function (m) { return m.t < t - 0.5 && m.t + m.d > t + 0.5 && (m.t % 24 !== 0 || m.d % 24 !== 0); });
          if (avail.length && !hasMel && !inTuplet) {
            var n2 = avail.length, seqLen = n2 > 1 ? 2 * n2 - 2 : 1;
            var ix = patIdx % seqLen; if (ix >= n2) ix = seqLen - ix;
            patIdx++;
            var a = avail[ix];
            events.push({ t: t, role: 'acc', s: a.s, f: a.f, midi: a.midi, hand: vOf[a.s], vel: 0.55, ci: chordObj.idx });
          } else if (!hasMel) { patIdx++; }
        }
      });
      // melodia
      mElem.forEach(function (mi) {
        var o = melodyAt[mi];
        if (!o) return;
        events.push({ t: mel[mi].t, role: 'mel', s: o.s, f: o.f, midi: mel[mi].midi, hand: vOf[o.s], vel: 1.0, ci: chordObj.idx, d: mel[mi].d, mi: mi, fing: o.fing, hard: !!o.hard, ly: mel[mi].ly });
        if (o.f > maxFret) maxFret = o.f;
      });
    });

    events.sort(function (a, b) {
      if (a.t !== b.t) return a.t - b.t;
      var ord = { bass: 0, acc: 1, mel: 2 };
      return ord[a.role] - ord[b.role];
    });

    // estados da mão esquerda por tempo (para animação)
    var states = [];
    var ci = -1;
    var lastMel = null;
    var groups = [];
    events.forEach(function (e) {
      var g = groups[groups.length - 1];
      if (g && Math.abs(g.t - e.t) < 1) g.ev.push(e); else groups.push({ t: e.t, ev: [e] });
    });
    groups.forEach(function (g) {
      var ch = outChords[g.ev[0].ci];
      var held = ch.held.map(function (x) { return { s: x.s, f: x.f, n: x.n }; });
      var barre = ch.shape.barre ? { f: ch.shape.barre.f, s1: ch.shape.barre.s1, s2: ch.shape.barre.s2 } : null;
      // nota da melodia ativa neste momento
      var m = g.ev.filter(function (x) { return x.role === 'mel'; })[0];
      var m2 = m;
      if (!m2) {
        for (var q = mel.length - 1; q >= 0; q--) {
          if (mel[q].t <= g.t + 0.5 && mel[q].t + mel[q].d > g.t + 0.5 && melodyAt[q]) { var oo = melodyAt[q]; m2 = { s: oo.s, f: oo.f, fing: oo.fing, hard: oo.hard, ci: ch.idx }; break; }
        }
      }
      if (m2 && m2.hard) {
        held = m2.f > 0 ? [{ s: m2.s, f: m2.f, n: 1, mel: true }] : [];
        barre = null;
      } else if (m2 && m2.f > 0 && m2.fing > 0) {
        held = held.filter(function (x) { return x.s !== m2.s; });
        held.push({ s: m2.s, f: m2.f, n: m2.fing, mel: true });
      } else if (m2) {
        held = held.filter(function (x) { return x.s !== m2.s; });
      }
      states.push({ t: g.t, held: held, barre: barre, ci: ch.idx });
    });

    return {
      T: T, capo: capo, fifths: fifths, pulse: minfo.length ? minfo[Math.min(1, minfo.length - 1)].pulse : 96,
      minfo: minfo, chords: outChords, events: events, states: states, maxFret: maxFret,
      cost: total, bad: badTotal, total: totalTicks
    };
  }

  /* ---------- técnicas da melodia: hammer-on (h) e slide (s) ---------- */
  // b.tech = 'h'|'s' (ornamento na nota de chegada b): re-toca a nota anterior (b.from) por um instante e liga/desliza até b.
  function markTech(arr) {
    var ev = arr.events, info = arr.minfo, states = arr.states, i, last = -9, flip = 0;
    ev.forEach(function (e, k) { e.id = k; delete e.tech; delete e.from; });
    var mels = ev.filter(function (e) { return e.role === 'mel'; });
    function mOf(t) {
      var lo = 0, hi = info.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (info[mid].t0 <= t + 0.5) lo = mid; else hi = mid - 1; }
      return lo;
    }
    for (i = 0; i + 1 < mels.length; i++) {
      var a = mels[i], b = mels[i + 1];
      if (i < last + 2) continue;
      if (a.hard || b.hard || a.s !== b.s || b.f <= a.f || b.midi <= a.midi) continue;
      if (Math.abs(a.t + a.d - b.t) > 1 || mOf(a.t) !== mOf(b.t)) continue;
      var diff = b.f - a.f;
      if (diff > 4 || b.d < 48 || !(b.fing > 0)) continue;
      var tech = null;
      // grave (nota anterior) -> chegada: corda solta => hammer-on; casa => slide ou hammer (alternando)
      if (a.f === 0 && diff <= 3) tech = 'h';
      else if (a.f >= 1 && a.fing > 0) tech = diff >= 3 ? 's' : (flip++ % 2 ? 's' : 'h');
      if (!tech) continue;
      if (tech === 's') {
        // o mesmo dedo desliza: não pode haver outro dedo da forma do acorde usando esse número
        var ok = true;
        states.forEach(function (st) {
          if (st.t >= b.t - 0.5 && st.t < b.t + b.d - 0.5) st.held.forEach(function (h) { if (!h.mel && h.n === a.fing) ok = false; });
        });
        if (!ok) { if (diff <= 3) tech = 'h'; else continue; }
        else {
          states.forEach(function (st) {
            if (st.t >= b.t - 0.5 && st.t < b.t + b.d - 0.5) st.held.forEach(function (h) { if (h.mel && h.s === b.s && h.f === b.f) h.n = a.fing; });
          });
          b.fing = a.fing;
        }
      }
      b.tech = tech; b.from = a;
      last = i;
    }
    return arr;
  }

  /* ---------- seleção automática de tom ---------- */
  function arrange(h, opts) {
    opts = opts || {};
    var density = opts.density || 'arpejo';
    var mode = opts.mode || 'facil'; // facil (transpõe), original (capo auto), manual
    var cands = [];
    var melMin = 999, melMax = 0;
    h.mel.forEach(function (r) { if (r[2] < melMin) melMin = r[2]; if (r[2] > melMax) melMax = r[2]; });
    var i;
    if (mode === 'manual') {
      cands.push({ T: opts.T || 0, capo: opts.capo || 0, pen: 0 });
    } else if (mode === 'original') {
      for (i = 0; i <= 5; i++) cands.push({ T: 0, capo: i, pen: 4 * i });
    } else {
      for (i = -6; i <= 5; i++) cands.push({ T: i, capo: 0, pen: 6 * Math.abs(i) });
    }
    var best = null;
    cands.forEach(function (c) {
      var lo = melMin + c.T, hi = melMax + c.T;
      var r = arrangeFor(h, c.T, c.capo, density);
      var pen = c.pen + r.bad * 14;
      // melodia muito aguda/grave
      if (hi > 79) pen += (hi - 79) * 4;
      if (lo < 52) pen += (52 - lo) * 4;
      r.score = r.cost + pen;
      if (!best || r.score < best.score) best = r;
    });
    best.keyName = pcName(mod(h.k * 7 + best.T, 12), best.fifths) + (h.md ? 'm' : '');
    best.density = density;
    markTech(best);
    return best;
  }

  return {
    Q: Q, OPEN: OPEN, QUAL: QUAL, arrange: arrange, arrangeFor: arrangeFor,
    chordName: chordName, pcName: pcName, fifthsFromPc: fifthsFromPc, measureInfo: measureInfo,
    markTech: markTech, assignFingers: assignFingers, melodyFinger: melodyFinger, buildShapes: buildShapes
  };
});
