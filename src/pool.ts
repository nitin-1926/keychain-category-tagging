// A fixed number of workers over a list; results come back in input order (the profile's merge
// prompt depends on window order). Used by the three places that run many things at once: the
// profile's windows (pipeline/profile.ts), a job's manufacturers (api/jobs.ts) and `cli tag-all`.
// A failure stops new items from starting, but the calls already in flight are awaited before it
// is thrown: otherwise they would keep spending after the caller had stored its bill.
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      try {
        out[i] = await fn(items[i]!, i);
      } catch (e) {
        next = items.length;
        throw e;
      }
    }
  };
  const settled = await Promise.allSettled(Array.from({ length: Math.min(n, items.length) }, worker));
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed) throw failed.reason;
  return out;
}
