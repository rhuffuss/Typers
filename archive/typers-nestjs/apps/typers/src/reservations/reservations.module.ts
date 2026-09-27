import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsRepository } from './reservations.repository.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [CatalogModule, QuotesModule],
  controllers: [ReservationsController],
  providers: [ReservationsRepository, ReservationsService],
})
export class ReservationsModule {}
