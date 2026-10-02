// In-world HUD drawn on the low-res canvas with the bitmap font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.HUD = (function () {
  const H = { banner: null, bannerT: 0, toasts: [], showHelp: true, helpT: 14, lastZone: '' };

  H.toast = function (text, color = '#ffffff', time = 2.6) {
    H.toasts.push({ text, color, t: 0, life: time });
    AQ.Audio.play('toast');
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
  H.clockText = function () {
    const h = AQ.Clock.hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    return `${AQ.Clock.phase().toUpperCase()} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  // 9x7 pixel icon for the current phase
  const SUN = ['..#.#.#..', '...###...', '.#######.', '..#####..', '.#######.', '...###...', '..#.#.#..'];
  const MOON = ['...###...', '..##.....', '.##......', '.##......', '.##......', '..##.....', '...###...'];
  const RISE = ['.........', '#...#...#', '..#####..', '.#######.', '#########', '.........', '#########'];
  function drawClockIcon(ctx, x, y) {
    const p = AQ.Clock.phase(), icon = p === 'day' ? SUN : p === 'night' ? MOON : RISE;
    const col = p === 'day' ? '#ffe36b' : p === 'night' ? '#d8e4ff' : '#ffb27a';
    ctx.globalAlpha = 0.9;
    icon.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = 'rgba(4,12,24,0.75)'; ctx.fillRect(x + rx + 1, y + ry + 1, 1, 1); } }));
    icon.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = col; ctx.fillRect(x + rx, y + ry, 1, 1); } }));
    ctx.globalAlpha = 1;
  }

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
      // one row per upgrade: label + pips (lit = your level)
      const rows = [
        ['NET', up.net, AQ.TUNING.net.maxLevel, '#ffd56b'], ['SPD', up.speed, AQ.TUNING.speedMaxLevel, '#7ef0c0'],
        ['LAMP', up.lantern || 0, AQ.TUNING.upgrades.lanternMax, '#ffe9a8'], ['DEEP', up.depth || 0, AQ.TUNING.upgrades.depthMax, '#9fd8ff']
      ];
      ctx.globalAlpha = 0.85;
      rows.forEach(([label, lvl, max, col], r) => {
        const y = 4 + r * 7;
        F.draw(ctx, label, 4, y, '#cfeaf5', { shadow: SH });
        for (let i = 0; i < max; i++) {
          ctx.fillStyle = SH; ctx.fillRect(24 + i * 5, y + 2, 4, 3);
          ctx.fillStyle = i < lvl ? col : 'rgba(255,255,255,0.22)'; ctx.fillRect(23 + i * 5, y + 1, 4, 3);
        }
      });
      ctx.globalAlpha = 1;
    }
    // the time of day (sea only): sun, sunrise/sunset or moon
    if (game.scene === 'world') drawClockIcon(ctx, vw - 12, 12);
    // collection progress (top-right)
    if (AQ.Collection) {
      const c = AQ.Collection.progress();
      ctx.globalAlpha = 0.85;
      F.draw(ctx, `${c.discovered}/${c.total}`, vw - 4, 4, '#ffe9a8', { align: 'right', shadow: SH });
      ctx.globalAlpha = 1;
    }
    if (game.player.sneaking) { ctx.globalAlpha = 0.8; F.draw(ctx, 'SNEAKING', 4, 34, '#9fe8ff', { shadow: SH }); ctx.globalAlpha = 1; }
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
      const lines = ['MOVE WASD  JUMP SPACE  SNEAK SHIFT  NET LEFT CLICK (HOLD TO PRY)', 'BAIT B / RIGHT CLICK   INTERACT E   LOG L   MAP M   HELP H   MUTE O'];
      lines.forEach((l, i) => F.draw(ctx, l, vw / 2, vh - 15 + i * 7, '#d8f3ff', { align: 'center', shadow: SH }));
      ctx.globalAlpha = 1;
    }
  };

  return H;
})();
