export interface FreemiumResult {
  visibleContent: string;
  isTruncated: boolean;
  totalWords: number;
  visibleWords: number;
  percentageShown: number;
}

export function getFreemiumPreview(content: string, hasCredits: boolean): FreemiumResult {
  if (hasCredits) {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    return {
      visibleContent: content,
      isTruncated: false,
      totalWords: words.length,
      visibleWords: words.length,
      percentageShown: 100
    };
  }

  const words = content.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  
  let percentageToShow: number;
  let maxWords: number | null = null;
  
  if (totalWords <= 500) {
    percentageToShow = 100;
  } else if (totalWords <= 1000) {
    percentageToShow = 75;
  } else if (totalWords <= 2000) {
    percentageToShow = 60;
  } else if (totalWords <= 5000) {
    percentageToShow = 40;
  } else if (totalWords <= 10000) {
    percentageToShow = 25;
  } else if (totalWords <= 20000) {
    percentageToShow = 10;
  } else {
    percentageToShow = 0;
    maxWords = 1000;
  }
  
  let wordsToShow: number;
  if (maxWords !== null) {
    wordsToShow = maxWords;
  } else {
    wordsToShow = Math.floor(totalWords * (percentageToShow / 100));
  }
  
  const isTruncated = wordsToShow < totalWords;
  const visibleWords = words.slice(0, wordsToShow);
  const visibleContent = visibleWords.join(' ');
  
  const actualPercentage = totalWords > 0 ? Math.round((wordsToShow / totalWords) * 100) : 100;
  
  return {
    visibleContent: isTruncated ? visibleContent + '...' : visibleContent,
    isTruncated,
    totalWords,
    visibleWords: wordsToShow,
    percentageShown: actualPercentage
  };
}
