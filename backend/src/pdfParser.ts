import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  console.log(`Total lines: ${lines.length}`);
  
  // 找到所有 "WordMeaning" 标记的位置
  const wordMeaningIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line === 'WordMeaning') {
      wordMeaningIndices.push(i);
    }
  });
  
  console.log(`Found ${wordMeaningIndices.length} WordMeaning markers`);
  
  // 策略1：如果有很多 WordMeaning 标记，可能是按页分组的
  // 先尝试一个更直接的方式：遍历所有行，找到所有数字序号
  // 然后根据位置，区分哪些是单词区域，哪些是释义区域
  
  const allNumberedLines: Array<{ index: number; content: string; lineNum: number }> = [];
  
  lines.forEach((line, i) => {
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]);
      if (i + 1 < lines.length) {
        allNumberedLines.push({
          index,
          content: lines[i + 1],
          lineNum: i
        });
      }
    }
  });
  
  console.log(`Found ${allNumberedLines.length} numbered items`);
  
  // 现在找出所有相同数字的配对
  // 相同数字的第一个应该是单词，第二个应该是释义
  const indexMap = new Map<number, Array<{ content: string; lineNum: number }>>();
  
  allNumberedLines.forEach(item => {
    if (!indexMap.has(item.index)) {
      indexMap.set(item.index, []);
    }
    indexMap.get(item.index)!.push({
      content: item.content,
      lineNum: item.lineNum
    });
  });
  
  console.log(`Found ${indexMap.size} unique indices`);
  
  // 现在配对单词和释义
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  const maxIndex = Math.max(...Array.from(indexMap.keys()));
  
  for (let i = 1; i <= maxIndex; i++) {
    const items = indexMap.get(i);
    if (items && items.length >= 2) {
      // 第一个是单词，第二个是释义
      const english = items[0].content;
      const meaning = items[1].content;
      
      let part_of_speech = '';
      let chinese = meaning;
      
      // 匹配释义中的词性标记
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
  
  // 如果这种方式没找到，尝试老方式
  if (words.length === 0 && wordMeaningIndices.length >= 2) {
    console.log('Falling back to old method...');
    // 老方法逻辑（保留）
    const startWords = wordMeaningIndices[0] + 1;
    const startMeanings = wordMeaningIndices[1] + 1;
    
    let endWords = startWords;
    while (endWords < lines.length && lines[endWords] !== 'WordMeaning') {
      endWords++;
    }
    
    let endMeanings = startMeanings;
    while (endMeanings < lines.length) {
      const line = lines[endMeanings];
      if (!line.match(/^(\d+)$/) && !line.match(/^[a-z]+\./i) && 
          (line.includes('共') || line.includes('近日') || 
           line.includes('扫码') || line.includes('WordMeaning'))) {
        break;
      }
      endMeanings++;
    }
    
    const englishMap = new Map<number, string>();
    for (let i = startWords; i < endWords - 1; i++) {
      const line = lines[i];
      const numMatch = line.match(/^(\d+)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1]);
        if (i + 1 < endWords) {
          englishMap.set(index, lines[i + 1]);
        }
      }
    }
    
    const meaningMap = new Map<number, string>();
    for (let i = startMeanings; i < endMeanings - 1; i++) {
      const line = lines[i];
      const numMatch = line.match(/^(\d+)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1]);
        if (i + 1 < endMeanings) {
          meaningMap.set(index, lines[i + 1]);
        }
      }
    }
    
    const fallbackMaxIndex = Math.max(...Array.from(englishMap.keys()).concat(Array.from(meaningMap.keys())));
    for (let i = 1; i <= fallbackMaxIndex; i++) {
      const english = englishMap.get(i);
      const meaning = meaningMap.get(i);
      
      if (english && meaning) {
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
  }
  
  return words;
}
