/** Bound concurrent list-detail requests; abandoned queued work never reaches the server. */
export function createRequestLimiter(limit: number) {
  let running = 0;
  const pending: (() => void)[] = [];
  const drain = () => { while (running < limit && pending.length) pending.shift()?.(); };
  return <T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> => new Promise((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) { reject(signal.reason); return; }
      running++;
      void Promise.resolve().then(work).then(resolve, reject).finally(() => { running--; drain(); });
    };
    const cancel = () => { const index = pending.indexOf(start); if (index >= 0) pending.splice(index, 1); reject(signal.reason); };
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener("abort", cancel, { once: true });
    pending.push(start); drain();
  });
}
