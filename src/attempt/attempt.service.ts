import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuizAttempt } from '../schemas/quiz-attempt.schema';
import { QuizResult } from '../schemas/quiz-result.schema';
import { Quiz } from '../schemas/quiz.schema';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Injectable()
export class AttemptService {
  constructor(
    @InjectModel(QuizAttempt.name) private attemptModel: Model<QuizAttempt>,
    @InjectModel(QuizResult.name) private resultModel: Model<QuizResult>,
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
  ) {}

  async startAttempt(userId: string, startAttemptDto: StartAttemptDto): Promise<QuizAttempt> {
    const { quizId } = startAttemptDto;

    // Verify quiz exists and user has access
    const quiz = await this.quizModel.findById(quizId).exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user has access (creator or public quiz)
    if (quiz.creatorId.toString() !== userId && !quiz.isPublic) {
      throw new ForbiddenException('You do not have access to this quiz');
    }

    // Create new attempt
    const attempt = new this.attemptModel({
      userId,
      quizId,
      answers: [],
      status: 'in-progress',
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    });

    return attempt.save();
  }

  async getMyAttempts(userId: string): Promise<QuizAttempt[]> {
    return this.attemptModel
      .find({ userId })
      .populate('quizId', 'topic difficulty numberOfQuestions')
      .sort({ startedAt: -1 })
      .exec();
  }

  async getAttemptById(attemptId: string, userId: string): Promise<QuizAttempt> {
    const attempt = await this.attemptModel
      .findById(attemptId)
      .populate('quizId')
      .exec();

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Verify user owns the attempt
    if (attempt.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    return attempt;
  }

  async submitAnswer(
    attemptId: string,
    userId: string,
    submitAnswerDto: SubmitAnswerDto,
  ): Promise<QuizAttempt> {
    const attempt = await this.attemptModel.findById(attemptId).exec();

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Verify user owns the attempt
    if (attempt.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    // Check if attempt is still in progress
    if (attempt.status !== 'in-progress') {
      throw new BadRequestException('This attempt has already been completed or abandoned');
    }

    // Verify quiz and question index
    const quiz = await this.quizModel.findById(attempt.quizId).exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (submitAnswerDto.questionIndex >= quiz.questions.length) {
      throw new BadRequestException('Invalid question index');
    }

    // Check if answer for this question already exists
    const existingAnswerIndex = attempt.answers.findIndex(
      (a) => a.questionIndex === submitAnswerDto.questionIndex,
    );

    if (existingAnswerIndex >= 0) {
      // Update existing answer
      attempt.answers[existingAnswerIndex].selectedAnswers = submitAnswerDto.selectedAnswers;
      attempt.answers[existingAnswerIndex].answeredAt = new Date();
    } else {
      // Add new answer
      attempt.answers.push({
        questionIndex: submitAnswerDto.questionIndex,
        selectedAnswers: submitAnswerDto.selectedAnswers,
        answeredAt: new Date(),
      });
    }

    attempt.lastUpdatedAt = new Date();
    return attempt.save();
  }

  async submitAttempt(attemptId: string, userId: string): Promise<QuizResult> {
    const attempt = await this.attemptModel
      .findById(attemptId)
      .populate('quizId')
      .exec();

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Verify user owns the attempt
    if (attempt.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    // Check if attempt is still in progress
    if (attempt.status !== 'in-progress') {
      throw new BadRequestException('This attempt has already been completed or abandoned');
    }

    // Get quiz
    const quiz = await this.quizModel.findById(attempt.quizId).exec();
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Calculate score
    const { score, answers } = this.calculateScore(quiz, attempt);

    // Create result
    const result = new this.resultModel({
      userId: attempt.userId,
      quizId: attempt.quizId,
      attemptId: attempt._id,
      answers,
      score,
      totalQuestions: quiz.numberOfQuestions,
      percentage: (score / quiz.numberOfQuestions) * 100,
      completedAt: new Date(),
    });

    // Update attempt status
    attempt.status = 'completed';
    attempt.completedAt = new Date();
    await attempt.save();

    return result.save();
  }

  async abandonAttempt(attemptId: string, userId: string): Promise<void> {
    const attempt = await this.attemptModel.findById(attemptId).exec();

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Verify user owns the attempt
    if (attempt.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    attempt.status = 'abandoned';
    await attempt.save();
  }

  private calculateScore(
    quiz: Quiz,
    attempt: QuizAttempt,
  ): {
    score: number;
    answers: Array<{
      questionIndex: number;
      selectedAnswers: number[];
      correctAnswers: number[];
      isCorrect: boolean;
    }>;
  } {
    let score = 0;
    const answers: Array<{
      questionIndex: number;
      selectedAnswers: number[];
      correctAnswers: number[];
      isCorrect: boolean;
    }> = [];

    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const userAnswer = attempt.answers.find((a) => a.questionIndex === i);

      let isCorrect = false;
      const selectedAnswers = userAnswer?.selectedAnswers || [];

      if (userAnswer) {
        // Check if answers match
        const correctAnswers = question.correctAnswers.sort((a, b) => a - b);
        const sortedSelectedAnswers = selectedAnswers.sort((a, b) => a - b);

        isCorrect =
          correctAnswers.length === sortedSelectedAnswers.length &&
          correctAnswers.every((val, idx) => val === sortedSelectedAnswers[idx]);

        if (isCorrect) {
          score++;
        }
      }

      answers.push({
        questionIndex: i,
        selectedAnswers,
        correctAnswers: question.correctAnswers,
        isCorrect,
      });
    }

    return { score, answers };
  }
}

