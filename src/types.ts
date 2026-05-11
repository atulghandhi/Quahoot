import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  lastScoreAdded: number;
  hasAnswered: boolean;
  lastAnswerCorrect: boolean;
}

export interface GameState {
  code: string;
  status: 'lobby' | 'countdown' | 'question_active' | 'leaderboard' | 'podium' | 'ended';
  hostId: string;
  players: Record<string, Player>;
  questions: Question[];
  currentQuestionIndex: number;
  questionStartTime: number | null;
}
