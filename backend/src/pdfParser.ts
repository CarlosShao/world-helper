import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  
  const allNumberedIndices: Array<{ index: number; lineNum: number }> = [];
  lines.forEach((line, i) => {
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]);
      allNumberedIndices.push({ index, lineNum: i });
    }
  });
  
  console.log(`Found ${allNumberedIndices.length} numbered indices`);
  
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
  
  console.log(`Found ${indexMap.size} unique indices`);
  
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  for (let i = 1; i <= Math.max(...Array.from(indexMap.keys())); i++) {
    const item = indexMap.get(i);
    if (!item) continue;
    
    let english = item.english.trim();
    let meaning = item.meaning;
    
    // 关键修复：永远不把纯数字当作单词
    if (/^\d+$/.test(english)) {
      console.log(`Skipping pure number: ${english}`);
      continue;
    }
    
    // 如果英语部分太短或像是不完整的，检查是否应该与下一个合并
    if (isLikelyIncomplete(english) && i + 1 <= Math.max(...Array.from(indexMap.keys()))) {
      const nextItem = indexMap.get(i + 1);
      if (nextItem) {
        const nextEnglish = nextItem.english.trim();
        
        // 如果下一个也是纯数字，跳过
        if (/^\d+$/.test(nextEnglish)) {
          continue;
        }
        
        // 合并两个部分（跨行短语）
        const mergedEnglish = english + ' ' + nextEnglish;
        const mergedMeaning = meaning + ' ' + nextItem.meaning;
        
        // 验证合并后的结果看起来像个真正的单词/短语
        if (looksLikeValidWord(mergedEnglish)) {
          english = mergedEnglish;
          meaning = mergedMeaning;
          console.log(`Merged: ${english}`);
          // 跳过下一个，因为已经合并了
          i++;
        }
      }
    }
    
    // 再次检查，确保不是纯数字
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
  
  console.log(`Successfully parsed ${words.length} words`);
  
  return words;
}

// 判断单词是否看起来不完整（可能需要与下一个合并）
function isLikelyIncomplete(word: string): boolean {
  const trimmed = word.trim().toLowerCase();
  
  // 纯数字永远不算不完整
  if (/^\d+$/.test(trimmed)) return false;
  
  // 常见的短语组成部分 - 这些单独出现很可能是跨行的一部分
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

// 判断是否像是一个有效的单词或短语
function looksLikeValidWord(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  
  // 如果包含多个单词，很可能是短语
  if (trimmed.includes(' ')) {
    return true;
  }
  
  // 如果是单个单词，长度应该合理（至少3个字符）
  if (trimmed.length >= 3) {
    // 不应该是纯数字
    if (/^\d+$/.test(trimmed)) return false;
    
    // 不应该全是大写或小写（可能是缩写或特殊标记）
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 4) return false;
    
    return true;
  }
  
  return false;
}
