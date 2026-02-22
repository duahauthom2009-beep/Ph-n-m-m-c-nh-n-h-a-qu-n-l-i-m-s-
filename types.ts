
export type SubjectType = 'graded' | 'pass-fail';

export interface ScoreEntry {
  tx1: number | null;
  tx2: number | null;
  tx3: number | null;
  tx4: number | null;
  tx5: number | null;
  gk: number | null;
  ck: number | null;
}

export interface SubjectData {
  id: string;
  name: string;
  type: SubjectType;
  hk1: ScoreEntry;
  hk2: ScoreEntry;
  avg1: number | null;
  avg2: number | null;
  overallAvg: number | null;
  status1: 'Pass' | 'Fail' | null;
  status2: 'Pass' | 'Fail' | null;
  comment: string;
}

export interface UserProfile {
  name: string;
  className: string;
}

export interface ExerciseSuggestion {
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  count: number;
  description: string;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  topic: string;
  questions: Question[];
}

export interface ScheduleEntry {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface WeeklySchedule {
  [dateKey: string]: ScheduleEntry; // format: YYYY-MM-DD
}
