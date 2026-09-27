import 'reflect-metadata';
import { createSchemaFirstApplication } from './schema-first.js';

const app = await createSchemaFirstApplication();
app.enableShutdownHooks();
await app.listen(Number(process.env.GRAPHQL_SCHEMA_PORT ?? 3100), '127.0.0.1');
console.log(`Mercurius schema-first: ${await app.getUrl()}/graphql`);
