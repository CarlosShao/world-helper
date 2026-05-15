import pdf from 'pdf-parse';
import fs from 'fs';

interface WordItem {
  english: string;
  part_of_speech: string;
  chinese: string;
}

export async function parsePdf(filePath: string): Promise<WordItem[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  const text = data.text;
  
  const words: WordItem[] = [];
  
  // 按行分割文本
  const lines = text.split('\n').filter(line => line.trim());
  
  // 尝试解析常见的单词表格式
  // 格式示例：dominating; adj.; 统治的，支配的；个性强势的
  // 或者：dominating adj. 统治的，支配的
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // 尝试用分号分割
    let parts = line.split(/[;；]/).map(p => p.trim()).filter(p => p);
    if (parts.length >= 3) {
      words.push({
        english: parts[0],
        part_of_speech: parts[1],
        chinese: parts.slice(2).join('；')
      });
      continue;
    }
    
    // 尝试用空格分割，寻找词性标识
    const posPattern = /\b(adj|adv|n|v|prep|conj|pron|num|interj)\.?\b/i;
    const match = line.match(posPattern);
    if (match) {
      const posIndex = match.index!;
      const english = line.slice(0, posIndex).trim();
      const partOfSpeech = match[0];
      const chinese = line.slice(posIndex + match[0].length).trim();
      
      if (english && chinese) {
        words.push({
          english,
          part_of_speech: partOfSpeech,
          chinese
        });
      }
    }
  }
  
  return words;
}
