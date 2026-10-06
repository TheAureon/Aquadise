// Glass panes: the one building material, used for every tank (src/aquarium.js EXPAND).
// Chests drop a few (AQ.TUNING.panes), on top of their usual upgrade. Saved as a plain number,
// AQ.State.panes (older saves start with 0). The name is pane.name in data/lang/en.js.
//   AQ.Panes.count()        how many you have
//   AQ.Panes.add(n)         found some (the first time also shows the panes tip)
//   AQ.Panes.spend(n)       true if you had enough (and they're used), false otherwise (nothing changes)
//   AQ.Panes.name(n)        "glass pane" / "glass panes" (the right plural for n)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Panes = (function () {
  const P = {};
  const cfg = () => AQ.TUNING.panes;
  P.count = () => Math.max(0, Math.floor(AQ.State.panes || 0));
  P.has = (n) => P.count() >= n;
  // seen any yet? (the HUD counter only shows once you have)
  P.known = () => P.count() > 0 || !!(AQ.State.flags && AQ.State.flags.panes);
  P.add = function (n) {
    if (!(n > 0)) return;
    AQ.State.panes = P.count() + Math.floor(n);
    AQ.State.flags = AQ.State.flags || {}; AQ.State.flags.panes = true;
    if (AQ.Tips) AQ.Tips.event('panes');
    AQ.Save && AQ.Save.dirty();
  };
  P.spend = function (n) {
    if (!P.has(n)) return false;
    AQ.State.panes = P.count() - n;
    AQ.Save && AQ.Save.dirty();
    return true;
  };
  // a chest's share: chestMin..chestMax (inclusive)
  P.roll = () => { const c = cfg(); return c.chestMin + Math.floor(Math.random() * (c.chestMax - c.chestMin + 1)); };
  P.name = (n) => AQ.t('pane.name', { n });
  // TESTING ONLY (AQ.TUNING.debug.hundredPanes): top up to 100 panes when a game loads or starts
  P.debugTopUp = function () {
    if (AQ.TUNING.debug.hundredPanes && P.count() < 100) { AQ.State.panes = 100; AQ.State.flags = AQ.State.flags || {}; AQ.State.flags.panes = true; }
  };

  // the little pane icon (ui.pane sprite, 8 x 8) and the count beside it; right-aligned at x
  P.drawCounter = function (g, x, y, opts = {}) {
    const F = AQ.Font, txt = String(P.count()), w = F.width(txt);
    F.draw(g, txt, x - 10, y + 1, opts.color || '#cfeefa', { align: 'right', shadow: opts.shadow == null ? 'rgba(4,12,24,0.75)' : opts.shadow });
    AQ.Assets.draw(g, 'ui.pane', 'idle', x - 4, y + 3, { t: AQ.Render ? AQ.Render.t : 0 });
    return w + 11;                                 // how wide it is (number + gap + icon)
  };
  return P;
})();
