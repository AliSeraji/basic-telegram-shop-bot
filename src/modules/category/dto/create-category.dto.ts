import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // @IsString()
  // @IsNotEmpty()
  // nameFa: string;

  @IsString()
  description?: string;

  // @IsString()
  // descriptionFa: string;
}
