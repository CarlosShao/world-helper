import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  console.log('=== PDF前200行 ===');
  lines.slice(0, 200).forEach((line, i) => console.log(`${i}: ${line}`));
  
  // 【暴力方法】：找到所有数字序号，然后把序号后面的**所有内容**都收集起来，直到遇到下一个数字序号
  // 然后再手动把英语和释义分开
  const entries: Array<{ index: number; allContent: string[] }> = [];
  
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)$/);
    
    if (numMatch) {
      if (currentIndex !== null && currentContent.length > 0) {
        entries.push({ index: currentIndex, allContent: [...currentContent] });
      }
      
      currentIndex = parseInt(numMatch[1]);
      currentContent = [];
    } else if (currentIndex !== null) {
      if (line !== 'WordMeaning') {
        currentContent.push(line);
      }
    }
  }
  
  // 添加最后一个
  if (currentIndex !== null && currentContent.length > 0) {
    entries.push({ index: currentIndex, allContent: [...currentContent] });
  }
  
  console.log(`找到 ${entries.length} 个条目`);
  entries.slice(0, 10).forEach((entry, i) => {
    console.log(`条目${i+1} (序号${entry.index}): ${JSON.stringify(entry.allContent)}`);
  });
  
  // 现在处理：同一个序号出现两次，第一次是英语，第二次是释义
  // 先把相同序号的内容合并
  const indexMap = new Map<number, string[]>();
  
  for (const entry of entries) {
    if (!indexMap.has(entry.index)) {
      indexMap.set(entry.index, []);
    }
    indexMap.get(entry.index)!.push(...entry.allContent);
  }
  
  console.log(`合并后有 ${indexMap.size} 个唯一序号`);
  
  // 现在把每个序号的所有内容，手动拆分成英语和释义
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  indexMap.forEach((allContent, index) => {
    console.log(`序号${index}的全部内容: ${JSON.stringify(allContent)}`);
    
    // 找第一个看起来像词性标记的内容
    let posIndex = -1;
    for (let i = 0; i < allContent.length; i++) {
      if (/^[a-z]+\.?$/i.test(allContent[i])) {
        posIndex = i;
        break;
      }
    }
    
    if (posIndex === -1) {
      console.log(`没找到词性标记，跳过序号${index}`);
      return;
    }
    
    const english = allContent.slice(0, posIndex).join(' ').trim();
    const meaning = allContent.slice(posIndex).join(' ').trim();
    
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
  });
  
  console.log(`共解析出 ${words.length} 个单词`);
  
  return words;
}
