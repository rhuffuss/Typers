import 'reflect-metadata';
import { createFederationLab } from './federation.js';

const lab = await createFederationLab();
console.log(`Apollo federation gateway: ${lab.url}`);
console.log(`Authors subgraph: ${await lab.authors.getUrl()}/graphql`);
console.log(`Articles subgraph: ${await lab.articles.getUrl()}/graphql`);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await lab.close();
};
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});
