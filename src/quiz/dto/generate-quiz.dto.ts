import { IsString, IsNotEmpty, IsEnum, IsArray, ArrayMinSize, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateQuizDto {
  @ApiProperty({ description: 'Topic of the quiz', example: 'JavaScript Basics' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({ description: 'Difficulty level', enum: ['easy', 'medium', 'hard'], example: 'medium' })
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    description: 'Types of questions to include',
    type: [String],
    enum: ['mcq', 'true-false', 'multiple-correct'],
    example: ['mcq', 'true-false'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['mcq', 'true-false', 'multiple-correct'], { each: true })
  questionTypes: string[];

  @ApiProperty({ description: 'Number of questions', minimum: 1, maximum: 20, example: 10 })
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfQuestions: number;
}

