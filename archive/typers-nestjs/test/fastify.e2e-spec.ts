import { createFastifyLab } from '../src/platform/fastify-lab.js';

describe('Fastify alternative HTTP adapter', () => {
  it('serves reusable Nest controllers, validates and handles multipart natively', async () => {
    const app = await createFastifyLab();
    try {
      await app.listen(0, '127.0.0.1');
      const base = await app.getUrl();
      const response = await fetch(`${base}/adapter`);
      expect(await response.json()).toEqual({
        adapter: 'fastify',
        method: 'GET',
      });
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      const form = new FormData();
      form.append('file', new Blob(['Typers']), 'demo.txt');
      const upload = await fetch(`${base}/adapter/upload`, {
        method: 'POST',
        body: form,
      });
      expect(await upload.json()).toEqual({ name: 'demo.txt', bytes: 6 });
      const invalid = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(invalid.status).toBe(400);
    } finally {
      await app.close();
    }
  });
});
