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
    let meaning = meaningParts.join(' ').trim();
    
    console.log(`序号${i}: 英语="${english}"，释义="${meaning}"`);
    
    // 过滤纯数字
    if (/^\d+$/.test(english)) {
      continue;
    }
    
    // 清理页脚脏数据（可能和释义在同一行）
    meaning = cleanFooterData(meaning);
    
    let part_of_speech = '';
    let chinese = meaning;
    
    const posMatch = meaning.match(/^([a-z]+\.)\s*(.*)$/i);
    if (posMatch) {
      part_of_speech = posMatch[1].trim();
      chinese = posMatch[2].trim();
    }
    
    // 再次清理中文释义中的脏数据
    chinese = cleanFooterData(chinese);
    
    words.push({
      english,
      part_of_speech,
      chinese
    });
  }
  
  console.log(`共合并出 ${words.length} 个单词`);
  return words;
}

function cleanFooterData(text: string): string {
  // 页脚脏数据模式
  const footerPatterns = [
    /全部已学.*复习完成.*共.*词.*\/.*页/g,
    /已学.*复习完成/g,
    /共\s*\d+\s*词/g,
    /\d+\/\d+\s*页/g,
    /背单词.*App/g,
    /扫码.*二维码/g,
    /单词不用背.*自然会/g
  ];
  
  let result = text;
  for (const pattern of footerPatterns) {
    result = result.replace(pattern, '').trim();
  }
  
  return result;
}

function parseNumberedSectionWithArray(lines: string[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  // 页脚脏数据关键词
  const footerKeywords = [
    '页', '词表', '二维码', '下载', '已学', '复习', '完成',
    '共', '背单词', 'App', '自然会', '扫码', '打卡'
  ];
  
  for (const line of lines) {
    // 跳过页脚脏数据行
    const isFooter = footerKeywords.some(keyword => line.includes(keyword));
    if (isFooter) {
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
