/** Runs `fn` while holding a lock; callers queue in order. */
export type Lock = <T>(fn: () => Promise<T>) => Promise<T>;

/** In-process lock: one holder at a time within this JS runtime. */
export function createMutex(): Lock {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

interface WebLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/**
 * Lock shared by every tab of the app on web (Web Locks API), so only one tab exchanges the
 * refresh token at a time and the others pick up its result from storage. Where Web Locks are
 * missing (and on native, which has one instance), an in-process lock is used; tabs then rely on
 * re-reading storage, the `storage` event and the server's reuse grace window.
 */
export function createRefreshLock(name = 'mhp-hypnose-auth-refresh'): Lock {
  const locks =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: WebLocks }).locks
      : undefined;
  if (locks && typeof locks.request === 'function') {
    return <T>(fn: () => Promise<T>) => locks.request(name, fn);
  }
  return createMutex();
}
