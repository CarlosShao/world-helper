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
  
  // 策略：找到所有数字序号，然后收集直到下一个数字或WordMeaning标记之前的所有内容
  const allNumberedIndices: Array<{ index: number; lineNum: number }> = [];
  lines.forEach((line, i) => {
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]);
      allNumberedIndices.push({ index, lineNum: i });
    }
  });
  
  console.log(`Found ${allNumberedIndices.length} numbered indices`);
  
  // 分组处理：相同索引的内容收集在一起
  const indexMap = new Map<number, { english: string; meaning: string }>();
  
  for (let i = 0; i < allNumberedIndices.length; i++) {
    const { index, lineNum } = allNumberedIndices[i];
    const nextIndex = i < allNumberedIndices.length - 1 ? allNumberedIndices[i + 1].lineNum : lines.length;
    
    // 收集从 lineNum+1 到 nextIndex 之间的所有内容
    const content: string[] = [];
    for (let j = lineNum + 1; j < nextIndex && j < lines.length; j++) {
      const line = lines[j];
      if (line === 'WordMeaning') break;
      content.push(line);
    }
    
    if (content.length >= 2) {
      // 第一个是单词，第二个是释义，后面的都是补充
      indexMap.set(index, {
        english: content[0],
        meaning: content.slice(1).join(' ')
      });
    }
  }
  
  console.log(`Found ${indexMap.size} unique indices`);
  
  // 处理跨行的短语：检测并合并连续的不完整单词
  const mergedWords = mergeIncompleteWords(indexMap);
  
  console.log(`After merging: ${mergedWords.length} words`);
  
  // 转换为最终格式
  const words: Array<{ english: string; part_of_speech: string; chinese: string }> = mergedWords
    .map(item => {
      const english = item.english;
      const meaning = item.meaning;
      
      // 过滤纯数字的单词（序号不应该被当成单词）
      if (/^\d+$/.test(english.trim()) || english.trim().length <= 1) {
        return null;
      }
      
      let part_of_speech = '';
      let chinese = meaning;
      
      // 匹配释义中的词性标记
      const posMatch = meaning.match(/^([a-z]+\.?)\s*(.*)$/i);
      if (posMatch) {
        part_of_speech = posMatch[1].trim();
        chinese = posMatch[2].trim();
      }
      
      return {
        english,
        part_of_speech,
        chinese
      };
    })
    .filter((item): item is { english: string; part_of_speech: string; chinese: string } => item !== null);
  
  console.log(`Successfully parsed ${words.length} words`);
  
  // 如果这种方式没找到，尝试老方式
  if (words.length === 0 && wordMeaningIndices.length >= 2) {
    console.log('Falling back to old method...');
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

// 合并跨行的不完整单词
function mergeIncompleteWords(indexMap: Map<number, { english: string; meaning: string }>): Array<{ english: string; meaning: string }> {
  const result: Array<{ english: string; meaning: string }> = [];
  const maxIndex = Math.max(...Array.from(indexMap.keys()));
  
  let i = 1;
  while (i <= maxIndex) {
    const item = indexMap.get(i);
    if (!item) {
      i++;
      continue;
    }
    
    let english = item.english;
    let meaning = item.meaning;
    
    // 检查当前单词是否可能不完整，如果是，继续检查后面的索引
    // 连续合并所有不完整的部分
    let j = i + 1;
    while (j <= maxIndex) {
      const nextItem = indexMap.get(j);
      if (!nextItem) {
        j++;
        continue;
      }
      
      // 如果当前单词不完整或者下一个单词不完整，合并它们
      if (isIncompleteWord(english) || isIncompleteWord(nextItem.english)) {
        english += ' ' + nextItem.english;
        meaning += ' ' + nextItem.meaning;
        j++;
      } else {
        // 检查下一个单词是否看起来像是当前单词的延续（相同前缀）
        if (hasSamePrefix(english, nextItem.english)) {
          english += ' ' + nextItem.english;
          meaning += ' ' + nextItem.meaning;
          j++;
        } else {
          break;
        }
      }
    }
    
    result.push({ english, meaning });
    i = j;
  }
  
  return result;
}

// 判断单词是否可能不完整（被跨行截断）
function isIncompleteWord(word: string): boolean {
  if (!word) return false;
  const trimmed = word.trim().toLowerCase();
  
  // 常见的不完整模式 - 这些单词单独出现通常是跨行的一部分
  const incompletePatterns = [
    /^into$/,
    /^sth$/,
    /^sb$/,
    /^to$/,
    /^for$/,
    /^in$/,
    /^on$/,
    /^at$/,
    /^of$/,
    /^with$/,
    /^by$/,
    /^from$/,
    /^and$/,
    /^or$/,
    /^but$/,
    /^the$/,
    /^a$/,
    /^an$/,
    /^be$/,
    /^is$/,
    /^are$/,
    /^was$/,
    /^were$/,
    /^been$/,
    /^being$/,
    /^than$/,
    /^that$/,
    /^this$/,
    /^these$/,
    /^those$/,
    /^it$/,
    /^its$/,
    /^he$/,
    /^she$/,
    /^they$/,
    /^we$/,
    /^you$/,
    /^me$/,
    /^him$/,
    /^her$/,
    /^us$/,
    /^them$/,
    /^which$/,
    /^what$/,
    /^who$/,
    /^whom$/,
    /^whose$/,
    /^when$/,
    /^where$/,
    /^why$/,
    /^how$/,
    /^can$/,
    /^could$/,
    /^may$/,
    /^might$/,
    /^must$/,
    /^shall$/,
    /^should$/,
    /^will$/,
    /^would$/,
    /^do$/,
    /^does$/,
    /^did$/,
    /^have$/,
    /^has$/,
    /^had$/,
    /^been$/,
    /^having$/,
    /^go$/,
    /^goes$/,
    /^went$/,
    /^going$/,
    /^get$/,
    /^gets$/,
    /^got$/,
    /^getting$/,
    /^make$/,
    /^makes$/,
    /^made$/,
    /^making$/,
    /^take$/,
    /^takes$/,
    /^took$/,
    /^taking$/,
    /^give$/,
    /^gives$/,
    /^gave$/,
    /^giving$/,
    /^use$/,
    /^uses$/,
    /^used$/,
    /^using$/
  ];
  
  // 如果单词是常见的介词、冠词、动词等，可能是不完整的
  return incompletePatterns.some(pattern => pattern.test(trimmed));
}

// 检查两个单词是否有相同的前缀（可能是跨行截断）
function hasSamePrefix(word1: string, word2: string): boolean {
  if (!word1 || !word2) return false;
  
  const w1 = word1.trim().toLowerCase();
  const w2 = word2.trim().toLowerCase();
  
  // 如果第二个单词很短（2-3个字符），可能是第一个单词的延续
  if (w2.length <= 3 && w1.length > 3) {
    // 检查是否看起来像是短语的一部分
    const commonPhrases = [
      'translate', 'transform', 'transport', 'transfer', 'transmit',
      'prepare', 'prevent', 'predict', 'produce', 'progress',
      'convert', 'conserve', 'consider', 'construct', 'contain',
      'include', 'increase', 'insist', 'install', 'instruct',
      'describe', 'determine', 'develop', 'discover', 'discuss',
      'improve', 'indicate', 'inform', 'involve', 'introduce',
      'reduce', 'reflect', 'refuse', 'regard', 'remain',
      'suggest', 'support', 'supply', 'suppose', 'survive'
    ];
    
    return commonPhrases.some(prefix => w1.startsWith(prefix) || w2.startsWith(prefix));
  }
  
  return false;
}
