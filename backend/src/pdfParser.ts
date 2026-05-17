import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`总 ${lines.length} 行`);
  
  // 找到所有WordMeaning的位置
  const wordMeaningPositions: number[] = [];
  lines.forEach((line, i) => {
    if (line === 'WordMeaning') {
      wordMeaningPositions.push(i);
    }
  });
  
  console.log(`找到 ${wordMeaningPositions.length} 个WordMeaning标记`);
  
  if (wordMeaningPositions.length < 2) {
    console.log('WordMeaning标记太少');
    return [];
  }
  
  // 收集所有英语词汇和释义
  const englishMap = new Map<number, string[]>();
  const meaningMap = new Map<number, string[]>();
  
  // 模式：WordMeaning -> 英语 -> WordMeaning -> 释义 -> 页面信息 -> WordMeaning -> ...
  // 所以索引为偶数的WordMeaning后面是英语，奇数的后面是释义
  for (let i = 0; i < wordMeaningPositions.length - 1; i++) {
    const start = wordMeaningPositions[i] + 1;
    const end = wordMeaningPositions[i + 1];
    const sectionLines = lines.slice(start, end);
    
    // 判断是英语部分还是释义部分
    const isEnglish = i % 2 === 0;
    
    // 解析这部分的内容
    const sectionMap = parseNumberedSectionWithArray(sectionLines);
    
    // 合并到全局Map
    sectionMap.forEach((content, index) => {
      if (isEnglish) {
        if (!englishMap.has(index)) {
          englishMap.set(index, []);
        }
        englishMap.get(index)!.push(...content);
      } else {
        if (!meaningMap.has(index)) {
          meaningMap.set(index, []);
        }
        meaningMap.get(index)!.push(...content);
      }
    });
  }
  
  console.log(`解析出 ${englishMap.size} 个英语词汇，${meaningMap.size} 个释义`);
  
  // 合并结果
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  const maxIndex = Math.max(...Array.from(englishMap.keys()));
  
  for (let i = 1; i <= maxIndex; i++) {
    const englishParts = englishMap.get(i);
    const meaningParts = meaningMap.get(i);
    
    if (!englishParts || !meaningParts) {
      continue;
    }
    
    const english = englishParts.join(' ').trim();
    const meaning = meaningParts.join(' ').trim();
    
    console.log(`序号${i}: 英语="${english}"，释义="${meaning}"`);
    
    // 过滤纯数字
    if (/^\d+$/.test(english)) {
      continue;
    }
    
    let part_of_speech = '';
    let chinese = meaning;
    
    const posMatch = meaning.match(/^([a-z]+\.)\s*(.*)$/i);
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
  
  console.log(`共合并出 ${words.length} 个单词`);
  return words;
}

function parseNumberedSectionWithArray(lines: string[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // 跳过页面信息行（包含"页"、"词表"等）
    if (line.includes('页') || line.includes('词表') || line.includes('二维码') || line.includes('下载')) {
      continue;
    }
    
    const numMatch = line.match(/^(\d+)$/);
    
    if (numMatch) {
      if (currentIndex !== null && currentContent.length > 0) {
        result.set(currentIndex, [...currentContent]);
      }
      
      currentIndex = parseInt(numMatch[1]);
      currentContent = [];
    } else if (currentIndex !== null) {
      currentContent.push(line);
    }
  }
  
  if (currentIndex !== null && currentContent.length > 0) {
    result.set(currentIndex, [...currentContent]);
  }
  
  return result;
}
