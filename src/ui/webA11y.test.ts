import { dialogKey, radioKey, tabbables, type FocusableLike, type RootLike } from './webA11y';

function el(attrs: Record<string, string> = {}, over: Partial<FocusableLike> = {}): FocusableLike {
  const self: FocusableLike = {
    focus: jest.fn(),
    click: jest.fn(),
    getAttribute: (name) => attrs[name] ?? null,
    getClientRects: () => ({ length: 1 }),
    closest: (sel) => (sel === '[role="radio"]' && attrs.role === 'radio' ? self : null),
    ...over,
  };
  return self;
}
const root = (items: FocusableLike[]): RootLike => ({
  querySelectorAll: () => items,
  focus: jest.fn(),
});
const key = (k: string, extra: object = {}, target?: unknown) => ({
  key: k,
  target,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  ...extra,
});

describe('radioKey', () => {
  const radios = () => [el({ role: 'radio' }), el({ role: 'radio' }), el({ role: 'radio' })];

  it('moves to the next radio, wraps, and picks the one reached', () => {
    const r = radios();
    const e = key('ArrowDown', {}, r[2]);
    expect(radioKey(e, root(r))).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(r[0]!.focus).toHaveBeenCalled();
    expect(r[0]!.click).toHaveBeenCalled();

    const back = key('ArrowLeft', {}, r[0]);
    radioKey(back, root(r));
    expect(r[2]!.click).toHaveBeenCalled();
  });

  it('Home and End jump to the ends', () => {
    const r = radios();
    radioKey(key('End', {}, r[0]), root(r));
    expect(r[2]!.focus).toHaveBeenCalled();
    radioKey(key('Home', {}, r[1]), root(r));
    expect(r[0]!.focus).toHaveBeenCalled();
  });

  it('skips disabled radios, can move without picking, and ignores other keys', () => {
    const r = [
      el({ role: 'radio' }),
      el({ role: 'radio', 'aria-disabled': 'true' }),
      el({ role: 'radio' }),
    ];
    radioKey(key('ArrowRight', {}, r[0]), root(r), false);
    expect(r[1]!.focus).not.toHaveBeenCalled();
    expect(r[2]!.focus).toHaveBeenCalled();
    expect(r[2]!.click).not.toHaveBeenCalled();

    const other = key('a', {}, r[0]);
    expect(radioKey(other, root(r))).toBe(false);
    expect(other.preventDefault).not.toHaveBeenCalled();
    // Focus not on a radio (e.g. a text field inside the group): leave the arrows alone.
    expect(radioKey(key('ArrowDown', {}, el()), root(r))).toBe(false);
  });
});

describe('dialogKey', () => {
  it('Escape closes', () => {
    const onClose = jest.fn();
    const e = key('Escape');
    expect(dialogKey(e, root([]), { onClose }, null)).toBe(true);
    expect(onClose).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('Escape does nothing without a handler', () => {
    expect(dialogKey(key('Escape'), root([]), {}, null)).toBe(false);
  });

  it('Tab wraps from the last control to the first, Shift+Tab the other way', () => {
    const items = [el(), el(), el()];
    const r = root(items);
    const fwd = key('Tab');
    expect(dialogKey(fwd, r, { trap: true }, items[2])).toBe(true);
    expect(items[0]!.focus).toHaveBeenCalled();
    const bwd = key('Tab', { shiftKey: true });
    expect(dialogKey(bwd, r, { trap: true }, items[0])).toBe(true);
    expect(items[2]!.focus).toHaveBeenCalled();
    // In the middle the browser moves on its own.
    const mid = key('Tab');
    expect(dialogKey(mid, r, { trap: true }, items[1])).toBe(false);
    expect(mid.preventDefault).not.toHaveBeenCalled();
  });

  it('Tab from outside the dialog is pulled in; without trap it is left alone', () => {
    const items = [el(), el()];
    expect(dialogKey(key('Tab'), root(items), { trap: true }, el())).toBe(true);
    expect(items[0]!.focus).toHaveBeenCalled();
    expect(dialogKey(key('Tab'), root(items), {}, items[1])).toBe(false);
  });
});

describe('tabbables', () => {
  it('leaves out disabled, tabindex -1 and hidden controls', () => {
    const ok = el();
    const items = [
      ok,
      el({ 'aria-disabled': 'true' }),
      el({ tabindex: '-1' }),
      el({}, { disabled: true }),
      el({}, { getClientRects: () => ({ length: 0 }) }),
    ];
    expect(tabbables(root(items))).toEqual([ok]);
  });
});
