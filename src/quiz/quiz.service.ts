import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { Quiz } from '../schemas/quiz.schema';
import { QuizResult } from '../schemas/quiz-result.schema';
import { OpenAIService } from '../openai/openai.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { GenerateAdaptiveQuizDto } from './dto/generate-adaptive-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { generateQuizSlug } from '../utils/slug.utils';
import { WrongAnswer } from '../openai/openai.interfaces';

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
    @InjectModel(QuizResult.name) private resultModel: Model<QuizResult>,
    private openAIService: OpenAIService,
    @InjectConnection() private connection: Connection,
  ) {}

  async generateQuiz(
    userId: string,
    generateQuizDto: GenerateQuizDto,
  ): Promise<Quiz> {
    const db = this.connection.db;

    if (!db) {
      throw new Error('Database connection not available');
    }

    const userExists = await db
      .collection('users')
      .findOne({ _id: new Types.ObjectId(userId) });

    if (!userExists) {
      throw new ForbiddenException('Invalid user. Cannot create quiz.');
    }

    const questions = await this.openAIService.generateQuiz(
      generateQuizDto,
      userId,
    );

    // Generate unique slug
    const slug = generateQuizSlug(generateQuizDto.topic);

    // Create quiz
    const quiz = new this.quizModel({
      slug,
      creatorId: userId,
      topic: generateQuizDto.topic,
      difficulty: generateQuizDto.difficulty,
      questionTypes: generateQuizDto.questionTypes,
      numberOfQuestions: generateQuizDto.numberOfQuestions,
      questions,
      isPublic: false,
    });

    return quiz.save();
  }

  async generateAdaptiveQuiz(
    userId: string,
    generateAdaptiveQuizDto: GenerateAdaptiveQuizDto,
  ): Promise<Quiz> {
    const { resultSlug, focusOnWeakAreas, useHarderDifficulty } =
      generateAdaptiveQuizDto;

    // Fetch the result with populated quiz data
    const result = await this.resultModel
      .findOne({ slug: resultSlug })
      .populate({
        path: 'quizId',
        select:
          'slug topic difficulty numberOfQuestions questionTypes questions parentQuizId',
      })
      .exec();

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // Verify user owns the result
    if (result.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You can only generate adaptive quizzes from your own results',
      );
    }

    // Get the quiz data from the result
    const quizFromResult = result.quizId as unknown as {
      _id: Types.ObjectId;
      topic: string;
      difficulty: 'easy' | 'medium' | 'hard';
      numberOfQuestions: number;
      questionTypes: string[];
      questions: Array<{
        questionText: string;
        questionType: string;
        options: string[];
        correctAnswers: number[];
        explanation: string;
      }>;
      parentQuizId?: Types.ObjectId;
    };

    const originalQuiz = quizFromResult;

    if (!originalQuiz || !originalQuiz.questions) {
      throw new BadRequestException(
        'Cannot generate adaptive quiz: original quiz data incomplete',
      );
    }

    // Extract wrong answers with full question details
    const wrongAnswers: WrongAnswer[] = [];

    for (const answer of result.answers) {
      if (answer.isCorrect) {
        continue;
      }

      // Validate question index to prevent out of bounds errors
      if (
        answer.questionIndex < 0 ||
        answer.questionIndex >= originalQuiz.questions.length
      ) {
        continue;
      }

      const question = originalQuiz.questions[answer.questionIndex];
      if (!question) {
        continue;
      }

      wrongAnswers.push({
        questionText: question.questionText,
        questionType: question.questionType,
        selectedAnswers: answer.selectedAnswers,
        correctAnswers: answer.correctAnswers,
        explanation: question.explanation,
        options: question.options,
      });
    }

    // If user wants to focus on weak areas but has no wrong answers, disable the focus
    const shouldFocusOnWeakAreas = focusOnWeakAreas && wrongAnswers.length > 0;

    // Generate adaptive quiz using OpenAI
    const adaptiveQuizResult = await this.openAIService.generateAdaptiveQuiz(
      {
        originalTopic: originalQuiz.topic,
        originalDifficulty: originalQuiz.difficulty,
        questionTypes: originalQuiz.questionTypes,
        numberOfQuestions: originalQuiz.numberOfQuestions,
        wrongAnswers,
        focusOnWeakAreas: shouldFocusOnWeakAreas,
        useHarderDifficulty,
      },
      userId,
    );

    const questions = adaptiveQuizResult.questions;
    const weakTopics = adaptiveQuizResult.weakTopics;

    // Validate that we got questions
    if (!questions || questions.length === 0) {
      throw new InternalServerErrorException(
        'Failed to generate quiz questions. Please try again.',
      );
    }

    // Determine generation type
    let generationType: string;
    if (useHarderDifficulty) {
      generationType = 'adaptive-harder';
    } else if (shouldFocusOnWeakAreas) {
      generationType = 'adaptive-weak';
    } else {
      generationType = 'adaptive-same';
    }

    // Generate unique slug
    const slug = generateQuizSlug(originalQuiz.topic);

    // Determine target difficulty
    const targetDifficulty = useHarderDifficulty
      ? this.getNextDifficulty(originalQuiz.difficulty)
      : originalQuiz.difficulty;

    // Determine the true parent quiz ID
    // If the quiz from result is itself adaptive, use its parent
    // Otherwise, use the quiz itself as the parent
    const trueParentQuizId = originalQuiz.parentQuizId || originalQuiz._id;

    // Create new adaptive quiz
    const quiz = new this.quizModel({
      slug,
      creatorId: userId,
      topic: originalQuiz.topic,
      difficulty: targetDifficulty,
      questionTypes: originalQuiz.questionTypes,
      numberOfQuestions: originalQuiz.numberOfQuestions,
      questions,
      isPublic: false, // Always create adaptive quizzes as private
      parentQuizId: trueParentQuizId,
      sourceResultId: result._id, // Track which result triggered this adaptive quiz
      generationType,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      weakTopicsFocus:
        weakTopics && weakTopics.length > 0 ? weakTopics : undefined,
      questionSource: 'openai',
    });

    return quiz.save();
  }

  async getAdaptiveQuizzesForParent(
    parentQuizSlug: string,
    userId: string,
  ): Promise<any[]> {
    // First find the parent quiz
    const parentQuiz = await this.quizModel
      .findOne({ slug: parentQuizSlug })
      .exec();

    if (!parentQuiz) {
      throw new NotFoundException('Parent quiz not found');
    }

    // Check if user is the creator
    if (parentQuiz.creatorId.toString() !== userId) {
      throw new ForbiddenException(
        'You can only view adaptive quizzes for your own quizzes',
      );
    }

    // Find all adaptive quizzes for this parent
    const adaptiveQuizzes = await this.quizModel
      .find({
        parentQuizId: parentQuiz._id,
        creatorId: userId,
      })
      .populate('sourceResultId', 'score totalQuestions percentage completedAt')
      .sort({ createdAt: -1 })
      .exec();

    // For each adaptive quiz, get attempt/result statistics and completion result
    const quizzesWithStats = await Promise.all(
      adaptiveQuizzes.map(async (quiz) => {
        const db = this.connection.db;
        let attemptCount = 0;

        if (db) {
          attemptCount = await db.collection('quizattempts').countDocuments({
            quizId: quiz._id,
            status: 'completed',
          });
        }

        // Get the completion result for this adaptive quiz
        const completionResult = await this.resultModel
          .findOne({ quizId: quiz._id, userId })
          .select('score totalQuestions percentage completedAt slug')
          .sort({ completedAt: -1 })
          .exec();

        return {
          _id: quiz._id,
          slug: quiz.slug,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          generationType: quiz.generationType,
          createdAt: (quiz as any).createdAt,
          sourceResult: quiz.sourceResultId,
          completionResult: completionResult
            ? {
                score: completionResult.score,
                totalQuestions: completionResult.totalQuestions,
                percentage: completionResult.percentage,
                completedAt: completionResult.completedAt,
                slug: completionResult.slug,
              }
            : null,
          attemptCount,
        };
      }),
    );

    return quizzesWithStats;
  }

  private getNextDifficulty(
    current: 'easy' | 'medium' | 'hard',
  ): 'easy' | 'medium' | 'hard' {
    const difficultyMap = {
      easy: 'medium' as const,
      medium: 'hard' as const,
      hard: 'hard' as const,
    };
    return difficultyMap[current];
  }

  async getMyQuizzes(userId: string): Promise<Quiz[]> {
    return this.quizModel
      .find({ creatorId: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPublicQuizzes(): Promise<Quiz[]> {
    return this.quizModel
      .find({ isPublic: true })
      .populate('creatorId', 'username')
      .sort({ createdAt: -1 })
      .exec();
  }

  async hasUserCompletedQuiz(
    quizSlug: string,
    userId: string,
  ): Promise<boolean> {
    // Find the quiz first
    const quiz = await this.quizModel.findOne({ slug: quizSlug }).exec();
    if (!quiz) {
      return false;
    }

    // Check if user has any completed results for this quiz
    const result = await this.resultModel
      .findOne({
        quizId: quiz._id,
        userId: new Types.ObjectId(userId),
      })
      .exec();

    return !!result;
  }

  async getQuizById(quizSlug: string, userId?: string): Promise<Quiz> {
    const quiz = await this.quizModel
      .findOne({ slug: quizSlug })
      .populate('creatorId', 'username email')
      .exec();

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // STRICT: Quiz must have a valid creator - no orphaned quizzes allowed
    if (!quiz.creatorId) {
      throw new NotFoundException(
        'Quiz is corrupted (invalid creator). Please contact support.',
      );
    }

    // Check if user has access
    // If no userId (not logged in), only allow access to public quizzes
    if (!userId) {
      if (!quiz.isPublic) {
        throw new ForbiddenException('You do not have access to this quiz');
      }
    } else {
      // If user is logged in, check if they're creator or quiz is public
      let creatorIdStr: string;
      if (
        typeof quiz.creatorId === 'object' &&
        quiz.creatorId !== null &&
        '_id' in quiz.creatorId
      ) {
        const creatorObj = quiz.creatorId as {
          _id: { toString: () => string };
        };
        creatorIdStr = creatorObj._id.toString();
      } else {
        const creatorId = quiz.creatorId as { toString: () => string };
        creatorIdStr = creatorId.toString();
      }

      if (creatorIdStr !== userId && !quiz.isPublic) {
        throw new ForbiddenException('You do not have access to this quiz');
      }
    }

    // Check if user has completed the quiz to determine if questions should be visible
    let hasCompletedQuiz = false;
    let isOwner = false;

    if (userId) {
      // Check if user is the owner
      let creatorIdStr: string;
      if (
        typeof quiz.creatorId === 'object' &&
        quiz.creatorId !== null &&
        '_id' in quiz.creatorId
      ) {
        const creatorObj = quiz.creatorId as {
          _id: { toString: () => string };
        };
        creatorIdStr = creatorObj._id.toString();
      } else {
        const creatorId = quiz.creatorId as { toString: () => string };
        creatorIdStr = creatorId.toString();
      }
      isOwner = creatorIdStr === userId;

      // Check completion status
      hasCompletedQuiz = await this.hasUserCompletedQuiz(quizSlug, userId);
    }

    // Create response object
    const quizObj: any = quiz.toObject();

    // Hide questions unless user has completed the quiz or is the owner
    if (!isOwner && !hasCompletedQuiz) {
      quizObj.questions = undefined;
    }

    // Add metadata flags
    quizObj.hasCompletedQuiz = hasCompletedQuiz;
    quizObj.isOwner = isOwner;

    return quizObj;
  }

  async updateQuiz(
    quizSlug: string,
    userId: string,
    updateQuizDto: UpdateQuizDto,
  ): Promise<Quiz> {
    const quiz = await this.quizModel.findOne({ slug: quizSlug }).exec();

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user is the creator
    if (quiz.creatorId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own quizzes');
    }

    // Update quiz
    if (updateQuizDto.isPublic !== undefined) {
      quiz.isPublic = updateQuizDto.isPublic;
    }

    return quiz.save();
  }

  async deleteQuiz(quizSlug: string, userId: string): Promise<void> {
    const quiz = await this.quizModel.findOne({ slug: quizSlug }).exec();

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user is the creator
    if (quiz.creatorId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own quizzes');
    }

    await this.quizModel.deleteOne({ slug: quizSlug }).exec();
  }

  async toggleVisibility(quizSlug: string, userId: string): Promise<Quiz> {
    const quiz = await this.quizModel.findOne({ slug: quizSlug }).exec();

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user is the creator
    if (quiz.creatorId.toString() !== userId) {
      throw new ForbiddenException('You can only modify your own quizzes');
    }

    // Prevent adaptive quizzes from being made public
    if (quiz.parentQuizId) {
      throw new BadRequestException('Adaptive quizzes cannot be made public');
    }

    quiz.isPublic = !quiz.isPublic;
    return quiz.save();
  }
}
