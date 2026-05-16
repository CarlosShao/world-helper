import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  // 找到所有 "WordMeaning" 标记的位置
  const wordMeaningIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line === 'WordMeaning') {
      wordMeaningIndices.push(i);
    }
  });
  
  console.log(`Found ${wordMeaningIndices.length} WordMeaning markers`);
  
  if (wordMeaningIndices.length >= 2) {
    // 第一个 WordMeaning 后面是单词
    const startWords = wordMeaningIndices[0] + 1;
    // 第二个 WordMeaning 后面是释义
    const startMeanings = wordMeaningIndices[1] + 1;
    
    // 找到单词区域结束位置（下一个 WordMeaning）
    let endWords = startWords;
    while (endWords < lines.length && lines[endWords] !== 'WordMeaning') {
      endWords++;
    }
    
    // 找到释义区域结束位置（遇到非数字、非释义的行）
    let endMeanings = startMeanings;
    while (endMeanings < lines.length) {
      const line = lines[endMeanings];
      // 如果遇到非数字开头且不是词性的行，并且不是单词行，就停止
      if (!line.match(/^(\d+)$/) && !line.match(/^[a-z]+\./i) && 
          (line.includes('共') || line.includes('近日') || 
           line.includes('扫码') || line.includes('WordMeaning'))) {
        break;
      }
      endMeanings++;
    }
    
    console.log(`Words range: ${startWords} - ${endWords}`);
    console.log(`Meanings range: ${startMeanings} - ${endMeanings}`);
    
    // 提取单词：数字行 + 下一行是单词
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
    
    // 提取释义：数字行 + 下一行是释义
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
    
    console.log(`Parsed ${englishMap.size} English words and ${meaningMap.size} meanings`);
    
    // 配对单词和释义
    const maxIndex = Math.max(...Array.from(englishMap.keys()).concat(Array.from(meaningMap.keys())));
    let pairedCount = 0;
    for (let i = 1; i <= maxIndex; i++) {
      const english = englishMap.get(i);
      const meaning = meaningMap.get(i);
      
      if (english && meaning) {
        let part_of_speech = '';
        let chinese = meaning;
        
        // 匹配释义中的词性标记：adj., n., v., adv., collocation., 等
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
        pairedCount++;
      }
    }
    console.log(`Successfully paired ${pairedCount} words`);
  }
  
  return words;
}
