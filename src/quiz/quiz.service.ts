import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Quiz } from '../schemas/quiz.schema';
import { OpenAIService } from '../openai/openai.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { generateQuizSlug } from '../utils/slug.utils';

@Injectable()
export class QuizService {
  constructor(
    @InjectModel(Quiz.name) private quizModel: Model<Quiz>,
    private openAIService: OpenAIService,
  ) {}

  async generateQuiz(
    userId: string,
    generateQuizDto: GenerateQuizDto,
  ): Promise<Quiz> {
    // Generate questions using OpenAI
    const questions = await this.openAIService.generateQuiz(generateQuizDto);

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

  async getQuizById(quizSlug: string, userId?: string): Promise<Quiz> {
    const quiz = await this.quizModel
      .findOne({ slug: quizSlug })
      .populate('creatorId', 'username email')
      .exec();

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Check if user has access
    // If no userId (not logged in), only allow access to public quizzes
    if (!userId) {
      if (!quiz.isPublic) {
        throw new ForbiddenException('You do not have access to this quiz');
      }
    } else {
      // If user is logged in, check if they're creator or quiz is public
      // Handle case where creatorId might be null (deleted user)
      if (!quiz.creatorId) {
        // If creator doesn't exist and quiz is not public, deny access
        if (!quiz.isPublic) {
          throw new ForbiddenException('You do not have access to this quiz');
        }
      } else {
        // Use type assertion to handle populated vs non-populated creatorId
        let creatorIdStr: string;
        if (typeof quiz.creatorId === 'object' && quiz.creatorId !== null && '_id' in quiz.creatorId) {
          creatorIdStr = (quiz.creatorId as any)._id.toString();
        } else {
          creatorIdStr = (quiz.creatorId as any).toString();
        }
        
        if (creatorIdStr !== userId && !quiz.isPublic) {
          throw new ForbiddenException('You do not have access to this quiz');
        }
      }
    }

    return quiz;
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

    quiz.isPublic = !quiz.isPublic;
    return quiz.save();
  }
}
