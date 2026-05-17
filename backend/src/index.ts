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

  // 登录接口
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'carlos' && password === 'swq') {
      // 生成简单的token
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
      res.json({ success: true, token, username });
    } else {
      res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
  });

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
      const correctCount = parseInt(String(word.correct_count || '0'));
      const newCount = correctCount + 1;
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

  // 获取昨日错词（上次练习的错词）
  app.get('/api/yesterday-errors', (req, res) => {
    // 获取上一个已结束的练习会话
    const lastSession = get('SELECT * FROM practice_sessions WHERE status = ? ORDER BY id DESC LIMIT 1', ['completed']);
    
    if (!lastSession) {
      return res.json({ words: [], sessionId: null });
    }
    
    // 获取这个会话期间的错题
    const words = all(`
      SELECT w.*, ew.error_date FROM words w 
      JOIN error_words ew ON w.id = ew.word_id
      WHERE ew.error_date >= ? AND ew.error_date <= ?
      ORDER BY ew.error_date DESC
    `, [lastSession.start_time, lastSession.end_time]);
    
    res.json({ words, sessionId: lastSession.id });
  });

  // 开始新的练习会话
  app.post('/api/practice/start', (req, res) => {
    // 结束所有之前的活跃会话
    run('UPDATE practice_sessions SET status = ? WHERE status = ?', ['abandoned', 'active']);
    
    // 创建新会话
    const result = run('INSERT INTO practice_sessions (start_time, status) VALUES (datetime("now"), ?)', ['active']);
    const session = get('SELECT * FROM practice_sessions ORDER BY id DESC LIMIT 1');
    
    res.json({ success: true, sessionId: session?.id });
  });

  // 结束练习会话
  app.post('/api/practice/end', (req, res) => {
    const { sessionId } = req.body;
    
    if (sessionId) {
      run('UPDATE practice_sessions SET status = ?, end_time = datetime("now") WHERE id = ?', ['completed', sessionId]);
    } else {
      // 如果没有指定sessionId，结束所有活跃会话
      run('UPDATE practice_sessions SET status = ?, end_time = datetime("now") WHERE status = ?', ['completed', 'active']);
    }
    
    res.json({ success: true });
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

  // 获取单词树形结构
  app.get('/api/words/tree', (req, res) => {
    const search = (req.query.search as string) || '';

    // 获取所有单词
    let allWords;
    if (search) {
      const searchTerm = `%${search}%`;
      allWords = all('SELECT * FROM words WHERE english LIKE ? OR chinese LIKE ?', [searchTerm, searchTerm]);
    } else {
      allWords = all('SELECT * FROM words ORDER BY english');
    }

    // 获取所有关系
    const relations = all('SELECT * FROM word_relations');

    // 获取分类规则
    const rules = all('SELECT * FROM classification_rules WHERE active = 1 ORDER BY priority DESC');

    // 构建树形结构
    const wordMap = new Map<number, any>();
    const rootWords: any[] = [];
    const childWordIds = new Set<number>();

    // 先创建所有单词节点
    allWords.forEach(word => {
      wordMap.set(word.id, {
        ...word,
        children: [],
        derivatives: [],
        phrases: []
      });
    });

    // 处理关系
    relations.forEach(rel => {
      const child = wordMap.get(rel.child_word_id);
      const parent = wordMap.get(rel.root_word_id);
      
      if (child && parent) {
        childWordIds.add(rel.child_word_id);
        if (rel.relation_type === 'derivative') {
          parent.derivatives.push(child);
        } else {
          parent.phrases.push(child);
        }
      }
    });

    // 找出根词（没有被任何关系引用的词）
    wordMap.forEach((word, id) => {
      if (!childWordIds.has(id)) {
        rootWords.push(word);
      }
    });

    // 合并子词到children数组（用于前端展示）
    rootWords.forEach(word => {
      if (word.derivatives.length > 0 || word.phrases.length > 0) {
        word.hasChildren = true;
        word.children = [
          ...(word.derivatives.length > 0 ? [{ type: 'derivative', title: '衍生词', children: word.derivatives }] : []),
          ...(word.phrases.length > 0 ? [{ type: 'phrase', title: '短语', children: word.phrases }] : [])
        ];
      }
      delete word.derivatives;
      delete word.phrases;
    });

    res.json({ words: rootWords, total: rootWords.length });
  });

  // 添加单词关系
  app.post('/api/relations', (req, res) => {
    const { rootWordId, childWordId, relationType } = req.body;
    
    // 检查是否已存在
    const existing = get('SELECT * FROM word_relations WHERE root_word_id = ? AND child_word_id = ? AND relation_type = ?', 
                        [rootWordId, childWordId, relationType]);
    
    if (existing) {
      return res.json({ success: false, message: '关系已存在' });
    }

    run('INSERT INTO word_relations (root_word_id, child_word_id, relation_type) VALUES (?, ?, ?)',
        [rootWordId, childWordId, relationType]);
    saveDb();

    res.json({ success: true });
  });

  // 删除单词关系
  app.delete('/api/relations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    run('DELETE FROM word_relations WHERE id = ?', [id]);
    saveDb();
    res.json({ success: true });
  });

  // 删除某个单词的所有关系（设为独立词）
  app.delete('/api/relations/word/:wordId', (req, res) => {
    const wordId = parseInt(req.params.wordId);
    run('DELETE FROM word_relations WHERE child_word_id = ?', [wordId]);
    saveDb();
    res.json({ success: true });
  });

  // 重新分类所有单词
  app.post('/api/classify/all', (req, res) => {
    const { keepManual = false } = req.body;

    try {
      // 如果不保留手动调整，先清空所有关系
      if (!keepManual) {
        run('DELETE FROM word_relations');
      }

      // 获取所有单词
      const words = all('SELECT * FROM words');
      if (words.length === 0) {
        return res.json({ success: true, classified: 0 });
      }

      // 获取分类规则
      const rules = all('SELECT * FROM classification_rules WHERE active = 1 ORDER BY priority DESC');

      // 建立单词索引
      const wordIndex = new Map<string, number>();
      words.forEach(w => {
        wordIndex.set(w.english.toLowerCase(), w.id);
      });

      // 智能分类算法
      let classifiedCount = 0;

      for (const word of words) {
        const english = word.english.toLowerCase().trim();
        
        // 判断是否是短语（包含空格）
        if (english.includes(' ')) {
          // 尝试找到核心词
          const coreWord = extractCoreWord(english, wordIndex);
          if (coreWord && coreWord !== word.id) {
            // 检查是否已存在关系
            const existing = get('SELECT * FROM word_relations WHERE root_word_id = ? AND child_word_id = ? AND relation_type = ?',
                              [coreWord, word.id, 'phrase']);
            if (!existing) {
              run('INSERT INTO word_relations (root_word_id, child_word_id, relation_type) VALUES (?, ?, ?)',
                  [coreWord, word.id, 'phrase']);
              classifiedCount++;
            }
          }
        } else {
          // 尝试匹配词根
          const rootWord = findRootWord(english, wordIndex, rules);
          if (rootWord && rootWord !== word.id) {
            // 检查是否已存在关系
            const existing = get('SELECT * FROM word_relations WHERE root_word_id = ? AND child_word_id = ? AND relation_type = ?',
                              [rootWord, word.id, 'derivative']);
            if (!existing) {
              run('INSERT INTO word_relations (root_word_id, child_word_id, relation_type) VALUES (?, ?, ?)',
                  [rootWord, word.id, 'derivative']);
              classifiedCount++;
            }
          }
        }
      }

      saveDb();
      res.json({ success: true, classified: classifiedCount, total: words.length });
    } catch (error) {
      console.error('Classification error:', error);
      res.status(500).json({ success: false, message: '分类失败' });
    }
  });

  // 获取所有根词（用于手动调整）
  app.get('/api/words/roots', (req, res) => {
    // 获取所有没有作为子词出现的单词
    const childIds = all('SELECT DISTINCT child_word_id FROM word_relations').map(r => r.child_word_id);
    let roots;
    
    if (childIds.length > 0) {
      roots = all(`SELECT * FROM words WHERE id NOT IN (${childIds.join(',')}) ORDER BY english`);
    } else {
      roots = all('SELECT * FROM words ORDER BY english');
    }
    
    res.json({ words: roots });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// 从短语中提取核心词
function extractCoreWord(phrase: string, wordIndex: Map<string, number>): number | null {
  const parts = phrase.split(' ');
  
  // 尝试第一个词
  if (wordIndex.has(parts[0])) {
    return wordIndex.get(parts[0]) || null;
  }
  
  // 尝试去除常见介词后的第一个词
  const prepositions = ['to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'of', 'up', 'out', 'into', 'over', 'under'];
  for (let i = 0; i < parts.length; i++) {
    if (!prepositions.includes(parts[i])) {
      if (wordIndex.has(parts[i])) {
        return wordIndex.get(parts[i]) || null;
      }
    }
  }
  
  return null;
}

// 查找根词
function findRootWord(word: string, wordIndex: Map<string, number>, rules: any[]): number | null {
  // 按优先级尝试匹配词缀
  for (const rule of rules) {
    const suffix = rule.suffix;
    
    if (word.endsWith(suffix)) {
      const root = word.slice(0, -suffix.length);
      // 处理特殊情况：如果后缀是 'tion'，可能需要去掉前面的 'a' 或 'i'
      if (suffix === 'tion' || suffix === 'ation') {
        if (root.endsWith('a') || root.endsWith('i')) {
          const altRoot = root.slice(0, -1);
          if (wordIndex.has(altRoot)) {
            return wordIndex.get(altRoot) || null;
          }
        }
      }
      if (wordIndex.has(root)) {
        return wordIndex.get(root) || null;
      }
    }
    
    // 尝试前缀
    if (word.startsWith(suffix)) {
      const root = word.slice(suffix.length);
      if (wordIndex.has(root)) {
        return wordIndex.get(root) || null;
      }
    }
  }
  
  return null;
}

startServer();
