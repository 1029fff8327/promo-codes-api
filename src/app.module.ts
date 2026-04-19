import { Module } from '@nestjs/common';

import { PrismaModule } from './database/prisma.module';
import { HealthController } from './health/health.controller';
import { PromoCodesModule } from './promo-codes/promo-codes.module';

@Module({
  imports: [PrismaModule, PromoCodesModule],
  controllers: [HealthController],
})
export class AppModule {}
