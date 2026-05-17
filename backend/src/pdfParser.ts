import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  
  // 打印前100行
  console.log('=== PDF前100行 ===');
  lines.slice(0, 100).forEach((line, i) => console.log(`${i}: ${line}`));
  
  // 先收集所有内容，不处理双栏，直接把整个文档按顺序处理
  // 找到所有数字序号
  const numberedEntries: Array<{ index: number; lines: string[] }> = [];
  
  let currentIndex: number | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      // 新的序号
      if (currentIndex !== null && currentContent.length > 0) {
        numberedEntries.push({ index: currentIndex, lines: [...currentContent] });
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
    numberedEntries.push({ index: currentIndex, lines: [...currentContent] });
  }
  
  console.log(`找到 ${numberedEntries.length} 个带序号的条目`);
  
  // 现在假设：相同序号的条目，奇数位是英语，偶数位是释义（因为双栏）
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  const indexMap = new Map<number, Array<string[]>>();
  
  for (const entry of numberedEntries) {
    if (!indexMap.has(entry.index)) {
      indexMap.set(entry.index, []);
    }
    indexMap.get(entry.index)!.push(entry.lines);
  }
  
  console.log(`序号分布：`);
  indexMap.forEach((contentGroups, index) => {
    console.log(`  ${index}: ${contentGroups.length}次`);
  });
  
  // 对于有偶数个内容组的序号（双栏），两两配对
  indexMap.forEach((contentGroups, index) => {
    if (contentGroups.length >= 2) {
      // 第一组：英语（可能多行）
      let english = contentGroups[0].join(' ').trim();
      // 第二组：释义（可能多行）
      let meaning = contentGroups[1].join(' ').trim();
      
      // 特殊处理：如果有更多组，说明有跨行，尝试合并
      if (contentGroups.length > 2) {
        // 智能判断：看看有没有像 "translate sth" 这样被分成多个条目的
        console.log(`序号${index}有${contentGroups.length}组内容，尝试智能合并...`);
        
        // 把所有组都收集起来
        const allParts = contentGroups.flat();
        
        // 尝试找出哪些是英语，哪些是释义
        // 简单策略：第一部分是英语，剩下的合并到释义？
        // 或者：找有词性标记的作为释义
        let foundMeaning = false;
        let englishParts: string[] = [];
        let meaningParts: string[] = [];
        
        for (const part of allParts) {
          if (/^[a-z]+\./i.test(part) && !foundMeaning) {
            foundMeaning = true;
            meaningParts.push(part);
          } else if (foundMeaning) {
            meaningParts.push(part);
          } else {
            englishParts.push(part);
          }
        }
        
        if (englishParts.length > 0 && meaningParts.length > 0) {
          english = englishParts.join(' ').trim();
          meaning = meaningParts.join(' ').trim();
          console.log(`  智能合并成功: 英语="${english}", 释义="${meaning}"`);
        }
      }
      
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
  
  console.log(`共解析出 ${words.length} 个单词`);
  
  return words;
}
