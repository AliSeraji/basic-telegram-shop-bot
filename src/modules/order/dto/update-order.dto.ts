import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUS } from '../../../common/constants';

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(ORDER_STATUS)
  status?: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  receiptImage?: Buffer;

  @IsOptional()
  @IsString()
  receiptImageMimeType?: string;
}
