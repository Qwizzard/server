import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export class Question {
  @Prop({ required: true })
  questionText: string;

  @Prop({ required: true, enum: ['mcq', 'true-false', 'multiple-correct'] })
  questionType: string;

  @Prop({ required: true, type: [String] })
  options: string[];

  @Prop({ required: true, type: [Number] })
  correctAnswers: number[];

  @Prop({ required: true })
  explanation: string;
}

@Schema({ timestamps: true })
export class Quiz extends Document {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  creatorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  topic: string;

  @Prop({ required: true, enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @Prop({
    required: true,
    type: [String],
    enum: ['mcq', 'true-false', 'multiple-correct'],
  })
  questionTypes: string[];

  @Prop({ required: true })
  numberOfQuestions: number;

  @Prop({ required: true, type: [Question] })
  questions: Question[];

  @Prop({ default: false })
  isPublic: boolean;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);

// Create indexes
QuizSchema.index({ slug: 1 }, { unique: true });
QuizSchema.index({ creatorId: 1 });
QuizSchema.index({ isPublic: 1 });
QuizSchema.index({ createdAt: -1 });
