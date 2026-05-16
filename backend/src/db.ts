import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase;

export async function initDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  
  const dbPath = path.join(__dirname, '../data/word-helper.db');
  const dataDir = path.join(__dirname, '../data');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      english TEXT NOT NULL,
      part_of_speech TEXT,
      chinese TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS error_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      error_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_id) REFERENCES words(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS observation_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      correct_count INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_id) REFERENCES words(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS import_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  saveDb();
  
  return db;
}

export function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(__dirname, '../data/word-helper.db');
  fs.writeFileSync(dbPath, buffer);
}

export function getDb(): SqlJsDatabase {
  return db;
}

export function run(sql: string, params: any[] = []) {
  db.run(sql, params);
}

export function batchRun(operations: Array<{ sql: string; params?: any[] }>) {
  operations.forEach(op => {
    db.run(op.sql, op.params || []);
  });
  saveDb();
}

export function all(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

export function get(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}
