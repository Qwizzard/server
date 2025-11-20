import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ResultService } from './result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('results')
@Controller('results')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get('my-results')
  @ApiOperation({ summary: 'Get all quiz results for current user' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getMyResults(@CurrentUser('userId') userId: string) {
    return this.resultService.getMyResults(userId);
  }

  @Get(':resultId')
  @ApiOperation({ summary: 'Get detailed result breakdown by ID' })
  @ApiResponse({ status: 200, description: 'Result retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getResultById(
    @Param('resultId') resultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.resultService.getResultById(resultId, userId);
  }

  @Get('quiz/:quizId')
  @ApiOperation({ summary: 'Get all results for a specific quiz' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getResultsByQuizId(
    @Param('quizId') quizId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.resultService.getResultsByQuizId(quizId, userId);
  }
}
