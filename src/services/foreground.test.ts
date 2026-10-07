import { AppState } from 'react-native';

import { subscribeForeground, throttle } from './foreground';

describe('throttle', () => {
  it('runs at most once per interval, the first call at once', () => {
    let t = 1000;
    const fn = jest.fn();
    const run = throttle(fn, 60_000, () => t);
    run();
    run();
    expect(fn).toHaveBeenCalledTimes(1);
    t += 59_999;
    run();
    expect(fn).toHaveBeenCalledTimes(1);
    t += 1;
    run();
    expect(fn).toHaveBeenCalledTimes(2);
    t += 1;
    run();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('subscribeForeground', () => {
  it('fires when the app becomes active, not when it goes to the background', () => {
    let listener: ((state: string) => void) | null = null;
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      fn: (state: string) => void,
    ) => {
      listener = fn;
      return { remove };
    }) as never);
    const onForeground = jest.fn();
    const stop = subscribeForeground(onForeground);
    listener!('background');
    expect(onForeground).not.toHaveBeenCalled();
    listener!('active');
    expect(onForeground).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
