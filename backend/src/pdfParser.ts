import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  
  // 【重要】打印前100行原始内容，看看PDF实际是什么样的
  console.log('=== PDF原始内容（前100行）===');
  lines.slice(0, 100).forEach((line, i) => {
    console.log(`${i}: ${line}`);
  });
  console.log('==============================');
  
  // 方法1：尝试找到所有数字序号
  const allNumberedIndices: Array<{ index: number; lineNum: number }> = [];
  lines.forEach((line, i) => {
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]);
      allNumberedIndices.push({ index, lineNum: i });
    }
  });
  
  console.log(`找到 ${allNumberedIndices.length} 个数字序号`);
  
  // 方法1A：尝试将整个PDF看作一个连续的序列，每两条组成一个单词-释义对
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  if (allNumberedIndices.length > 0) {
    console.log('=== 尝试方法1：将序号按顺序配对 ===');
    
    // 假设：同一个序号出现两次（第一次是英语，第二次是释义）
    const indexCount = new Map<number, Array<{ lineNum: number; content: string[] }>>();
    
    for (let i = 0; i < allNumberedIndices.length; i++) {
      const { index, lineNum } = allNumberedIndices[i];
      const nextIndex = i < allNumberedIndices.length - 1 ? allNumberedIndices[i + 1].lineNum : lines.length;
      
      const content: string[] = [];
      for (let j = lineNum + 1; j < nextIndex && j < lines.length; j++) {
        const line = lines[j];
        if (line === 'WordMeaning') break;
        content.push(line);
      }
      
      if (content.length > 0) {
        if (!indexCount.has(index)) {
          indexCount.set(index, []);
        }
        indexCount.get(index)!.push({ lineNum, content });
      }
    }
    
    console.log(`序号分布：`);
    indexCount.forEach((entries, index) => {
      console.log(`  ${index}: ${entries.length}次`);
    });
    
    // 对于出现2次的序号，假设第一次是英语，第二次是释义
    indexCount.forEach((entries, index) => {
      if (entries.length === 2) {
        let english = entries[0].content.join(' ').trim();
        let meaning = entries[1].content.join(' ').trim();
        
        console.log(`序号${index}: 英语="${english}" | 释义="${meaning}"`);
        
        // 过滤纯数字
        if (/^\d+$/.test(english)) {
          console.log(`跳过纯数字：${english}`);
          return;
        }
        
        let part_of_speech = '';
        let chinese = meaning;
        
        const posMatch = meaning.match(/^([a-z]+\.?)\s*(.*)$/i);
        if (posMatch) {
          part_of_speech = posMatch[1].trim();
          chinese = posMatch[2].trim();
        }
        
        words.push({
          english,
          part_of_speech,
          chinese
        });
      }
    });
  }
  
  console.log(`方法1找到 ${words.length} 个单词`);
  
  // 如果方法1没找到足够的单词，尝试原来的方法
  if (words.length < 10) {
    console.log('方法1没找到足够单词，尝试双栏模式...');
    
    const wordMeaningIndices: number[] = [];
    lines.forEach((line, i) => {
      if (line === 'WordMeaning') {
        wordMeaningIndices.push(i);
      }
    });
    
    console.log(`找到 ${wordMeaningIndices.length} 个WordMeaning标记`);
    
    if (wordMeaningIndices.length >= 2) {
      const wordsStart = wordMeaningIndices[0] + 1;
      const meaningsStart = wordMeaningIndices[1] + 1;
      const wordsEnd = wordMeaningIndices.length > 2 ? wordMeaningIndices[2] : lines.length;
      const meaningsEnd = wordMeaningIndices.length > 3 ? wordMeaningIndices[3] : lines.length;
      
      console.log(`英语范围: ${wordsStart}-${wordsEnd}`);
      console.log(`释义范围: ${meaningsStart}-${meaningsEnd}`);
      
      const englishMap = parseColumn(lines.slice(wordsStart, wordsEnd));
      const meaningMap = parseColumn(lines.slice(meaningsStart, meaningsEnd));
      
      console.log(`英语条目: ${englishMap.size}, 释义条目: ${meaningMap.size}`);
      
      const maxIndex = Math.max(...Array.from(englishMap.keys()));
      for (let i = 1; i <= maxIndex; i++) {
        const english = englishMap.get(i);
        const meaning = meaningMap.get(i);
        
        if (english && meaning) {
          if (/^\d+$/.test(english.trim())) {
            continue;
          }
          
          let part_of_speech = '';
          let chinese = meaning;
          
          const posMatch = meaning.match(/^([a-z]+\.?)\s*(.*)$/i);
          if (posMatch) {
            part_of_speech = posMatch[1].trim();
            chinese = posMatch[2].trim();
          }
          
          words.push({
            english: english.trim(),
            part_of_speech,
            chinese
          });
        }
      }
    }
  }
  
  console.log(`共解析出 ${words.length} 个单词`);
  
  return words;
}

// 解析一列数据（处理跨行）
function parseColumn(lines: string[]): Map<number, string> {
  const result = new Map<number, string>();
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)$/);
    
    if (numMatch) {
      if (currentIndex !== null && currentContent.length > 0) {
        result.set(currentIndex, currentContent.join(' '));
      }
      
      currentIndex = parseInt(numMatch[1]);
      currentContent = [];
    } else if (currentIndex !== null) {
      if (/^\d/.test(line)) {
        result.set(currentIndex, currentContent.join(' '));
        
        const newNumMatch = line.match(/^(\d+)\s*(.*)/);
        if (newNumMatch) {
          currentIndex = parseInt(newNumMatch[1]);
          const remaining = newNumMatch[2].trim();
          currentContent = remaining ? [remaining] : [];
        } else {
          currentIndex = null;
          currentContent = [];
        }
      } else {
        currentContent.push(line);
      }
    }
  }
  
  if (currentIndex !== null && currentContent.length > 0) {
    result.set(currentIndex, currentContent.join(' '));
  }
  
  return result;
}
