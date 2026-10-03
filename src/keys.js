// Key bindings, in one place. The bindings themselves are AQ.TUNING.keys (plus interactKeys,
// audio.muteKey, photo.key and station.zoomKey); the game asks this module whether an action was
// pressed, and tips / help / the Guide ask it for the key names, so the text always matches the keys.
//   AQ.Keys.list('sneak')        ['ShiftLeft', 'ShiftRight']
//   AQ.Keys.pressed('bait')      this frame (mouse buttons too: 'Mouse0' left, 'Mouse2' right)
//   AQ.Keys.down('sneak')        held now
//   AQ.Keys.name('bait')         'B / K / RIGHT CLICK'   ('move' -> 'WASD' or 'ARROWS')
//   AQ.Keys.fill('Hold {k:sneak} to sneak.')   -> 'Hold SHIFT to sneak.'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Keys = (function () {
  const K = {};
  const T = () => AQ.TUNING;
  K.list = function (action) {
    const t = T();
    if (action === 'interact') return t.interactKeys;
    if (action === 'mute') return [t.audio.muteKey];
    if (action === 'photo') return [t.photo.key];
    if (action === 'stationView') return [t.station.zoomKey];
    return t.keys[action] || [];
  };
  const keyCodes = (a) => K.list(a).filter((c) => !/^Mouse/.test(c));
  const buttons = (a) => K.list(a).filter((c) => /^Mouse/.test(c)).map((c) => +c.slice(5));
  K.pressed = (action) => AQ.Input.wasPressed(...keyCodes(action)) || buttons(action).some((b) => AQ.Input.mouse.pressed[b]);
  K.down = (action) => AQ.Input.isDown(...keyCodes(action)) || buttons(action).some((b) => AQ.Input.mouse.down[b]);

  // a readable name for one key code
  const NAMES = { Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSPACE', Delete: 'DEL',
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Mouse0: 'LEFT CLICK', Mouse1: 'MIDDLE CLICK', Mouse2: 'RIGHT CLICK' };
  K.codeName = function (code) {
    if (NAMES[code]) return NAMES[code];
    if (/^Key/.test(code)) return code.slice(3);
    if (/^Digit/.test(code)) return code.slice(5);
    if (/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code)) return code.replace(/(Left|Right)$/, '').replace('Control', 'CTRL').replace('Meta', 'CMD').toUpperCase();
    return code.toUpperCase();
  };
  K.name = function (action) {
    if (action === 'move') {
      // first binding of each direction: letters spell it ("WASD"), anything else joins up
      const first = ['up', 'left', 'down', 'right'].map((d) => K.codeName(K.list(d)[0] || ''));
      return first.every((n) => n.length === 1) ? first.join('') : first.join('/');
    }
    if (action === 'arrows') return ['up', 'left', 'down', 'right'].every((d) => K.list(d).some((c) => /^Arrow/.test(c))) ? 'ARROWS' : '';
    const out = [];
    for (const c of K.list(action)) { const n = K.codeName(c); if (out.indexOf(n) < 0) out.push(n); }
    return out.join(' / ');
  };
  // {k:action} -> the key name for that action
  K.fill = (text) => String(text).replace(/\{k:([a-zA-Z]+)\}/g, (m, a) => K.name(a));
  return K;
})();
