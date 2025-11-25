import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OpenAIService } from './openai.service';

@Module({
  imports: [AnalyticsModule],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
