import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export class Answer {
  @Prop({ required: true })
  questionIndex: number;

  @Prop({ required: true, type: [Number] })
  selectedAnswers: number[];

  @Prop({ required: true, default: Date.now })
  answeredAt: Date;
}

@Schema({ timestamps: true })
export class QuizAttempt extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Quiz' })
  quizId: Types.ObjectId;

  @Prop({ type: [Answer], default: [] })
  answers: Answer[];

  @Prop({
    required: true,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress',
  })
  status: string;

  @Prop({ required: true, default: Date.now })
  startedAt: Date;

  @Prop({ required: true, default: Date.now })
  lastUpdatedAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  timeLimit?: number;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);

// Create indexes
QuizAttemptSchema.index({ userId: 1, quizId: 1 });
QuizAttemptSchema.index({ status: 1 });
QuizAttemptSchema.index({ startedAt: -1 });
