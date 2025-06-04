export function preprocessTextForTTS(text) {
  return text
    .replace(/\bso\b/gi, 'soh')
    .replace(/\bdr\./gi, 'doctor')
    .replace(/\bmr\./gi, 'mister')
    .replace(/\bmrs\./gi, 'missus')
    .replace(/\bms\./gi, 'miss')
    .replace(/"/g, '')
    .replace(/'/g, "'")
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.{3,}/g, ' pause ')
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
    .replace(/\.{2,}/g, '.')
    .replace(/\bantique\b/gi, 'an TEEK')
    .replace(/\bsold\b/gi, 'sohld')
    .replace(/[.,]/g, '')
    .trim();
}

export function splitTextIntoChunks(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    const test = currentChunk ? currentChunk + ' ' + sentence : sentence;
    
    if (test.length <= maxLength) {
      currentChunk = test;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If single sentence is too long, split by words
      if (sentence.length > maxLength) {
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const word of words) {
          const testWord = wordChunk ? wordChunk + ' ' + word : word;
          if (testWord.length <= maxLength) {
            wordChunk = testWord;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.length ? chunks : [text];
}