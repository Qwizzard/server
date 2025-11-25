export interface QuizQuestion {
  questionText: string;
  questionType: 'mcq' | 'true-false' | 'multiple-correct';
  options: string[];
  correctAnswers: number[];
  explanation: string;
}

export interface GenerateQuizParams {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: string[];
  numberOfQuestions: number;
}

export interface WrongAnswer {
  questionText: string;
  questionType: string;
  selectedAnswers: number[];
  correctAnswers: number[];
  explanation: string;
  options: string[];
}

export interface GenerateAdaptiveQuizParams {
  originalTopic: string;
  originalDifficulty: 'easy' | 'medium' | 'hard';
  questionTypes: string[];
  numberOfQuestions: number;
  wrongAnswers: WrongAnswer[];
  focusOnWeakAreas: boolean;
  useHarderDifficulty: boolean;
}

