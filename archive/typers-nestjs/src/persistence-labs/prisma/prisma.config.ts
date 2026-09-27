import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'schema.prisma',
  migrations: { path: 'migrations' },
  datasource: {
    url: process.env.PRISMA_DATABASE_URL ?? 'postgresql://localhost/typers',
  },
});
