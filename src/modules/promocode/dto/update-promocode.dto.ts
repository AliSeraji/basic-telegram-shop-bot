import {
  IsString,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class UpdatePromocodeDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsDateString()
  @IsOptional()
  validTill?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
