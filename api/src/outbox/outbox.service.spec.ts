import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService],
    }).compile();

    service = module.get(OutboxService);
  });

  it('writes the event through the given transaction client, not a fresh connection', async () => {
    const tx = { domainEvent: { create: jest.fn() } };

    await service.record(tx as any, 'contact.created', { contactId: 'c1' });

    expect(tx.domainEvent.create).toHaveBeenCalledWith({
      data: { type: 'contact.created', payload: { contactId: 'c1' } },
    });
  });
});
