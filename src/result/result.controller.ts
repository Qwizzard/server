import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ResultService } from './result.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('results')
@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Get('my-results')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all quiz results for current user' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getMyResults(@CurrentUser('userId') userId: string) {
    return this.resultService.getMyResults(userId);
  }

  @Get(':resultId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get detailed result breakdown by ID (public if result is public)',
  })
  @ApiResponse({ status: 200, description: 'Result retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getResultById(
    @Param('resultId') resultId: string,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.resultService.getResultById(resultId, userId);
  }

  @Get('quiz/:quizId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all results for a specific quiz' })
  @ApiResponse({ status: 200, description: 'Results retrieved successfully' })
  async getResultsByQuizId(
    @Param('quizId') quizId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.resultService.getResultsByQuizId(quizId, userId);
  }

  @Patch(':resultId/visibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle result visibility (public/private)' })
  @ApiResponse({
    status: 200,
    description: 'Result visibility toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Result not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async toggleResultVisibility(
    @Param('resultId') resultId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.resultService.toggleResultVisibility(resultId, userId);
  }
}
