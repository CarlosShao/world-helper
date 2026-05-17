import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  
  // 方法2：假设双栏PDF，Word和Meaning交替出现
  // 找到所有 "WordMeaning" 标记来确定栏的边界
  const wordMeaningIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line === 'WordMeaning') {
      wordMeaningIndices.push(i);
    }
  });
  
  console.log(`Found ${wordMeaningIndices.length} WordMeaning markers`);
  
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  if (wordMeaningIndices.length >= 2) {
    console.log('Using dual-column mode...');
    
    // 第一栏（英语）从第一个WordMeaning后面开始
    const wordsStart = wordMeaningIndices[0] + 1;
    // 第二栏（释义）从第二个WordMeaning后面开始
    const meaningsStart = wordMeaningIndices[1] + 1;
    
    // 找到下一个WordMeaning或文档结尾作为边界
    const wordsEnd = wordMeaningIndices.length > 2 ? wordMeaningIndices[2] : lines.length;
    const meaningsEnd = wordMeaningIndices.length > 3 ? wordMeaningIndices[3] : lines.length;
    
    // 提取英语单词（处理跨行）
    const englishMap = parseColumn(lines.slice(wordsStart, wordsEnd));
    // 提取释义（处理跨行）
    const meaningMap = parseColumn(lines.slice(meaningsStart, meaningsEnd));
    
    console.log(`English entries: ${englishMap.size}, Meaning entries: ${meaningMap.size}`);
    
    // 合并结果
    const maxIndex = Math.max(...Array.from(englishMap.keys()));
    for (let i = 1; i <= maxIndex; i++) {
      const english = englishMap.get(i);
      const meaning = meaningMap.get(i);
      
      if (english && meaning) {
        // 过滤纯数字
        if (/^\d+$/.test(english.trim())) {
          console.log(`Skipping pure number: ${english}`);
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
  
  // 如果双栏模式没找到数据，尝试单栏模式
  if (words.length === 0) {
    console.log('Falling back to single-column mode...');
    
    const allNumberedIndices: Array<{ index: number; lineNum: number }> = [];
    lines.forEach((line, i) => {
      const numMatch = line.match(/^(\d+)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1]);
        allNumberedIndices.push({ index, lineNum: i });
      }
    });
    
    const indexMap = new Map<number, { english: string; meaning: string }>();
    
    for (let i = 0; i < allNumberedIndices.length; i++) {
      const { index, lineNum } = allNumberedIndices[i];
      const nextIndex = i < allNumberedIndices.length - 1 ? allNumberedIndices[i + 1].lineNum : lines.length;
      
      const content: string[] = [];
      for (let j = lineNum + 1; j < nextIndex && j < lines.length; j++) {
        const line = lines[j];
        if (line === 'WordMeaning') break;
        content.push(line);
      }
      
      if (content.length >= 2) {
        indexMap.set(index, {
          english: content[0],
          meaning: content.slice(1).join(' ')
        });
      }
    }
    
    for (let i = 1; i <= Math.max(...Array.from(indexMap.keys())); i++) {
      const item = indexMap.get(i);
      if (!item) continue;
      
      let english = item.english.trim();
      let meaning = item.meaning;
      
      if (/^\d+$/.test(english)) {
        console.log(`Skipping pure number: ${english}`);
        continue;
      }
      
      if (isLikelyIncomplete(english) && i + 1 <= Math.max(...Array.from(indexMap.keys()))) {
        const nextItem = indexMap.get(i + 1);
        if (nextItem) {
          const nextEnglish = nextItem.english.trim();
          
          if (/^\d+$/.test(nextEnglish)) {
            continue;
          }
          
          const mergedEnglish = english + ' ' + nextEnglish;
          const mergedMeaning = meaning + ' ' + nextItem.meaning;
          
          if (looksLikeValidWord(mergedEnglish)) {
            english = mergedEnglish;
            meaning = mergedMeaning;
            console.log(`Merged: ${english}`);
            i++;
          }
        }
      }
      
      if (/^\d+$/.test(english)) {
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
        english,
        part_of_speech,
        chinese
      });
    }
  }
  
  console.log(`Successfully parsed ${words.length} words`);
  
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
      // 遇到新的序号
      if (currentIndex !== null && currentContent.length > 0) {
        result.set(currentIndex, currentContent.join(' '));
      }
      
      currentIndex = parseInt(numMatch[1]);
      currentContent = [];
    } else if (currentIndex !== null) {
      // 在当前序号下添加内容
      // 如果内容看起来像是下一个序号的开始（以数字开头），则结束当前条目
      if (/^\d/.test(line)) {
        result.set(currentIndex, currentContent.join(' '));
        
        // 尝试解析新的序号
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
  
  // 添加最后一个条目
  if (currentIndex !== null && currentContent.length > 0) {
    result.set(currentIndex, currentContent.join(' '));
  }
  
  return result;
}

function isLikelyIncomplete(word: string): boolean {
  const trimmed = word.trim().toLowerCase();
  
  if (/^\d+$/.test(trimmed)) return false;
  
  const incompletePatterns = [
    'sth', 'sb',
    'into', 'onto', 'onto',
    'for', 'from', 'with', 'without',
    'about', 'above', 'across', 'after', 'against', 'along', 'among',
    'at', 'by',
    'in', 'on', 'out', 'over', 'under',
    'to', 'too',
    'and', 'or', 'but',
    'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'that', 'this', 'these', 'those',
    'it', 'its',
    'can', 'could', 'may', 'might', 'must', 'will', 'would', 'should',
    'do', 'does', 'did', 'have', 'has', 'had',
    'get', 'got', 'make', 'made', 'take', 'took', 'give', 'gave',
    'as', 'if', 'than', 'then', 'so', 'such'
  ];
  
  return incompletePatterns.includes(trimmed);
}

function looksLikeValidWord(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  
  if (trimmed.includes(' ')) {
    return true;
  }
  
  if (trimmed.length >= 3) {
    if (/^\d+$/.test(trimmed)) return false;
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 4) return false;
    return true;
  }
  
  return false;
}
