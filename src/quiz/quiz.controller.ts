import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('quizzes')
@Controller('quizzes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new quiz using AI' })
  @ApiResponse({ status: 201, description: 'Quiz generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateQuiz(
    @CurrentUser('userId') userId: string,
    @Body() generateQuizDto: GenerateQuizDto,
  ) {
    return this.quizService.generateQuiz(userId, generateQuizDto);
  }

  @Get('my-quizzes')
  @ApiOperation({ summary: 'Get all quizzes created by current user' })
  @ApiResponse({ status: 200, description: 'Quizzes retrieved successfully' })
  async getMyQuizzes(@CurrentUser('userId') userId: string) {
    return this.quizService.getMyQuizzes(userId);
  }

  @Get('public')
  @ApiOperation({ summary: 'Get all public quizzes' })
  @ApiResponse({
    status: 200,
    description: 'Public quizzes retrieved successfully',
  })
  async getPublicQuizzes() {
    return this.quizService.getPublicQuizzes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific quiz by ID' })
  @ApiResponse({ status: 200, description: 'Quiz retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getQuizById(
    @Param('id') quizId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.quizService.getQuizById(quizId, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz updated successfully' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateQuiz(
    @Param('id') quizId: string,
    @CurrentUser('userId') userId: string,
    @Body() updateQuizDto: UpdateQuizDto,
  ) {
    return this.quizService.updateQuiz(quizId, userId, updateQuizDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quiz' })
  @ApiResponse({ status: 200, description: 'Quiz deleted successfully' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteQuiz(
    @Param('id') quizId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.quizService.deleteQuiz(quizId, userId);
    return { message: 'Quiz deleted successfully' };
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Toggle quiz visibility (public/private)' })
  @ApiResponse({
    status: 200,
    description: 'Quiz visibility toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async toggleVisibility(
    @Param('id') quizId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.quizService.toggleVisibility(quizId, userId);
  }
}
