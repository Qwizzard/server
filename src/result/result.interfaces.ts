export interface PopulatedQuestion {
  questionText: string;
  questionType: string;
  options: string[];
  explanation: string;
}

export interface PopulatedQuiz {
  _id: unknown;
  slug: string;
  topic: string;
  difficulty: string;
  questions: PopulatedQuestion[];
}

export interface DetailedAnswer {
  questionIndex: number;
  questionText: string;
  questionType: string;
  options: string[];
  selectedAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
  explanation: string;
}

export interface ResultResponse {
  _id: unknown;
  slug: string;
  userId: unknown;
  quizId: unknown;
  quizSlug: string;
  quizTopic: string;
  quizDifficulty: string;
  attemptId: unknown;
  score: unknown;
  totalQuestions: unknown;
  percentage: unknown;
  completedAt: unknown;
  isResultPublic: boolean;
  answers: DetailedAnswer[];
}

