/* app.js — telas, biblioteca, configurações e execução */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DEF = { voice: 'nylon', tone: 'facil', density: 'arpejo', verse: 'all', fingers: true, speed: 100, last: 0 };
  var S = {};
  var DATA = null, hymns = [];
  var cur = null; // { h, arr, sheet, guitar, player, pageIdx, verse }
  var synth = null, raf = 0, manual = null;
  var KEYS = ['Dó', 'Réb', 'Ré', 'Mib', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'];

  function load() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem('hv-settings') || '{}'); } catch (e) { }
    S = Object.assign({}, DEF, o);
  }
  function save() { try { localStorage.setItem('hv-settings', JSON.stringify(S)); } catch (e) { } }

  /* ---------- navegação ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    if (id !== 'player') leavePlayer();
  }
  function applyVoice() {
    document.body.setAttribute('data-voice', S.voice);
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = S.voice === 'aco' ? '#0f1a26' : '#3a2616';
    document.querySelectorAll('#segVoice button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === S.voice); });
    $('btnVoice').textContent = S.voice === 'aco' ? 'Aço' : 'Náilon';
  }

  /* ---------- biblioteca ---------- */
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function buildList(filter) {
    var ul = $('list'), f = norm(filter || '').trim(), html = [];
    hymns.forEach(function (h) {
      var num = ('00' + h.n).slice(-3);
      if (f && num.indexOf(f) < 0 && String(h.n) !== f && norm(h.t).indexOf(f) < 0) return;
      var tonic = ((h.k * 7) % 12 + 12) % 12;
      html.push('<li data-n="' + h.n + '"><span class="n">' + num + '</span><span class="t">' + h.t.replace(/</g, '&lt;') + '</span><span class="k">' + KEYS[h.md ? (tonic + 9) % 12 : tonic] + (h.md ? ' m' : '') + '</span></li>');
    });
    ul.innerHTML = html.join('') || '<li style="cursor:default">Nenhum hino encontrado.</li>';
  }

  /* ---------- execução ---------- */
  function arrOpts() {
    if (manual) return { mode: 'manual', T: manual.T, capo: manual.capo, density: S.density };
    return { mode: S.tone, density: S.density };
  }

  function openHymn(n, keepSec) {
    var h = hymns[n - 1];
    if (!h) return;
    S.last = n; save();
    show('player');
    $('loading').classList.remove('hide');
    $('pTitle').textContent = ('00' + h.n).slice(-3) + ' · ' + h.t;
    document.title = h.t + ' — Violão dos Hinos';
    leavePlayer(true);
    // dá tempo da tela aparecer antes do cálculo pesado
    setTimeout(function () {
      var arr = Arranger.arrange(h, arrOpts());
      if (!synth) synth = new GuitarAudio.Synth();
      synth.voice = S.voice; if (synth.ctx) synth.setVoice(S.voice); synth.cache = {};
      var themes = {
        nylon: { paper0: '#f4e5c4', paper1: '#e9d3a7', paper2: '#d5b785', border: '#9c7a45' },
        aco: { paper0: '#ece0c4', paper1: '#dcc89f', paper2: '#bda274', border: '#7d6a4a' }
      };
      var sheet = new Sheet({ hymn: h, arr: arr, voiceLabel: S.voice === 'aco' ? 'Violão de aço' : 'Violão de náilon', showLeftFingers: S.fingers, theme: themes[S.voice] });
      var vlist = []; for (var i = 1; i <= (h.V || 1); i++) vlist.push(i);
      sheet.build(1, vlist);
      var guitar = new GuitarView($('guitarWrap'), S.voice, Math.max(12, arr.maxFret + 1));
      guitar.setCapo(arr.capo);
      var player = new GuitarAudio.Player(synth);
      player.rate = S.speed / 100;
      player.load(arr, h, S.verse);
      cur = { h: h, arr: arr, sheet: sheet, guitar: guitar, player: player, pageIdx: -1, verse: 0 };
      // seletor de estrofes
      var sel = $('pVerse'); sel.innerHTML = '';
      var o = document.createElement('option'); o.value = 'all'; o.textContent = 'Todas'; sel.appendChild(o);
      for (i = 1; i <= (h.V || 1); i++) { o = document.createElement('option'); o.value = i; o.textContent = i + 'ª'; sel.appendChild(o); }
      sel.value = S.verse;
      $('pSpeed').value = S.speed; $('pSpeedOut').textContent = S.speed + '%';
      updateToneLabel();
      $('bPlay').textContent = '▶';
      player.onEnd = function () { $('bPlay').textContent = '▶'; };
      player.songSec = keepSec || 0;
      renderAt(player.songSec, true);
      $('loading').classList.add('hide');
      cancelAnimationFrame(raf); loop();
    }, 30);
  }

  function updateToneLabel() {
    if (!cur) return;
    var a = cur.arr;
    $('toneLbl').textContent = a.keyName + (a.capo ? ' · capo ' + a.capo : '');
  }

  function leavePlayer(soft) {
    cancelAnimationFrame(raf);
    if (cur && cur.player) { try { cur.player.stop(); } catch (e) { } }
    if (!soft) { cur = null; $('bPlay').textContent = '▶'; document.body.classList.remove('clean'); $('exitClean').hidden = true; }
  }

  function showPage(pi) {
    if (!cur || pi === cur.pageIdx || pi == null) return;
    var p = cur.sheet.pages[pi]; if (!p) return;
    var host = $('sheet');
    host.replaceChildren(p.svg);
    cur.pageIdx = pi;
    cur.sheet.setVerse(cur.verse || 1);
  }

  function renderAt(sec, force) {
    var c = cur; if (!c) return;
    var pl = c.player;
    var pi = pl.passAt(sec); if (pi < 0) return;
    var pass = pl.passes[pi];
    if (pass.verse !== c.verse) { c.verse = pass.verse; if (c.pageIdx >= 0) c.sheet.setVerse(c.verse); }
    var page = c.sheet.measurePage[pass.mi];
    if (page !== c.pageIdx) { if (c.pageIdx >= 0 && c.sheet.pages[c.pageIdx]) { var op = c.sheet.pages[c.pageIdx]; op._act = null; } showPage(page); }
    var tk = pl.tickAt(sec);
    c.sheet.updatePlayhead(c.sheet.pages[page], tk.tick);
    // mão esquerda / direita
    var st = null, lo = 0, hi = pl.states.length - 1, mid;
    while (lo <= hi) { mid = (lo + hi) >> 1; if (pl.states[mid].sec <= sec + 0.005) { st = pl.states[mid]; lo = mid + 1; } else hi = mid - 1; }
    var plucks = [], i0 = pl.findIdx(sec - 1.6), tl = pl.timeline;
    for (var i = i0; i < tl.length && tl[i].sec <= sec + 0.001; i++) plucks.push({ s: tl[i].e.s, hand: tl[i].e.hand, age: sec - tl[i].sec });
    c.guitar.frame(st ? st.s : null, plucks, sec);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!cur) return;
    var sec = cur.player.now();
    if (cur.player.playing || cur._dirty) { renderAt(Math.min(sec, cur.player.total), false); cur._dirty = false; }
  }

  function togglePlay() {
    if (!cur) return;
    var p = cur.player;
    if (p.playing) { p.pause(); $('bPlay').textContent = '▶'; }
    else { p.start(); $('bPlay').textContent = '⏸'; }
  }
  function seekPass(delta) {
    if (!cur) return;
    var p = cur.player, pi = p.passAt(p.now());
    var to = Math.max(0, Math.min(p.passes.length - 1, pi + delta));
    p.seek(p.passes[to].start + 0.001);
    cur._dirty = true; renderAt(p.passes[to].start + 0.001);
  }
  function restart() {
    if (!cur) return;
    cur.player.seek(0); cur._dirty = true; cur.pageIdx = -1; renderAt(0, true);
  }
  function reopen() {
    if (!cur) return;
    var n = cur.h.n, was = cur.player.playing, sec = cur.player.now();
    openHymn(n, 0);
    // posição é perdida ao trocar tom/voz: recomeça
  }

  /* ---------- eventos ---------- */
  function bind() {
    $('btnSettings').onclick = function () { show('settings'); };
    $('btnContinue').onclick = function () { if (S.last) openHymn(S.last); };
    $('btnLibrary').onclick = function () { show('library'); buildList($('q').value); };
    document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = function () { show(b.getAttribute('data-back')); }; });
    $('pBack').onclick = function () { show('library'); };
    $('q').oninput = function () { buildList(this.value); };
    $('list').onclick = function (e) {
      var li = e.target.closest('li[data-n]'); if (li) { manual = null; openHymn(+li.getAttribute('data-n')); }
    };
    document.querySelectorAll('#segVoice button').forEach(function (b) {
      b.onclick = function () { S.voice = b.getAttribute('data-v'); save(); applyVoice(); };
    });
    $('selTone').onchange = function () { S.tone = this.value; save(); };
    $('selDensity').onchange = function () { S.density = this.value; save(); };
    $('selVerse').onchange = function () { S.verse = this.value; save(); };
    $('chkFingers').onchange = function () { S.fingers = this.checked; save(); };
    $('rngSpeed').oninput = function () { S.speed = +this.value; $('outSpeed').textContent = this.value + '%'; save(); };

    $('bPlay').onclick = togglePlay;
    $('bRestart').onclick = restart;
    $('bPrev').onclick = function () { seekPass(-1); };
    $('bNext').onclick = function () { seekPass(1); };
    $('pSpeed').oninput = function () { S.speed = +this.value; $('pSpeedOut').textContent = this.value + '%'; save(); if (cur) cur.player.setRate(S.speed / 100); };
    $('pVerse').onchange = function () { S.verse = this.value; save(); if (cur) { cur.player.stop(); cur.player.load(cur.arr, cur.h, S.verse); cur.verse = 0; cur.pageIdx = -1; $('bPlay').textContent = '▶'; cur.player.songSec = 0; renderAt(0, true); } };
    $('btnVoice').onclick = function () { S.voice = S.voice === 'aco' ? 'nylon' : 'aco'; save(); applyVoice(); if (cur) openHymn(cur.h.n); };
    $('tUp').onclick = function () { tone(1); };
    $('tDown').onclick = function () { tone(-1); };
    $('toneLbl').onclick = function () { manual = null; if (cur) openHymn(cur.h.n); };
    $('bFull').onclick = function () {
      document.body.classList.add('clean'); $('exitClean').hidden = false;
      var d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen().catch(function () { });
    };
    $('exitClean').onclick = function () {
      document.body.classList.remove('clean'); $('exitClean').hidden = true;
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    };
    document.addEventListener('keydown', function (e) {
      if (!cur || !$('player').classList.contains('active')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') seekPass(1);
      else if (e.code === 'ArrowLeft') seekPass(-1);
    });
    $('sheet').onclick = function () { togglePlay(); };
    window.addEventListener('beforeunload', function () { try { cur && cur.player.stop(); } catch (e) { } });
  }
  function tone(d) {
    if (!cur) return;
    manual = { T: cur.arr.T + d, capo: cur.arr.capo };
    openHymn(cur.h.n);
  }

  function initSettingsUi() {
    applyVoice();
    $('selTone').value = S.tone; $('selDensity').value = S.density; $('selVerse').value = S.verse;
    $('chkFingers').checked = !!S.fingers; $('rngSpeed').value = S.speed; $('outSpeed').textContent = S.speed + '%';
    if (S.last && hymns[S.last - 1]) {
      $('btnContinue').hidden = false;
      $('continueTitle').textContent = ('00' + S.last).slice(-3) + ' · ' + hymns[S.last - 1].t;
    }
  }

  function boot() {
    load(); bind();
    fetch('hinos.json').then(function (r) { return r.json(); }).then(function (d) {
      DATA = d; hymns = d.hinos; initSettingsUi(); buildList('');
    }).catch(function () {
      document.querySelector('.home-main .hint').textContent = 'Não foi possível carregar hinos.json. Abra o app por um servidor (GitHub Pages).';
    });
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }
  boot();
})();
