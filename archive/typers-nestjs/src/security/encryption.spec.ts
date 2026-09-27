import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { EncryptionService } from './encryption.service.js';

it('round trips authenticated encryption and rejects tampered ciphertext', async () => {
  const module = await Test.createTestingModule({
    providers: [EncryptionService],
  }).compile();
  try {
    const service = module.get(EncryptionService);
    const key = randomBytes(32);
    const envelope = service.encrypt('Typers demo', key);
    expect(service.decrypt(envelope, key)).toBe('Typers demo');
    expect(service.encrypt('Typers demo', key).iv).not.toBe(envelope.iv);
    expect(() =>
      service.decrypt(
        { ...envelope, ciphertext: randomBytes(11).toString('base64url') },
        key,
      ),
    ).toThrow();
  } finally {
    await module.close();
  }
});
