// In-world HUD drawn on the low-res canvas with the bitmap font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.HUD = (function () {
  const H = { banner: null, bannerT: 0, toasts: [], showHelp: true, helpT: 14, lastZone: '' };

  H.toast = function (text, color = '#ffffff', time = 2.6) {
    H.toasts.push({ text, color, t: 0, life: time });
    if (H.toasts.length > 4) H.toasts.shift();
  };

  H.update = function (dt, game) {
    const p = game.player;
    const zone = AQ.World.zoneName(p.x, p.y);
    if (zone !== H.lastZone) { H.lastZone = zone; H.banner = zone; H.bannerT = 0; }
    H.bannerT += dt;
    H.helpT -= dt;
    for (let i = H.toasts.length - 1; i >= 0; i--) { H.toasts[i].t += dt; if (H.toasts[i].t > H.toasts[i].life) H.toasts.splice(i, 1); }
  };

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(8,22,40,0.62)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(160,220,240,0.35)';
    ctx.fillRect(x, y, w, 1);
  }
  H.panel = panel;

  H.draw = function (ctx, game) {
    const F = AQ.Font, vw = AQ.TUNING.view.w, vh = AQ.TUNING.view.h;
    // biome banner
    if (H.banner && H.bannerT < 3.5) {
      const a = Math.min(1, H.bannerT * 3, (3.5 - H.bannerT) * 2);
      ctx.globalAlpha = a;
      const w = F.width(H.banner) + 12;
      panel(ctx, Math.round(vw / 2 - w / 2), 8, w, 11);
      F.draw(ctx, H.banner, vw / 2, 11, '#e8fbff', { align: 'center' });
      ctx.globalAlpha = 1;
    }
    // upgrades (top-left)
    const up = game.upgrades;
    if (up) {
      panel(ctx, 3, 3, 52, 18);
      F.draw(ctx, 'NET', 6, 5, '#bfe9f5');
      F.draw(ctx, 'SPD', 6, 13, '#bfe9f5');
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < up.net ? '#ffd56b' : 'rgba(255,255,255,0.18)'; ctx.fillRect(22 + i * 10, 5, 8, 5);
        ctx.fillStyle = i < up.speed ? '#7ef0c0' : 'rgba(255,255,255,0.18)'; ctx.fillRect(22 + i * 10, 13, 8, 5);
      }
    }
    // collection count (top-right)
    if (AQ.Collection) {
      const c = AQ.Collection.progress();
      const s = `LOG ${c.caught}/${c.total}`;
      const w = F.width(s) + 8;
      panel(ctx, vw - w - 3, 3, w, 10);
      F.draw(ctx, s, vw - w + 1, 5, '#ffe9a8');
    }
    // sneaking indicator
    if (game.player.sneaking) F.draw(ctx, 'SNEAKING', vw - 4, 16, '#9fe8ff', { align: 'right' });
    // toasts
    H.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 5, (t.life - t.t) * 2.5);
      ctx.globalAlpha = a;
      const w = F.width(t.text) + 10, y = vh - 40 - (H.toasts.length - 1 - i) * 11;
      panel(ctx, Math.round(vw / 2 - w / 2), y - 2, w, 10);
      F.draw(ctx, t.text, vw / 2, y, t.color, { align: 'center' });
      ctx.globalAlpha = 1;
    });
    // help
    if (H.showHelp) {
      const lines = [
        'MOVE WASD/ARROWS   SNEAK SHIFT',
        'NET SPACE/CLICK (HOLD TO PRY)   BAIT B/RCLICK',
        'AQUARIUM TAB   LOG L   MAP M   HELP H'
      ];
      const a = H.helpT > 0 ? 1 : 0.0;
      if (a > 0) {
        ctx.globalAlpha = Math.min(1, H.helpT);
        panel(ctx, 0, vh - 24, vw, 24);
        lines.forEach((l, i) => F.draw(ctx, l, vw / 2, vh - 22 + i * 7, '#d8f3ff', { align: 'center' }));
        ctx.globalAlpha = 1;
      }
    }
  };

  return H;
})();
