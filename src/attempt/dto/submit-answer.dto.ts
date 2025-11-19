import { IsInt, IsArray, ArrayNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'Index of the question (0-based)', example: 0 })
  @IsInt()
  @Min(0)
  questionIndex: number;

  @ApiProperty({ description: 'Selected answer indices', type: [Number], example: [0, 2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  selectedAnswers: number[];
}

