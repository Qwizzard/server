import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuizResult } from '../schemas/quiz-result.schema';
import {
  PopulatedQuiz,
  ResultResponse,
  DetailedAnswer,
} from './result.interfaces';

@Injectable()
export class ResultService {
  constructor(
    @InjectModel(QuizResult.name) private resultModel: Model<QuizResult>,
  ) {}

  async getMyResults(userId: string): Promise<QuizResult[]> {
    return this.resultModel
      .find({ userId })
      .populate('quizId', 'slug topic difficulty numberOfQuestions')
      .sort({ completedAt: -1 })
      .exec();
  }

  async getResultById(
    resultSlug: string,
    userId?: string,
  ): Promise<ResultResponse> {
    const result = await this.resultModel
      .findOne({ slug: resultSlug })
      .populate({
        path: 'quizId',
        select: 'slug topic difficulty numberOfQuestions questions',
      })
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Check access: either user owns it, or result is public
    if (!userId) {
      // Not logged in - can only view if result is public
      if (!result.isResultPublic) {
        throw new ForbiddenException('You do not have access to this result');
      }
    } else {
      // Logged in - can view if owned or public
      if (result.userId.toString() !== userId && !result.isResultPublic) {
        throw new ForbiddenException('You do not have access to this result');
      }
    }

    // Include question details in the response
    // Type assertion needed because Mongoose populate returns ObjectId but we know it's populated
    const quiz = result.quizId as unknown as PopulatedQuiz;

    const detailedAnswers: DetailedAnswer[] = result.answers.map((answer) => {
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
      _id: result._id as unknown,
      slug: result.slug as string,
      userId: result.userId as unknown,
      quizId: quiz._id,
      quizSlug: quiz.slug,
      quizTopic: quiz.topic,
      quizDifficulty: quiz.difficulty,
      attemptId: result.attemptId as unknown,
      score: result.score as unknown,
      totalQuestions: result.totalQuestions as unknown,
      percentage: result.percentage as unknown,
      completedAt: result.completedAt as unknown,
      isResultPublic: result.isResultPublic as boolean,
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

  async toggleResultVisibility(
    resultSlug: string,
    userId: string,
  ): Promise<QuizResult> {
    const result = await this.resultModel.findOne({ slug: resultSlug }).exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Verify user owns the result
    if (result.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this result',
      );
    }

    result.isResultPublic = !result.isResultPublic;
    await result.save();

    return result;
  }
}
