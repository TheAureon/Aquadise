// In-world HUD drawn on the low-res canvas with the bitmap font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.HUD = (function () {
  const H = { banner: null, bannerT: 0, toasts: [], showHelp: true, helpT: 14, lastZone: '' };

  H.toast = function (text, color = '#ffffff', time = 2.6) {
    H.toasts.push({ text, color, t: 0, life: time });
    if (H.toasts.length > 3) H.toasts.shift();
  };

  H.update = function (dt, game) {
    const p = game.player;
    const zone = AQ.Scenes.zoneName(game);
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

  // Minimal HUD: no boxes, just small shadowed text that stays out of the way of the scene.
  const SH = 'rgba(4,12,24,0.75)';
  H.draw = function (ctx, game) {
    const F = AQ.Font, vw = AQ.TUNING.view.w, vh = AQ.TUNING.view.h;
    // biome name: fades in, lingers briefly, fades out
    if (H.banner && H.bannerT < 3) {
      ctx.globalAlpha = Math.min(1, H.bannerT * 2.5, (3 - H.bannerT) * 1.5);
      F.draw(ctx, H.banner, vw / 2, 7, '#f2fbff', { align: 'center', shadow: SH });
      ctx.globalAlpha = 1;
    }
    // upgrades as quiet pips (top-left)
    const up = game.upgrades;
    if (up) {
      ctx.globalAlpha = 0.85;
      F.draw(ctx, 'NET', 4, 4, '#cfeaf5', { shadow: SH });
      F.draw(ctx, 'SPD', 4, 11, '#cfeaf5', { shadow: SH });
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = SH; ctx.fillRect(20 + i * 5, 6, 4, 3); ctx.fillRect(20 + i * 5, 13, 4, 3);
        ctx.fillStyle = i < up.net ? '#ffd56b' : 'rgba(255,255,255,0.22)'; ctx.fillRect(19 + i * 5, 5, 4, 3);
        ctx.fillStyle = i < up.speed ? '#7ef0c0' : 'rgba(255,255,255,0.22)'; ctx.fillRect(19 + i * 5, 12, 4, 3);
      }
      ctx.globalAlpha = 1;
    }
    // collection progress (top-right)
    if (AQ.Collection) {
      const c = AQ.Collection.progress();
      ctx.globalAlpha = 0.85;
      F.draw(ctx, `${c.caught}/${c.total}`, vw - 4, 4, '#ffe9a8', { align: 'right', shadow: SH });
      ctx.globalAlpha = 1;
    }
    if (game.player.sneaking) { ctx.globalAlpha = 0.8; F.draw(ctx, 'SNEAKING', 4, 19, '#9fe8ff', { shadow: SH }); ctx.globalAlpha = 1; }
    // toasts: at most two, newest at the bottom
    const shown = H.toasts.slice(-2);
    shown.forEach((t, i) => {
      ctx.globalAlpha = Math.min(1, t.t * 5, (t.life - t.t) * 2.5);
      F.draw(ctx, t.text, vw / 2, vh - 20 - (shown.length - 1 - i) * 8, t.color, { align: 'center', shadow: SH });
      ctx.globalAlpha = 1;
    });
    // help (first moments only, or when H is pressed)
    if (H.showHelp && H.helpT > 0) {
      ctx.globalAlpha = Math.min(1, H.helpT) * 0.9;
      const lines = ['MOVE WASD  JUMP SPACE  SNEAK SHIFT  NET LEFT CLICK (HOLD TO PRY)', 'BAIT B / RIGHT CLICK   INTERACT E   LOG L   MAP M   HELP H'];
      lines.forEach((l, i) => F.draw(ctx, l, vw / 2, vh - 15 + i * 7, '#d8f3ff', { align: 'center', shadow: SH }));
      ctx.globalAlpha = 1;
    }
  };

  return H;
})();
