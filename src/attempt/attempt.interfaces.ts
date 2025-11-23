export interface AttemptStatusResponse {
  status: 'not-started' | 'in-progress' | 'completed';
  attemptId?: string;
  lastQuestionIndex?: number;
}

export interface AttemptAnswer {
  questionIndex: number;
  selectedAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
}

export interface CalculateScoreResult {
  score: number;
  answers: AttemptAnswer[];
}

