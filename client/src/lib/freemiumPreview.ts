export interface FreemiumResult {
  visibleContent: string;
  isTruncated: boolean;
  totalWords: number;
  visibleWords: number;
  percentageShown: number;
}

export const FREEMIUM_WORD_LIMIT = 500;

export function getFreemiumPreview(content: string, hasCredits: boolean): FreemiumResult {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  // Users with credits see everything
  if (hasCredits) {
    return {
      visibleContent: content,
      isTruncated: false,
      totalWords,
      visibleWords: totalWords,
      percentageShown: 100
    };
  }

  // Users without credits: show first 500 words only
  if (totalWords <= FREEMIUM_WORD_LIMIT) {
    return {
      visibleContent: content,
      isTruncated: false,
      totalWords,
      visibleWords: totalWords,
      percentageShown: 100
    };
  }
  
  const visibleWords = words.slice(0, FREEMIUM_WORD_LIMIT);
  const visibleContent = visibleWords.join(' ');
  const percentageShown = Math.round((FREEMIUM_WORD_LIMIT / totalWords) * 100);
  
  return {
    visibleContent: visibleContent + '...',
    isTruncated: true,
    totalWords,
    visibleWords: FREEMIUM_WORD_LIMIT,
    percentageShown
  };
}
