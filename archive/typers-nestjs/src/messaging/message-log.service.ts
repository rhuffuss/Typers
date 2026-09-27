import { Injectable } from '@nestjs/common';

export interface ReceivedMessage {
  readonly id: string;
  readonly value: string;
  readonly transport: string;
  readonly acknowledged: boolean;
}

@Injectable()
export class MessageLogService {
  private readonly messages = new Map<string, ReceivedMessage>();

  record(message: ReceivedMessage): void {
    this.messages.set(message.id, message);
    if (this.messages.size > 100)
      this.messages.delete(this.messages.keys().next().value!);
  }

  get(id: string): ReceivedMessage | undefined {
    return this.messages.get(id);
  }

  list(): readonly ReceivedMessage[] {
    return [...this.messages.values()];
  }
}
