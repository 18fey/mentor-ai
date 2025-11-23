// types/weekly-report.ts
export interface WeeklyReport {
  profile: {
    name?: string;
    university?: string;
    faculty?: string;
    grade?: string;
    interestedIndustries: string[];
    valuesTags: string[];
    oneLinePr: string; // 一言PR
  };
  axesDraft: {
    label: string;
    description: string;
    relatedStories: string[]; // story_cards.id
  }[];
  storyCards: {
    id: string;
    title: string;
    type: string;
    star: {
      situation: string;
      task: string;
      action: string;
      result: string;
    };
    learnings: string;
    axesLink: string[];
  }[];
  aiSummary: {
    commonKeywords: string[];
    strengthsHypothesis: string[];
    missingAreas: string[];
    nextWeekSuggestion: string;
  };
  period: {
    weekStart: string;
    weekEnd: string;
  };
}

