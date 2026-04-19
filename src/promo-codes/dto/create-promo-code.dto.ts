import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  activationLimit!: number;

  @IsDateString()
  expiresAt!: string;
}
