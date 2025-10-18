import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  userAddress?: string;

  @IsString()
  @IsOptional()
  language: string | null;
}
