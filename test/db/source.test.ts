import Database from 'better-sqlite3';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSource } from '../../src/db/source.js';

const REAL_DB = 'data/category_tagging.sqlite';

function fixtureDb() {
  const path = join(mkdtempSync(join(tmpdir(), 'kct-')), 'fixture.sqlite');
  const db = new Database(path);
  db.exec(`
    create table manufacturer (id integer primary key, name text, domain text);
    create table category (id integer primary key, name text, definition text);
    create table manufacturer_scraped_data (id integer primary key, domain text, markdown text);
    insert into category values (1, 'Cold Brew', 'Coffee brewed cold.'), (2, 'Tea Mix', ''), (3, 'Bars', null);
    insert into manufacturer values (10, 'Acme', 'acme.com'), (11, 'No Scrape', 'none.com');
    insert into manufacturer_scraped_data values (10, 'acme.com', '# Acme');
  `);
  db.close();
  return path;
}

describe('source db', () => {
  it('reads the real dataset', () => {
    const src = openSource(REAL_DB);
    expect(src.listCategories()).toHaveLength(1424);
    expect(src.listManufacturerIds()).toHaveLength(30);
    const m = src.getManufacturer(402)!;
    expect(m.name).toBe('Carolina Beverage Group, LLC');
    expect(m.markdown).toHaveLength(63707);
    expect(src.taxonomyHash()).toMatch(/^[0-9a-f]{64}$/);
    src.close();
  });

  it('maps empty or null definitions to null', () => {
    const src = openSource(fixtureDb());
    expect(src.listCategories().map((c) => c.definition)).toEqual(['Coffee brewed cold.', null, null]);
  });

  it('returns undefined for an unknown manufacturer and empty markdown when unscraped', () => {
    const src = openSource(fixtureDb());
    expect(src.getManufacturer(999)).toBeUndefined();
    expect(src.getManufacturer(11)?.markdown).toBe('');
  });

  it('exposes readers only and refuses a database that is not there', () => {
    const src = openSource(fixtureDb());
    // The wrapper has no writer; the handle itself is opened readonly in source.ts.
    expect(Object.keys(src).sort()).toEqual(
      ['close', 'getManufacturer', 'listCategories', 'listManufacturerIds', 'taxonomyHash'],
    );
    expect(() => openSource(join(tmpdir(), 'kct-not-a-database.sqlite'))).toThrow();
  });
});
