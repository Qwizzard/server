import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { QuizResult, QuizResultSchema } from '../schemas/quiz-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizResult.name, schema: QuizResultSchema },
    ]),
  ],
  controllers: [ResultController],
  providers: [ResultService],
  exports: [ResultService],
})
export class ResultModule {}

