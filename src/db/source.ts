// The provided dataset, read-only: 30 manufacturers with their scraped markdown, 1,424 categories.
// Called by: cli.ts and api/server.ts at startup, into `deps.src`. pipeline/tag.ts reads one
// manufacturer from it; index/taxonomy.ts reads every category from it.
// Calls: nothing. Writes: nothing, ever - everything derived goes to artifacts/ (see db/store.ts).

import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

export type Category = { id: number; name: string; definition: string | null };
export type Manufacturer = { id: number; name: string; domain: string; markdown: string };

// The provided SQLite is never written to: opened read-only, derived data goes to artifacts/.
export function openSource(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true });

  const categories = db.prepare<[], Category>(
    'select id, name, definition from category order by id',
  );
  const manufacturer = db.prepare<[number], Manufacturer>(
    `select m.id, m.name, m.domain, coalesce(s.markdown, '') as markdown
       from manufacturer m left join manufacturer_scraped_data s on s.id = m.id
      where m.id = ?`,
  );
  const ids = db.prepare<[], { id: number }>('select id from manufacturer order by id');

  return {
    listCategories(): Category[] {
      return categories.all().map((c) => ({ ...c, definition: c.definition?.trim() || null }));
    },
    getManufacturer(id: number): Manufacturer | undefined {
      return manufacturer.get(id);
    },
    listManufacturerIds(): number[] {
      return ids.all().map((r) => r.id);
    },
    // Part of every cache key: a changed taxonomy invalidates index and results.
    taxonomyHash(): string {
      const h = createHash('sha256');
      for (const c of this.listCategories()) h.update(`${c.id}\t${c.name}\t${c.definition ?? ''}\n`);
      return h.digest('hex');
    },
    close() {
      db.close();
    },
  };
}

export type SourceDb = ReturnType<typeof openSource>;
