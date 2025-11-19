import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async getResultById(resultId: string, userId: string): Promise<any> {
    const result = await this.resultModel
      .findById(resultId)
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
    const quiz: any = result.quizId;
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
      userId: result.userId,
      quizId: result.quizId._id,
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

  async getResultsByQuizId(quizId: string, userId: string): Promise<QuizResult[]> {
    return this.resultModel
      .find({ quizId, userId })
      .sort({ completedAt: -1 })
      .exec();
  }
}

