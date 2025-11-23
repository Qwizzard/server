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

