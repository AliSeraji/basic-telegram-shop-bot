import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  orderId: number;

  @IsString()
  @IsNotEmpty()
  paymentType: string;

  @IsOptional()
  receiptImage?: Buffer;

  @IsString()
  @IsOptional()
  receiptImageMimeType?: string;
}
