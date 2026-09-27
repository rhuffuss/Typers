import { Injectable, Logger } from '@nestjs/common';
import {
  Command,
  CommandHandler,
  EventsHandler,
  Query,
  QueryHandler,
  Saga,
  ofType,
} from '@nestjs/cqrs';
import type {
  ICommandHandler,
  IEventHandler,
  IQueryHandler,
  IEvent,
} from '@nestjs/cqrs';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

export class RecordActivityCommand extends Command<number> {
  constructor(public readonly message: string) {
    super();
  }
}

export class ReadActivityQuery extends Query<readonly string[]> {}

export class ActivityRequestedEvent {
  constructor(public readonly message: string) {}
}

@Injectable()
export class ActivityLog {
  readonly messages: string[] = [];
  ticks = 0;
  readonly logger = new Logger(ActivityLog.name);

  @OnEvent('demo.activity')
  onActivity(message: string) {
    this.messages.push(message);
  }

  @Interval('activity-heartbeat', 60_000)
  heartbeat() {
    this.ticks++;
  }
}

@CommandHandler(RecordActivityCommand)
export class RecordActivityHandler implements ICommandHandler<RecordActivityCommand> {
  constructor(
    private readonly events: EventEmitter2,
    private readonly log: ActivityLog,
  ) {}

  async execute(command: RecordActivityCommand) {
    await this.events.emitAsync('demo.activity', command.message);
    return this.log.messages.length;
  }
}

@QueryHandler(ReadActivityQuery)
export class ReadActivityHandler implements IQueryHandler<ReadActivityQuery> {
  constructor(private readonly log: ActivityLog) {}
  async execute() {
    return [...this.log.messages];
  }
}

@EventsHandler(ActivityRequestedEvent)
export class ActivityRequestedHandler implements IEventHandler<ActivityRequestedEvent> {
  constructor(private readonly log: ActivityLog) {}
  handle(event: ActivityRequestedEvent) {
    this.log.logger.debug(`Activity requested: ${event.message}`);
  }
}

@Injectable()
export class ActivitySagas {
  @Saga()
  activity = (events: Observable<IEvent>) =>
    events.pipe(
      ofType(ActivityRequestedEvent),
      map((event) => new RecordActivityCommand(event.message)),
    );
}
