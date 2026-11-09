/* Canvas asset generator for Daily Dubai & Jebel Ali News.
   Draws every PNG/ICO the PWA needs, with golden-and-navy Dubai skyline branding.
   Used by generate-assets.html and export-zip.html. Zero dependencies. */
(function (g) {
  'use strict';

  var NAVY = '#0B1F3A', GOLD = '#D4AF37', GOLD2 = '#F2C94C', DEEP = '#06122A';

  // Stylised skyline in a 100x100 box (y down, baseline y=100): towers, a sail hotel and the central spire.
  var SKY = [
    [[0,100],[0,78],[7,78],[7,100]],
    [[7,100],[7,64],[15,64],[15,100]],
    [[15,100],[15,74],[21,74],[21,100]],
    [[22,100],[23,56],[29,48],[34,100]],
    [[34,100],[34,80],[44,80],[44,100]],
    [[44,100],[44,62],[46,62],[46,48],[47.6,48],[47.6,34],[48.8,34],[48.8,16],[50,0],[51.2,16],[51.2,34],[52.4,34],[52.4,48],[54,48],[54,62],[56,62],[56,100]],
    [[58,100],[58,60],[66,60],[66,100]],
    [[66,100],[66,76],[73,76],[73,100]],
    [[73,100],[73,54],[80,54],[80,100]],
    [[80,100],[80,72],[88,72],[88,100]],
    [[88,100],[88,84],[100,84],[100,100]]
  ];

  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function bg(ctx, w, h) {
    var gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#15386A'); gr.addColorStop(1, DEEP);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
  function skyline(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    SKY.forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (p, i) {
        var X = x + p[0] / 100 * w, Y = y + p[1] / 100 * h;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath(); ctx.fill();
    });
  }
  function sun(ctx, cx, cy, r) {
    var gl = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
    gl.addColorStop(0, 'rgba(242,201,76,.55)'); gl.addColorStop(1, 'rgba(242,201,76,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(242,201,76,.25)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function iconCanvas(S, maskable) {
    var c = mk(S, S), x = c.getContext('2d');
    bg(x, S, S);
    // Maskable icons keep all artwork inside the central safe zone (80% circle).
    var b = maskable
      ? { x0: 0.22, x1: 0.78, y0: 0.34, y1: 0.70, sx: 0.5, sy: 0.47, sr: 0.2 }
      : { x0: 0.12, x1: 0.88, y0: 0.26, y1: 0.80, sx: 0.5, sy: 0.45, sr: 0.27 };
    sun(x, b.sx * S, b.sy * S, b.sr * S);
    skyline(x, b.x0 * S, b.y0 * S, (b.x1 - b.x0) * S, (b.y1 - b.y0) * S, GOLD);
    x.fillStyle = GOLD;
    x.fillRect(b.x0 * S, b.y1 * S + S * 0.006, (b.x1 - b.x0) * S, Math.max(1, S * 0.012));
    return c;
  }

  function ogCanvas() {
    var W = 1200, H = 630, c = mk(W, H), x = c.getContext('2d');
    bg(x, W, H);
    sun(x, 930, 330, 190);
    skyline(x, 0, 372, W, 258, GOLD);
    x.fillStyle = GOLD2; x.font = '700 26px ' + FONT; x.textBaseline = 'alphabetic';
    x.fillText('2026 EDITION', 72, 118);
    x.fillStyle = '#FFFFFF'; x.font = '800 78px ' + FONT;
    x.fillText('Daily Dubai &', 72, 210);
    x.fillText('Jebel Ali News', 72, 296);
    x.fillStyle = '#C8D3E6'; x.font = '500 27px ' + FONT;
    x.fillText('Jebel Ali · Discovery Gardens · Al Furjan', 72, 350);
    x.fillText('JAFZA · Dubai South · RTA alerts', 72, 388);
    return c;
  }

  var MOCK = [
    ['Jebel Ali & JAFZA: official notices and announcements', 'JAFZA'],
    ['RTA: live traffic, Dubai Metro, bus and Salik notices', 'RTA'],
    ['Discovery Gardens & Al Furjan: community updates', 'agac.ae'],
    ['Dubai Land Department: rental index and tenant tools', 'Dubai Land Department'],
    ['Dubai Media Office: official government news', 'Dubai Media Office'],
    ['Gulf News: latest UAE headlines', 'Gulf News']
  ];

  // UI mock-up used for the manifest screenshots (vw x vh CSS px, scaled by k).
  function shotCanvas(vw, vh, k, cols) {
    var c = mk(vw * k, vh * k), x = c.getContext('2d'); x.scale(k, k);
    x.fillStyle = '#F3F5F9'; x.fillRect(0, 0, vw, vh);
    x.fillStyle = NAVY; x.fillRect(0, 0, vw, 64);
    x.textBaseline = 'alphabetic';
    x.fillStyle = GOLD2; x.font = '800 17px ' + FONT; x.fillText('Daily Dubai & Jebel Ali News', 16, 30);
    x.fillStyle = '#C8D3E6'; x.font = '12px ' + FONT; x.fillText('2026 Edition · GST (UTC+4)', 16, 49);
    // glance card
    var gw = vw - 32, gh = cols > 1 ? 150 : 200;
    var gr = x.createLinearGradient(16, 80, 16, 80 + gh); gr.addColorStop(0, '#13335F'); gr.addColorStop(1, NAVY);
    x.fillStyle = gr; rr(x, 16, 80, gw, gh, 22); x.fill();
    x.fillStyle = '#FFF'; x.font = '300 56px ' + FONT; x.fillText('5:45', 34, 144);
    x.fillStyle = GOLD2; x.font = '700 16px ' + FONT; x.fillText('PM', 160, 144);
    x.fillStyle = '#B8C6E0'; x.font = '14px ' + FONT; x.fillText('Monday, 9 November', 34, 168);
    x.fillStyle = '#FFF'; x.font = '300 34px ' + FONT; x.textAlign = 'right'; x.fillText('29°', 16 + gw - 18, 130);
    x.fillStyle = '#B8C6E0'; x.font = '13px ' + FONT; x.fillText('Clear · feels 31°', 16 + gw - 18, 152); x.textAlign = 'left';
    if (cols === 1) {
      x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, 30, 186, gw - 28, 40, 12); x.fill();
      x.fillStyle = '#E53935'; x.beginPath(); x.arc(46, 206, 5, 0, 7); x.fill();
      x.fillStyle = '#FFF'; x.font = '700 13px ' + FONT; x.fillText('Metro Red Line · Route 2020 · Jebel Ali', 60, 211);
    }
    // chips
    var cy = 80 + gh + 18, cx = 16;
    ['All', 'Jebel Ali', 'Discovery Gardens', 'RTA/Traffic'].forEach(function (t, i) {
      x.font = '700 13px ' + FONT; var w = x.measureText(t).width + 28;
      x.fillStyle = i === 0 ? NAVY : '#E3E9F3'; rr(x, cx, cy, w, 36, 18); x.fill();
      x.fillStyle = i === 0 ? GOLD2 : '#0E1726'; x.fillText(t, cx + 14, cy + 23); cx += w + 8;
    });
    // cards
    var top = cy + 52, gap = 12, cw = (vw - 32 - gap * (cols - 1)) / cols, ch = 118, i = 0;
    for (var y = top; y + ch < vh + 4; y += ch + gap) {
      for (var col = 0; col < cols; col++, i++) {
        var m = MOCK[i % MOCK.length], px = 16 + col * (cw + gap);
        x.fillStyle = '#FFF'; rr(x, px, y, cw, ch, 16); x.fill();
        x.strokeStyle = '#D3DAE6'; x.lineWidth = 1; rr(x, px + .5, y + .5, cw - 1, ch - 1, 16); x.stroke();
        x.font = '800 11px ' + FONT; var bw = x.measureText(m[1]).width + 18;
        x.fillStyle = '#E3E9F3'; rr(x, px + 14, y + 14, bw, 20, 10); x.fill();
        x.fillStyle = '#0E1726'; x.fillText(m[1], px + 23, y + 28);
        x.fillStyle = '#0E1726'; x.font = '700 15px ' + FONT;
        wrap(x, m[0], cw - 28).slice(0, 2).forEach(function (ln, li) { x.fillText(ln, px + 14, y + 56 + li * 20); });
        x.fillStyle = '#E3E9F3'; rr(x, px + 14, y + ch - 34, 70, 22, 11); x.fill();
        rr(x, px + 92, y + ch - 34, 70, 22, 11); x.fill();
      }
    }
    return c;
  }

  var ASSETS = [];
  [72, 96, 128, 144, 152, 192, 384, 512].forEach(function (s) {
    ASSETS.push({ path: 'icons/icon-' + s + '.png', make: function () { return iconCanvas(s, false); } });
  });
  [192, 512].forEach(function (s) {
    ASSETS.push({ path: 'icons/icon-maskable-' + s + '.png', make: function () { return iconCanvas(s, true); } });
  });
  [16, 32].forEach(function (s) {
    ASSETS.push({ path: 'icons/favicon-' + s + 'x' + s + '.png', make: function () { return iconCanvas(s, false); } });
  });
  ASSETS.push({ path: 'apple-touch-icon.png', make: function () { return iconCanvas(180, false); } });
  ASSETS.push({ path: 'og-image.png', make: ogCanvas });
  ASSETS.push({ path: 'screenshots/screenshot-mobile.png', make: function () { return shotCanvas(375, 667, 2, 1); } });
  ASSETS.push({ path: 'screenshots/screenshot-desktop.png', make: function () { return shotCanvas(1440, 810, 4 / 3, 2); } });

  function toBlob(canvas) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob failed')); }, 'image/png');
    });
  }

  // favicon.ico containing 16x16 and 32x32 PNG frames
  async function icoBlob() {
    var sizes = [16, 32], pngs = [];
    for (var i = 0; i < sizes.length; i++) pngs.push(new Uint8Array(await (await toBlob(iconCanvas(sizes[i], false))).arrayBuffer()));
    var head = 6 + 16 * sizes.length, total = head;
    pngs.forEach(function (p) { total += p.length; });
    var buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, sizes.length, true);
    var off = head;
    for (var j = 0; j < sizes.length; j++) {
      var e = 6 + 16 * j;
      dv.setUint8(e, sizes[j]); dv.setUint8(e + 1, sizes[j]); dv.setUint8(e + 2, 0); dv.setUint8(e + 3, 0);
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, pngs[j].length, true); dv.setUint32(e + 12, off, true);
      u8.set(pngs[j], off); off += pngs[j].length;
    }
    return new Blob([buf], { type: 'image/x-icon' });
  }

  g.AssetLib = { ASSETS: ASSETS, toBlob: toBlob, icoBlob: icoBlob };
})(window);
