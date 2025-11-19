import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuizDto {
  @ApiProperty({ description: 'Make quiz public or private', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

