import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateAdaptiveQuizDto {
  @ApiProperty({
    description: 'Slug of the quiz result to base the adaptive quiz on',
    example: 'javascript-basics-result-abc123',
  })
  @IsString()
  @IsNotEmpty()
  resultSlug: string;

  @ApiProperty({
    description:
      'Whether to focus 70-80% of questions on topics where user struggled',
    example: true,
  })
  @IsBoolean()
  focusOnWeakAreas: boolean;

  @ApiProperty({
    description:
      'Whether to increase difficulty level (for users who scored 100%)',
    example: false,
  })
  @IsBoolean()
  useHarderDifficulty: boolean;
}

