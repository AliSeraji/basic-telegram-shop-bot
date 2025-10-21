import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  imageData?: Buffer;

  @IsString()
  @IsOptional()
  imageMimeType?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  categoryId?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  stock?: number;
}
