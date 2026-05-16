import pdf from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<Array<{ english: string; part_of_speech: string; chinese: string }>> {
  const dataBuffer = require('fs').readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);
  
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = [];
  
  // 找到两个 "WordMeaning" 标记的位置，来区分单词区域和释义区域
  const wordMeaningIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line === 'WordMeaning') {
      wordMeaningIndices.push(i);
    }
  });
  
  if (wordMeaningIndices.length >= 2) {
    // 第一个 WordMeaning 后面是单词
    const startWords = wordMeaningIndices[0] + 1;
    // 第二个 WordMeaning 后面是释义
    const startMeanings = wordMeaningIndices[1] + 1;
    
    // 找到释义区域结束的位置（第一个非数字、非释义的行）
    let endWords = startWords;
    while (endWords < lines.length && lines[endWords] !== 'WordMeaning') {
      endWords++;
    }
    
    let endMeanings = startMeanings;
    while (endMeanings < lines.length && 
           !lines[endMeanings].includes('共') && 
           !lines[endMeanings].includes('近日') &&
           !lines[endMeanings].includes('扫码')) {
      endMeanings++;
    }
    
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
    
    // 配对单词和释义
    const maxIndex = Math.max(...Array.from(englishMap.keys()).concat(Array.from(meaningMap.keys())));
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
      }
    }
  }
  
  return words;
}
