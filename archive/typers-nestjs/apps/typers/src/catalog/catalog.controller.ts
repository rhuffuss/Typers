import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DomainErrorResponse, ProductResponse } from '../http/api-contracts.js';
import { domainException } from '../http/domain-result.js';
import { CatalogRepository } from './catalog.repository.js';
import type { Product } from './product.js';

@ApiTags('Catálogo')
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogRepository) {}

  @Get()
  @ApiOperation({ summary: 'Ver los productos y el stock disponible' })
  @ApiOkResponse({ type: ProductResponse, isArray: true })
  list(): Product[] {
    return this.catalog.list();
  }

  @Get(':sku')
  @ApiOperation({ summary: 'Consultar un producto: Some → 200; None → 404' })
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ type: DomainErrorResponse })
  find(@Param('sku') sku: string): Product {
    // Typers experimental syntax: the repository lookup is evaluated once.
    if let Some(product) = this.catalog.find(sku) {
      return product;
    } else {
      throw domainException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Product ${sku} was not found`,
        details: { sku },
      });
    }
  }
}
