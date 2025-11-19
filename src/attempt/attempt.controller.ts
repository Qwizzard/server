import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AttemptService } from './attempt.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('attempts')
@Controller('attempts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new quiz attempt' })
  @ApiResponse({ status: 201, description: 'Attempt started successfully' })
  @ApiResponse({ status: 404, description: 'Quiz not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async startAttempt(
    @CurrentUser('userId') userId: string,
    @Body() startAttemptDto: StartAttemptDto,
  ) {
    return this.attemptService.startAttempt(userId, startAttemptDto);
  }

  @Get('my-attempts')
  @ApiOperation({ summary: 'Get all attempts by current user' })
  @ApiResponse({ status: 200, description: 'Attempts retrieved successfully' })
  async getMyAttempts(@CurrentUser('userId') userId: string) {
    return this.attemptService.getMyAttempts(userId);
  }

  @Get(':attemptId')
  @ApiOperation({ summary: 'Get a specific attempt by ID' })
  @ApiResponse({ status: 200, description: 'Attempt retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getAttemptById(
    @Param('attemptId') attemptId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.attemptService.getAttemptById(attemptId, userId);
  }

  @Post(':attemptId/answer')
  @ApiOperation({ summary: 'Submit answer for a question' })
  @ApiResponse({ status: 200, description: 'Answer saved successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async submitAnswer(
    @Param('attemptId') attemptId: string,
    @CurrentUser('userId') userId: string,
    @Body() submitAnswerDto: SubmitAnswerDto,
  ) {
    return this.attemptService.submitAnswer(attemptId, userId, submitAnswerDto);
  }

  @Post(':attemptId/submit')
  @ApiOperation({ summary: 'Submit completed attempt for grading' })
  @ApiResponse({ status: 201, description: 'Attempt submitted and graded successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  @ApiResponse({ status: 400, description: 'Attempt already completed' })
  async submitAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.attemptService.submitAttempt(attemptId, userId);
  }

  @Delete(':attemptId')
  @ApiOperation({ summary: 'Abandon an in-progress attempt' })
  @ApiResponse({ status: 200, description: 'Attempt abandoned successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  async abandonAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.attemptService.abandonAttempt(attemptId, userId);
    return { message: 'Attempt abandoned successfully' };
  }
}

