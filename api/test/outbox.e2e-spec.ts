import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { OutboxService } from '../src/outbox/outbox.service';
import { ContactsService } from '../src/contacts/contacts.service';

describe('Outbox atomicity (integration)', () => {
  let prisma: PrismaService;
  let outbox: OutboxService;
  let contactsService: ContactsService;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, OutboxService, ContactsService],
    }).compile();

    prisma = module.get(PrismaService);
    outbox = module.get(OutboxService);
    contactsService = module.get(ContactsService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: {
        email: `outbox-test-${Date.now()}@example.com`,
        passwordHash: 'unused',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.domainEvent.deleteMany({});
    await prisma.contact.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('writes the business row and the outbox row together on success', async () => {
    const contact = await contactsService.create(userId, {
      name: 'Atomicity Test',
    });

    const event = await prisma.domainEvent.findFirst({
      where: { type: 'contact.created' },
      orderBy: { createdAt: 'desc' },
    });

    expect(event).not.toBeNull();
    expect((event!.payload as { contactId: string }).contactId).toBe(
      contact.id,
    );
  });

  it('rolls back the business row when the outbox write fails', async () => {
    const contactCountBefore = await prisma.contact.count({
      where: { userId },
    });

    jest
      .spyOn(outbox, 'record')
      .mockRejectedValueOnce(new Error('simulated outbox failure'));

    await expect(
      contactsService.create(userId, { name: 'Should Not Persist' }),
    ).rejects.toThrow('simulated outbox failure');

    const contactCountAfter = await prisma.contact.count({ where: { userId } });
    expect(contactCountAfter).toBe(contactCountBefore);

    const leaked = await prisma.contact.findFirst({
      where: { name: 'Should Not Persist' },
    });
    expect(leaked).toBeNull();
  });
});
