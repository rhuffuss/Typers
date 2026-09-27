import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { PolicyController } from './http/policy.controller.js';

@Module({
  imports: [CatalogModule, QuotesModule, ReservationsModule],
  controllers: [PolicyController],
})
export class AppModule {}
