import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAttemptDto {
  @ApiProperty({
    description: 'Quiz ID to attempt',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  quizId: string;
}
