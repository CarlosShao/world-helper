import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';

let db: SqlJsDatabase;
let isHuggingFace: boolean = false;
let hfToken: string | null = null;
const dbFileName = 'word-helper.db';
let lastUploadTime = 0;
const minUploadInterval = 60000;

const hubRepoId = process.env.HF_REPO_ID 
  || process.env.HF_SPACE_ID 
  || 'CarlosShao/word-helper';

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, dbFileName);

function getDbHash(buffer: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(buffer).digest('hex');
}

async function downloadFromHub(): Promise<Buffer | null> {
  if (!hfToken) {
    console.log('[DB] HuggingFace token not found, skipping cloud download');
    return null;
  }

  try {
    console.log('[DB] Downloading database from HuggingFace Hub...');
    const url = `https://huggingface.co/api/spaces/${hubRepoId}/resolve/main/data/${dbFileName}`;
    
    return await new Promise((resolve, reject) => {
      const req = https.request(url, {
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Accept': 'application/octet-stream',
        }
      }, (res) => {
        if (res.statusCode === 404) {
          console.log('[DB] No existing database found on Hub, will create new one');
          resolve(null);
          return;
        }
        
        if (res.statusCode !== 200) {
          console.log(`[DB] Failed to download: HTTP ${res.statusCode}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`[DB] Downloaded database from Hub: ${buffer.length} bytes`);
          resolve(buffer);
        });
        res.on('error', reject);
      });
      
      req.on('error', (err) => {
        console.log('[DB] Network error during download:', err.message);
        resolve(null);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        console.log('[DB] Download timeout');
        resolve(null);
      });
      
      req.end();
    });
  } catch (error) {
    console.log('[DB] Error downloading from Hub:', error);
    return null;
  }
}

export async function uploadToHub(): Promise<boolean> {
  if (!hfToken) {
    return false;
  }

  const now = Date.now();
  if (now - lastUploadTime < minUploadInterval) {
    console.log('[DB] Skipping upload, too soon since last upload');
    return false;
  }

  const data = db.export();
  const buffer = Buffer.from(data);

  try {
    console.log('[DB] Uploading database to HuggingFace Hub...');
    
    const url = new URL(`https://huggingface.co/api/spaces/${hubRepoId}/commit/main`);
    
    const payload = {
      summary: 'Update database',
      description: 'Auto-saved database from word-helper app',
      additions: [
        {
          path: `data/${dbFileName}`,
          content: buffer.toString('base64')
        }
      ]
    };

    return await new Promise((resolve) => {
      const jsonPayload = JSON.stringify(payload);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonPayload),
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[DB] Successfully uploaded to HuggingFace Hub');
            lastUploadTime = now;
            resolve(true);
          } else {
            console.log(`[DB] Upload failed: HTTP ${res.statusCode}`);
            console.log('[DB] Response:', responseBody);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.log('[DB] Upload error:', err.message);
        resolve(false);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        console.log('[DB] Upload timeout');
        resolve(false);
      });

      req.write(jsonPayload);
      req.end();
    });
  } catch (error) {
    console.log('[DB] Error uploading to Hub:', error);
    return false;
  }
}

export async function initDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  hfToken = process.env.HF_TOKEN || null;
  isHuggingFace = !!hfToken;
  
  console.log(`[DB] Environment: ${isHuggingFace ? 'HuggingFace' : 'Local'}`);
  console.log(`[DB] HuggingFace Token: ${hfToken ? 'configured' : 'not configured'}`);
  console.log(`[DB] Repository ID: ${hubRepoId}`);
  
  let dbLoaded = false;
  
  if (isHuggingFace && hfToken) {
    const cloudDb = await downloadFromHub();
    if (cloudDb) {
      db = new SQL.Database(cloudDb);
      dbLoaded = true;
    }
  }
  
  if (!dbLoaded && fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('[DB] Loaded local database');
  } else if (!dbLoaded) {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      english TEXT NOT NULL,
      part_of_speech TEXT,
      chinese TEXT NOT NULL,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_classified INTEGER DEFAULT 0
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_words_english ON words(english)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_words_chinese ON words(chinese)`);
  
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
  
  db.run(`
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      status TEXT DEFAULT 'active'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS word_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      root_word_id INTEGER NOT NULL,
      child_word_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (root_word_id) REFERENCES words(id),
      FOREIGN KEY (child_word_id) REFERENCES words(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_relations_root ON word_relations(root_word_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_relations_child ON word_relations(child_word_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS classification_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suffix TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_file_id INTEGER NOT NULL,
      index_number INTEGER NOT NULL,
      english TEXT,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (import_file_id) REFERENCES import_files(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parts_of_speech (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existingRules = all('SELECT COUNT(*) as count FROM classification_rules');
  if (existingRules[0]?.count === 0) {
    const rules = [
      { suffix: 'tion', description: '名词后缀', priority: 10 },
      { suffix: 'ation', description: '名词后缀', priority: 10 },
      { suffix: 'al', description: '形容词后缀', priority: 9 },
      { suffix: 'ly', description: '副词后缀', priority: 8 },
      { suffix: 'er', description: '名词后缀(人/物)', priority: 7 },
      { suffix: 'or', description: '名词后缀(人/物)', priority: 7 },
      { suffix: 'ing', description: '动名词/形容词', priority: 6 },
      { suffix: 'ed', description: '过去式/分词', priority: 6 },
      { suffix: 'ness', description: '名词后缀', priority: 5 },
      { suffix: 'ment', description: '名词后缀', priority: 5 },
      { suffix: 'able', description: '形容词后缀', priority: 4 },
      { suffix: 'ible', description: '形容词后缀', priority: 4 },
      { suffix: 'ful', description: '形容词后缀', priority: 3 },
      { suffix: 'less', description: '形容词后缀', priority: 3 },
      { suffix: 'ity', description: '名词后缀', priority: 2 },
      { suffix: 'ize', description: '动词后缀', priority: 2 },
      { suffix: 'ise', description: '动词后缀', priority: 2 },
      { suffix: 'ous', description: '形容词后缀', priority: 1 },
      { suffix: 'ive', description: '形容词后缀', priority: 1 },
      { suffix: 'un', description: '否定前缀', priority: 0 },
      { suffix: 're', description: '重复前缀', priority: 0 },
      { suffix: 'pre', description: '前前缀', priority: 0 },
      { suffix: 'dis', description: '否定前缀', priority: 0 },
    ];
    rules.forEach(rule => {
      run('INSERT INTO classification_rules (suffix, description, priority, active) VALUES (?, ?, ?, ?)', 
          [rule.suffix, rule.description, rule.priority, 1]);
    });
  }

  saveDb();
  
  return db;
}

export function saveDb(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  
  fs.writeFileSync(dbPath, buffer);
}

export function getDb(): SqlJsDatabase {
  return db;
}

export function run(sql: string, params: any[] = []): void {
  db.run(sql, params);
}

export function batchRun(operations: Array<{ sql: string; params?: any[] }>): void {
  operations.forEach(op => {
    db.run(op.sql, op.params || []);
  });
  saveDb();
}

export function all(sql: string, params: any[] = []): any[] {
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

export function get(sql: string, params: any[] = []): any | null {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}
