import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAttemptDto {
  @ApiProperty({
    description: 'Quiz slug to attempt',
    example: 'javascript-basics-abc123',
  })
  @IsString()
  @IsNotEmpty()
  quizId: string;
}
