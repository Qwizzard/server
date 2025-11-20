import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuizResult } from '../schemas/quiz-result.schema';

@Injectable()
export class ResultService {
  constructor(
    @InjectModel(QuizResult.name) private resultModel: Model<QuizResult>,
  ) {}

  async getMyResults(userId: string): Promise<QuizResult[]> {
    return this.resultModel
      .find({ userId })
      .populate('quizId', 'topic difficulty numberOfQuestions')
      .sort({ completedAt: -1 })
      .exec();
  }

  async getResultById(
    resultSlug: string,
    userId: string,
  ): Promise<{
    _id: unknown;
    slug: string;
    userId: unknown;
    quizId: unknown;
    quizTopic: string;
    quizDifficulty: string;
    attemptId: unknown;
    score: unknown;
    totalQuestions: unknown;
    percentage: unknown;
    completedAt: unknown;
    answers: Array<{
      questionIndex: number;
      questionText: string;
      questionType: string;
      options: string[];
      selectedAnswers: number[];
      correctAnswers: number[];
      isCorrect: boolean;
      explanation: string;
    }>;
  }> {
    const result = await this.resultModel
      .findOne({ slug: resultSlug })
      .populate({
        path: 'quizId',
        select: 'topic difficulty numberOfQuestions questions',
      })
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Verify user owns the result
    if (result.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this result');
    }

    // Include question details in the response
    const quiz = result.quizId as unknown as {
      _id: unknown;
      topic: string;
      difficulty: string;
      questions: Array<{
        questionText: string;
        questionType: string;
        options: string[];
        explanation: string;
      }>;
    };
    const detailedAnswers = result.answers.map((answer) => {
      const question = quiz.questions[answer.questionIndex];
      return {
        questionIndex: answer.questionIndex,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options,
        selectedAnswers: answer.selectedAnswers,
        correctAnswers: answer.correctAnswers,
        isCorrect: answer.isCorrect,
        explanation: question.explanation,
      };
    });

    return {
      _id: result._id,
      slug: result.slug,
      userId: result.userId,
      quizId: quiz._id,
      quizTopic: quiz.topic,
      quizDifficulty: quiz.difficulty,
      attemptId: result.attemptId,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage,
      completedAt: result.completedAt,
      answers: detailedAnswers,
    };
  }

  async getResultsByQuizId(
    quizSlug: string,
    userId: string,
  ): Promise<QuizResult[]> {
    // First find the quiz by slug to get its ObjectId
    const quiz = await this.resultModel.db
      .collection('quizzes')
      .findOne({ slug: quizSlug });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return this.resultModel
      .find({ quizId: quiz._id, userId })
      .sort({ completedAt: -1 })
      .exec();
  }
}
