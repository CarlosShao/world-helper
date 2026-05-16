import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb, run, all, get, batchRun, saveDb } from './db';
import { parsePdf } from './pdfParser';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 初始化数据库
async function startServer() {
  await initDb();

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

  // 确保uploads目录存在
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // 配置文件上传
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
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

      // 批量操作：清空现有单词 + 插入新单词
      const operations: Array<{ sql: string; params?: any[] }> = [
        { sql: 'DELETE FROM words' }
      ];
      
      for (const word of words) {
        operations.push({
          sql: 'INSERT INTO words (english, part_of_speech, chinese) VALUES (?, ?, ?)',
          params: [word.english, word.part_of_speech, word.chinese]
        });
      }
      
      operations.push({
        sql: 'INSERT INTO import_files (filename) VALUES (?)',
        params: [req.file.originalname]
      });

      batchRun(operations);

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

    let words;
    let total;

    if (search) {
      const searchTerm = `%${search}%`;
      words = all('SELECT * FROM words WHERE english LIKE ? OR chinese LIKE ? ORDER BY id LIMIT ? OFFSET ?', 
                  [searchTerm, searchTerm, pageSize, offset]);
      total = get('SELECT COUNT(*) as total FROM words WHERE english LIKE ? OR chinese LIKE ?', 
                  [searchTerm, searchTerm])?.total || 0;
    } else {
      words = all('SELECT * FROM words ORDER BY id LIMIT ? OFFSET ?', [pageSize, offset]);
      total = get('SELECT COUNT(*) as total FROM words')?.total || 0;
    }

    res.json({
      words,
      total,
      page,
      pageSize
    });
  });

  // 添加到错题集
  app.post('/api/error-words', (req, res) => {
    const { wordId } = req.body;
    // 检查是否已存在
    const existing = get('SELECT * FROM error_words WHERE word_id = ?', [wordId]);
    if (!existing) {
      run('INSERT INTO error_words (word_id) VALUES (?)', [wordId]);
    }
    res.json({ success: true });
  });

  // 从错题集移除并添加到观察室
  app.delete('/api/error-words/:wordId', (req, res) => {
    const wordId = parseInt(req.params.wordId);
    run('DELETE FROM error_words WHERE word_id = ?', [wordId]);
    const existing = get('SELECT * FROM observation_words WHERE word_id = ?', [wordId]);
    if (!existing) {
      run('INSERT INTO observation_words (word_id, correct_count) VALUES (?, 0)', [wordId]);
    }
    res.json({ success: true });
  });

  // 获取错题集
  app.get('/api/error-words', (req, res) => {
    const words = all(`
      SELECT w.* FROM words w 
      JOIN error_words ew ON w.id = ew.word_id
    `);
    res.json({ words });
  });

  // 获取观察室单词
  app.get('/api/observation-words', (req, res) => {
    const words = all(`
      SELECT w.*, ow.correct_count FROM words w 
      JOIN observation_words ow ON w.id = ow.word_id
    `);
    res.json({ words });
  });

  // 观察室单词拼写正确
  app.post('/api/observation-words/:wordId/correct', (req, res) => {
    const wordId = parseInt(req.params.wordId);
    const word = get('SELECT * FROM observation_words WHERE word_id = ?', [wordId]);
    
    if (word) {
      const newCount = (word.correct_count || 0) + 1;
      if (newCount >= 2) {
        run('DELETE FROM observation_words WHERE word_id = ?', [wordId]);
      } else {
        run('UPDATE observation_words SET correct_count = ? WHERE word_id = ?', [newCount, wordId]);
      }
    }
    
    res.json({ success: true });
  });

  // 观察室单词拼写错误
  app.post('/api/observation-words/:wordId/error', (req, res) => {
    const wordId = parseInt(req.params.wordId);
    run('DELETE FROM observation_words WHERE word_id = ?', [wordId]);
    const existing = get('SELECT * FROM error_words WHERE word_id = ?', [wordId]);
    if (!existing) {
      run('INSERT INTO error_words (word_id) VALUES (?)', [wordId]);
    }
    res.json({ success: true });
  });

  // 获取昨日错词（其实就是错题集）
  app.get('/api/yesterday-errors', (req, res) => {
    const words = all(`
      SELECT w.* FROM words w 
      JOIN error_words ew ON w.id = ew.word_id
    `);
    res.json({ words });
  });

  // 保存/获取设置（如随手拼的进度）
  app.get('/api/settings/:key', (req, res) => {
    const { key } = req.params;
    const setting = get('SELECT value FROM settings WHERE key = ?', [key]);
    res.json({ value: setting?.value || null });
  });

  app.post('/api/settings/:key', (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const existing = get('SELECT * FROM settings WHERE key = ?', [key]);
    if (existing) {
      run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
    } else {
      run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
    res.json({ success: true });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
