import { IsString, IsOptional } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional()
  receiptImage?: Buffer;

  @IsString()
  @IsOptional()
  receiptImageMimeType?: string;
}
