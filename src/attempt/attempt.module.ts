import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttemptController } from './attempt.controller';
import { AttemptService } from './attempt.service';
import { QuizAttempt, QuizAttemptSchema } from '../schemas/quiz-attempt.schema';
import { QuizResult, QuizResultSchema } from '../schemas/quiz-result.schema';
import { Quiz, QuizSchema } from '../schemas/quiz.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: QuizResult.name, schema: QuizResultSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
  ],
  controllers: [AttemptController],
  providers: [AttemptService],
  exports: [AttemptService],
})
export class AttemptModule {}
