import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Injectable()
export class ExpensePolicyService {
  read(): unknown {
    // This asset is copied by typers-nest; the compiler CLI only emits code.
    return JSON.parse(
      readFileSync(
        new URL('./policies/expenses.json', import.meta.url),
        'utf8',
      ),
    );
  }
}

@Controller('expenses')
export class ExpensePolicyController {
  constructor(private readonly policies: ExpensePolicyService) {}

  @Get('policy')
  policy(): unknown {
    return this.policies.read();
  }
}

@Module({
  controllers: [ExpensePolicyController],
  providers: [ExpensePolicyService],
})
export class ExpensePolicyModule {}

export async function createPolicyApp() {
  return NestFactory.create(ExpensePolicyModule, { logger: false });
}
