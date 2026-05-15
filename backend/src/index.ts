import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import db from './db';
import { parsePdf } from './pdfParser';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 托管前端静态文件
const staticDir = path.join(__dirname, '../public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// 确保uploads和data目录存在
const uploadsDir = path.join(__dirname, '../uploads');
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 保留原文件名，直接覆盖同名文件
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// API 路由

// 导入PDF文件
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const words = await parsePdf(filePath);

    // 清空现有单词
    db.exec('DELETE FROM words');

    // 插入新单词
    const insertStmt = db.prepare('INSERT INTO words (english, part_of_speech, chinese) VALUES (?, ?, ?)');
    for (const word of words) {
      insertStmt.run(word.english, word.part_of_speech, word.chinese);
    }

    // 保存导入记录
    db.prepare('INSERT INTO import_files (filename) VALUES (?)').run(req.file.originalname);

    res.json({ success: true, count: words.length, words });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import file' });
  }
});

// 获取单词列表（分页）
app.get('/api/words', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * pageSize;

  let query = 'SELECT * FROM words';
  let countQuery = 'SELECT COUNT(*) as total FROM words';
  const params: any[] = [];

  if (search) {
    query += ' WHERE english LIKE ? OR chinese LIKE ?';
    countQuery += ' WHERE english LIKE ? OR chinese LIKE ?';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  query += ' ORDER BY id LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const words = db.prepare(query).all(...params);
  const countResult = db.prepare(countQuery).get(...params.slice(0, -2)) as { total: number };

  res.json({
    words,
    total: countResult.total,
    page,
    pageSize
  });
});

// 添加到错题集
app.post('/api/error-words', (req, res) => {
  const { wordId } = req.body;
  db.prepare('INSERT OR IGNORE INTO error_words (word_id) VALUES (?)').run(wordId);
  res.json({ success: true });
});

// 从错题集移除并添加到观察室
app.delete('/api/error-words/:wordId', (req, res) => {
  const { wordId } = req.params;
  db.prepare('DELETE FROM error_words WHERE word_id = ?').run(wordId);
  db.prepare('INSERT OR IGNORE INTO observation_words (word_id) VALUES (?)').run(wordId);
  res.json({ success: true });
});

// 获取错题集
app.get('/api/error-words', (req, res) => {
  const words = db.prepare(`
    SELECT w.* FROM words w 
    JOIN error_words ew ON w.id = ew.word_id
  `).all();
  res.json({ words });
});

// 获取观察室单词
app.get('/api/observation-words', (req, res) => {
  const words = db.prepare(`
    SELECT w.*, ow.correct_count FROM words w 
    JOIN observation_words ow ON w.id = ow.word_id
  `).all();
  res.json({ words });
});

// 观察室单词拼写正确
app.post('/api/observation-words/:wordId/correct', (req, res) => {
  const { wordId } = req.params;
  const word = db.prepare('SELECT * FROM observation_words WHERE word_id = ?').get(wordId) as any;
  
  if (word) {
    const newCount = word.correct_count + 1;
    if (newCount >= 2) {
      // 正确超过2次，从观察室移除
      db.prepare('DELETE FROM observation_words WHERE word_id = ?').run(wordId);
    } else {
      db.prepare('UPDATE observation_words SET correct_count = ? WHERE word_id = ?').run(newCount, wordId);
    }
  }
  
  res.json({ success: true });
});

// 观察室单词拼写错误
app.post('/api/observation-words/:wordId/error', (req, res) => {
  const { wordId } = req.params;
  db.prepare('DELETE FROM observation_words WHERE word_id = ?').run(wordId);
  db.prepare('INSERT OR IGNORE INTO error_words (word_id) VALUES (?)').run(wordId);
  res.json({ success: true });
});

// 获取昨日错词（其实就是错题集）
app.get('/api/yesterday-errors', (req, res) => {
  const words = db.prepare(`
    SELECT w.* FROM words w 
    JOIN error_words ew ON w.id = ew.word_id
  `).all();
  res.json({ words });
});

// 保存/获取设置（如随手拼的进度）
app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  res.json({ value: setting?.value || null });
});

app.post('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
