import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export class ResultAnswer {
  @Prop({ required: true })
  questionIndex: number;

  @Prop({ required: true, type: [Number] })
  selectedAnswers: number[];

  @Prop({ required: true, type: [Number] })
  correctAnswers: number[];

  @Prop({ required: true })
  isCorrect: boolean;
}

@Schema({ timestamps: true })
export class QuizResult extends Document {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Quiz' })
  quizId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'QuizAttempt' })
  attemptId: Types.ObjectId;

  @Prop({ required: true, type: [ResultAnswer] })
  answers: ResultAnswer[];

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  totalQuestions: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({ required: true, default: Date.now })
  completedAt: Date;

  @Prop({ required: true, default: true })
  isResultPublic: boolean;
}

export const QuizResultSchema = SchemaFactory.createForClass(QuizResult);

// Create indexes
QuizResultSchema.index({ slug: 1 }, { unique: true });
QuizResultSchema.index({ userId: 1 });
QuizResultSchema.index({ quizId: 1 });
QuizResultSchema.index({ attemptId: 1 });
QuizResultSchema.index({ completedAt: -1 });
