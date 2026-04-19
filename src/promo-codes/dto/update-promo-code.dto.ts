import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';

import { CreatePromoCodeDto } from './create-promo-code.dto';

export class UpdatePromoCodeDto extends PartialType(CreatePromoCodeDto) {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code?: string;
}
