/* Vend Hjem · feltregistrering — virker offline, gemmer lokalt.
   Kun det, der SKAL fanges i rummet. Resten udfyldes ved bordet bagefter. */
(function () {
  'use strict';

  var RUM = ["B01-ST-R01","B01-ST-R02","B01-ST-R03","B01-ST-R04","B01-ST-R05","B01-1S-R01","B01-1S-R02","B01-1S-R03","B02-ST-R01","B02-ST-R02","B02-ST-R03","B02-ST-R04","B02-ST-R05","B02-ST-R06","B02-ST-R07","B02-ST-R08","B03-ST-R01","B03-ST-R02","B03-ST-R03","B03-ST-R04","B03-ST-R05","B03-ST-R06","B03-ST-R07","B03-ST-R08","B03-1S-R01","B03-1S-R02","B03-1S-R03","B03-1S-R04","B04-ST-R01","B04-ST-R02","B04-ST-R03","B04-ST-R04","B05-ST-R01","B05-ST-R02","B06-ST-R01","B06-ST-R02","B06-ST-R03","B06-ST-R04","B06-ST-R05","B06-ST-R06","B07-ST-R01"];
  var UDE = ["U01","U02","U03","U04","U05","U06","U07","U08","U09","U10"];
  var TEK = ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12"];
  var BYG = {
    B01: "1920 · 83 m² · tegltag",
    B02: "1920 · 100 m² · fibercement m. asbest",
    B03: "1920 · 171 m² · fibercement m. asbest",
    B04: "findes ikke i BBR — afklar hvad det er",
    B05: "1920 · 25 m² · fibercement m. asbest",
    B06: "1955 · 150 m² · metaltag",
    B07: "drivhus 7 m² · glas (BBR-årstal er en tastefejl)"
  };
  var TEKNIK = ["Varmekilde","Stik","Loftudtag","Vand","Afløb","Ventilation","Vindue kan åbnes"];
  var NOEGLE = 'vh-reg-v1';

  // ─── lager ───
  var S = { hvem: '', rum: {}, fund: [] };
  function load() {
    try { var r = localStorage.getItem(NOEGLE); if (r) S = JSON.parse(r); } catch (e) {}
    if (!S.rum) S.rum = {}; if (!S.fund) S.fund = [];
  }
  var gemStatus = document.getElementById('gemstatus');
  function save() {
    try {
      localStorage.setItem(NOEGLE, JSON.stringify(S));
      gemStatus.textContent = 'Gemt lokalt ' + nu().slice(11, 16);
      gemStatus.style.color = '';
    } catch (e) {
      gemStatus.textContent = 'KUNNE IKKE GEMME — eksportér nu';
      gemStatus.style.color = 'var(--accent)';
    }
  }
  function nu() { var d = new Date(); return d.toISOString(); }
  function dk(iso) { return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + ' ' + iso.slice(11, 16) : ''; }
  function el(id) { return document.getElementById(id); }

  // ─── tilstand i appen ───
  var valgt = null;

  function alleSteder() { return RUM.concat(UDE).concat(TEK); }

  function erFaerdig(id) {
    var r = S.rum[id];
    return !!(r && r.k && r.foto);
  }

  // ─── liste over steder ───
  function tegnListe() {
    var filter = el('filter').value;
    var wrap = el('liste'); wrap.innerHTML = '';
    var grupper = {};
    alleSteder().forEach(function (id) {
      var g = id.indexOf('-') > -1 ? id.split('-')[0] : (id[0] === 'U' ? 'Udearealer' : 'Tekniske anlæg');
      (grupper[g] = grupper[g] || []).push(id);
    });
    Object.keys(grupper).forEach(function (g) {
      var ids = grupper[g].filter(function (id) {
        if (filter === 'mangler') return !erFaerdig(id);
        if (filter === 'faerdige') return erFaerdig(id);
        return true;
      });
      if (!ids.length) return;
      var h = document.createElement('div');
      h.className = 'grp';
      var gjort = grupper[g].filter(erFaerdig).length;
      h.innerHTML = '<p class="meta-s">' + g + (BYG[g] ? ' · ' + BYG[g] : '') +
        ' <span style="float:right">' + gjort + '/' + grupper[g].length + '</span></p>';
      var row = document.createElement('div'); row.className = 'chips';
      ids.forEach(function (id) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (erFaerdig(id) ? ' gjort' : '') + (id === valgt ? ' valgt' : '');
        b.textContent = id.replace(/^B\d\d-/, '');
        b.title = id;
        b.onclick = function () { aabn(id); };
        row.appendChild(b);
      });
      h.appendChild(row); wrap.appendChild(h);
    });
  }

  // ─── formular for ét sted ───
  function aabn(id) {
    valgt = id;
    var r = S.rum[id] || {};
    el('formtitel').textContent = id;
    el('formhint').textContent = BYG[id.split('-')[0]] || (id[0] === 'U' ? 'Udeareal' : id[0] === 'T' ? 'Teknisk anlæg' : '');
    el('f_navn').value = r.navn || '';
    el('f_l').value = r.l || ''; el('f_b').value = r.b || '';
    el('f_h').value = r.h || ''; el('f_dor').value = r.dor || '';
    el('f_foto').value = r.foto || '';
    el('f_note').value = r.note || '';
    tegnValg('k', r.k); tegnValg('fugt', r.fugt);
    TEKNIK.forEach(function (t, i) {
      el('tek' + i).classList.toggle('tag-accent', !!(r.teknik || []).includes(t));
    });
    el('form').hidden = false;
    el('oversigt').hidden = true;
    el('fundsted').textContent = id;
    window.scrollTo(0, 0);
    tegnListe();
  }

  function tegnValg(navn, vaerdi) {
    [].forEach.call(document.querySelectorAll('[data-valg="' + navn + '"]'), function (b) {
      b.classList.toggle('tag-accent', b.dataset.v === vaerdi);
    });
  }
  [].forEach.call(document.querySelectorAll('[data-valg]'), function (b) {
    b.onclick = function () { tegnValg(b.dataset.valg, b.dataset.v); };
  });
  TEKNIK.forEach(function (t, i) {
    el('tek' + i).onclick = function () { el('tek' + i).classList.toggle('tag-accent'); };
  });

  function laesValg(navn) {
    var v = document.querySelector('[data-valg="' + navn + '"].tag-accent');
    return v ? v.dataset.v : '';
  }

  el('gem').onclick = function () {
    if (!valgt) return;
    var teknik = TEKNIK.filter(function (t, i) { return el('tek' + i).classList.contains('tag-accent'); });
    S.rum[valgt] = {
      navn: el('f_navn').value.trim(),
      l: el('f_l').value, b: el('f_b').value, h: el('f_h').value, dor: el('f_dor').value,
      k: laesValg('k'), fugt: laesValg('fugt'),
      teknik: teknik,
      foto: el('f_foto').value.trim(),
      note: el('f_note').value.trim(),
      hvem: S.hvem, tid: nu()
    };
    save(); tegnListe();
    var mangler = [];
    if (!S.rum[valgt].k) mangler.push('tilstand');
    if (!S.rum[valgt].foto) mangler.push('fotonumre');
    el('gemsvar').textContent = mangler.length
      ? valgt + ' gemt — mangler stadig ' + mangler.join(' og ')
      : valgt + ' gemt og færdig';
    el('gemsvar').style.color = mangler.length ? 'var(--accent)' : '';
    setTimeout(function(){ el('gemsvar').textContent=''; }, 6000);
  };

  el('luk').onclick = function () { el('form').hidden = true; valgt = null; tegnListe(); };

  // ─── fund ───
  el('fundgem').onclick = function () {
    var hvad = el('fund_hvad').value.trim();
    if (!hvad) { el('fund_hvad').focus(); return; }
    S.fund.push({
      id: 'F' + String(S.fund.length + 1).padStart(3, '0'),
      sted: valgt || '(ikke angivet)',
      hvad: hvad,
      haster: (document.querySelector('[data-valg="haster"].tag-accent') || {dataset:{v:'1-2 år'}}).dataset.v,
      hvem_udfoerer: (document.querySelector('[data-valg="udf"].tag-accent') || {dataset:{v:''}}).dataset.v,
      foto: el('fund_foto').value.trim(),
      hvem: S.hvem, tid: nu(), belob: ''
    });
    el('fund_hvad').value = ''; el('fund_foto').value = '';
    save(); tegnFund();
    el('fundsvar').textContent = 'Fund gemt · ' + S.fund.length + ' i alt';
    setTimeout(function(){ el('fundsvar').textContent=''; }, 5000);
  };

  function tegnFund() {
    var w = el('fundliste'); w.innerHTML = '';
    S.fund.slice().reverse().forEach(function (f) {
      var d = document.createElement('div'); d.className = 'post';
      d.innerHTML = '<div class="h"><span>' + esc(f.hvad) + '</span><span class="n">' + esc(f.id) + '</span></div>' +
        '<p class="m">' + esc(f.sted) + ' · ' + esc(f.haster) + (f.hvem_udfoerer ? ' · ' + esc(f.hvem_udfoerer) : '') +
        ' · ' + dk(f.tid) + ' · ' + esc(f.hvem || '?') + ' · beløb: datamangel</p>';
      w.appendChild(d);
    });
    if (!S.fund.length) w.innerHTML = '<p class="note">Ingen fund registreret endnu.</p>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // ─── oversigt ───
  function tegnOversigt() {
    var alle = alleSteder();
    var gjort = alle.filter(erFaerdig).length;
    var kfordeling = {};
    var fugt2 = [];
    Object.keys(S.rum).forEach(function (id) {
      var r = S.rum[id];
      if (r.k) kfordeling[r.k] = (kfordeling[r.k] || 0) + 1;
      if (r.fugt === '2' || r.fugt === '3') fugt2.push(id);
    });
    var haster = S.fund.filter(function (f) { return f.haster === 'nu'; }).length;
    var udenBelob = S.fund.filter(function (f) { return !f.belob; }).length;

    el('o_gjort').textContent = gjort;
    el('o_ialt').textContent = alle.length;
    el('o_frem').style.setProperty('--p', Math.round(gjort / alle.length * 100) + '%');
    el('o_fund').textContent = S.fund.length;
    el('o_haster').textContent = haster;
    var kl = el('o_k'); kl.innerHTML = '';
    ['K0','K1','K2','K3','UN'].forEach(function (k) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + k + '</span><span class="r">' + (kfordeling[k] || 0) + ' rum</span>';
      kl.appendChild(li);
    });
    el('o_fugt').textContent = fugt2.length ? fugt2.join(', ') : 'ingen med fugt 2 eller 3';
    el('o_datamangel').textContent = udenBelob
      ? udenBelob + ' fund uden beløb — anlægsbudgettet er ufuldstændigt, ikke billigt'
      : 'alle fund er prissat';
  }

  el('visoversigt').onclick = function () {
    el('form').hidden = true; valgt = null;
    el('oversigt').hidden = !el('oversigt').hidden;
    if (!el('oversigt').hidden) tegnOversigt();
    tegnListe();
  };

  // ─── eksport ───
  function hent(navn, indhold, type) {
    var b = new Blob([indhold], { type: type + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = navn;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csvFelt(v) {
    v = String(v == null ? '' : v);
    return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }

  el('eks_json').onclick = function () {
    hent('vendhjem-registrering-' + (S.hvem || 'ukendt') + '-' + stamp() + '.json',
      JSON.stringify(S, null, 2), 'application/json');
  };
  el('eks_rum').onclick = function () {
    var h = ['Rum-ID','Rumnavn','L m','B m','Loftshøjde m','Dørbredde cm','TILSTAND K','FUGT 0-3','Teknik','Foto-numre','Note','Hvem','Tid'];
    var r = [h.join(';')];
    Object.keys(S.rum).sort().forEach(function (id) {
      var x = S.rum[id];
      r.push([id, x.navn, x.l, x.b, x.h, x.dor, x.k, x.fugt, (x.teknik || []).join(' + '), x.foto, x.note, x.hvem, x.tid].map(csvFelt).join(';'));
    });
    hent('vendhjem-rum-' + stamp() + '.csv', '﻿' + r.join('\n'), 'text/csv');
  };
  el('eks_fund').onclick = function () {
    var h = ['ID','Dato','Hvem','Sted-ID','Hvad blev observeret','Hastegrad','Selv eller fagmand','I ALT kr.','Foto','Status'];
    var r = [h.join(';')];
    S.fund.forEach(function (f) {
      r.push([f.id, f.tid, f.hvem, f.sted, f.hvad, f.haster, f.hvem_udfoerer, '', f.foto, 'Åben'].map(csvFelt).join(';'));
    });
    hent('vendhjem-fund-' + stamp() + '.csv', '﻿' + r.join('\n'), 'text/csv');
  };

  // importer en anden telefons JSON og flet
  el('import').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var ind = JSON.parse(fr.result);
        var nye = 0, opd = 0;
        Object.keys(ind.rum || {}).forEach(function (id) {
          var a = S.rum[id], b = ind.rum[id];
          if (!a) { S.rum[id] = b; nye++; }
          else if (b.tid > a.tid) { S.rum[id] = b; opd++; }
        });
        var kendte = {};
        S.fund.forEach(function (x) { kendte[x.tid + x.hvad] = 1; });
        var nyeFund = 0;
        (ind.fund || []).forEach(function (x) {
          if (!kendte[x.tid + x.hvad]) { S.fund.push(x); nyeFund++; }
        });
        S.fund.forEach(function (x, i) { x.id = 'F' + String(i + 1).padStart(3, '0'); });
        save(); tegnListe(); tegnFund(); if (!el('oversigt').hidden) tegnOversigt();
        el('importsvar').textContent = 'Flettet: ' + nye + ' nye rum, ' + opd + ' opdaterede, ' + nyeFund + ' nye fund.';
      } catch (err) {
        el('importsvar').textContent = 'Kunne ikke læse filen.';
      }
      e.target.value = '';
    };
    fr.readAsText(f);
  };

  // ─── hvem ───
  el('hvem').onchange = function () { S.hvem = el('hvem').value.trim(); save(); };

  // ─── offline ───
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  function netstatus() {
    el('net').textContent = navigator.onLine ? 'online' : 'offline — alt gemmes lokalt';
    el('net').style.color = navigator.onLine ? '' : 'var(--accent)';
  }
  window.addEventListener('online', netstatus);
  window.addEventListener('offline', netstatus);

  // ─── start ───
  load();
  el('hvem').value = S.hvem || '';
  el('filter').onchange = tegnListe;
  tegnListe(); tegnFund(); netstatus();
  if (Object.keys(S.rum).length || S.fund.length) {
    gemStatus.textContent = Object.keys(S.rum).length + ' rum og ' + S.fund.length + ' fund ligger lokalt';
  }
  window.addEventListener('beforeunload', function (e) {
    if (Object.keys(S.rum).length && !sessionStorage.getItem('vh-eksporteret')) { /* ingen blokering, kun note */ }
  });
})();
