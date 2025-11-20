import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get('/health')
  @ApiOperation({ summary: 'Check server health' })
  @ApiResponse({ status: 200, description: 'Server is healthy' })
  getHealth(): { status: string; timestamp: number } {
    return { status: 'ok', timestamp: Date.now() };
  }
}
