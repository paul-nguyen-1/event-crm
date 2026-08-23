import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class OutboxService {
  /**
   * Writes a domain event row. Must be called with a transaction client so the
   * caller's business write and this row commit or roll back together.
   */
  async record(
    tx: Prisma.TransactionClient,
    type: string,
    payload: Record<string, unknown>,
  ) {
    await tx.domainEvent.create({
      data: { type, payload: payload as Prisma.InputJsonValue },
    });
  }
}
