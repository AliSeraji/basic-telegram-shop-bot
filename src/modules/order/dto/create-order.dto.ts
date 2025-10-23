import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsOptional()
  receiptImage?: Buffer;

  @IsString()
  @IsOptional()
  receiptImageMimeType?: string;
}
