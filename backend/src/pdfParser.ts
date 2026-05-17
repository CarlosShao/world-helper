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
    console.log('WordMeaning标记太少，无法解析');
    return [];
  }
  
  // 提取第一部分：英语词汇 (第一个WordMeaning之后，第二个WordMeaning之前)
  const englishStart = wordMeaningPositions[0] + 1;
  const englishEnd = wordMeaningPositions[1];
  const englishLines = lines.slice(englishStart, englishEnd);
  
  console.log(`英语部分: ${englishStart}-${englishEnd} (${englishLines.length} 行)`);
  
  // 提取第二部分：释义 (第二个WordMeaning之后，第三个WordMeaning之前)
  const meaningStart = wordMeaningPositions[1] + 1;
  const meaningEnd = wordMeaningPositions.length > 2 ? wordMeaningPositions[2] : lines.length;
  const meaningLines = lines.slice(meaningStart, meaningEnd);
  
  console.log(`释义部分: ${meaningStart}-${meaningEnd} (${meaningLines.length} 行)`);
  
  // 解析英语部分
  const englishMap = parseNumberedSection(englishLines);
  console.log(`解析出 ${englishMap.size} 个英语词汇`);
  
  // 解析释义部分
  const meaningMap = parseNumberedSection(meaningLines);
  console.log(`解析出 ${meaningMap.size} 个释义`);
  
  // 合并结果
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  const maxIndex = Math.max(...Array.from(englishMap.keys()));
  
  for (let i = 1; i <= maxIndex; i++) {
    const english = englishMap.get(i);
    const meaning = meaningMap.get(i);
    
    if (!english || !meaning) {
      continue;
    }
    
    console.log(`序号${i}: 英语="${english}"，释义="${meaning}"`);
    
    // 解析词性
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

function parseNumberedSection(lines: string[]): Map<number, string> {
  const result = new Map<number, string>();
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)$/);
    
    if (numMatch) {
      // 遇到新的序号
      if (currentIndex !== null && currentContent.length > 0) {
        // 保存上一个序号的内容
        result.set(currentIndex, currentContent.join(' '));
      }
      
      currentIndex = parseInt(numMatch[1]);
      currentContent = [];
    } else if (currentIndex !== null) {
      // 收集当前序号的内容
      currentContent.push(line);
    }
  }
  
  // 保存最后一个
  if (currentIndex !== null && currentContent.length > 0) {
    result.set(currentIndex, currentContent.join(' '));
  }
  
  return result;
}
