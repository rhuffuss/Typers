import { forwardRef, Inject, Injectable, Module } from '@nestjs/common';

const FIRST_PEER = Symbol('fundamentals.first-peer');
const SECOND_PEER = Symbol('fundamentals.second-peer');

interface Peer {
  readonly name: string;
  readonly peer: Peer;
}

// The interfaces emit Object metadata, so ESM never reads a not-yet-defined
// class. The explicit tokens and forwardRef resolve the actual Nest DI cycle.
@Injectable()
class FirstPeer implements Peer {
  readonly name = 'first';

  constructor(@Inject(forwardRef(() => SECOND_PEER)) readonly peer: Peer) {}
}

@Injectable()
class SecondPeer implements Peer {
  readonly name = 'second';

  constructor(@Inject(forwardRef(() => FIRST_PEER)) readonly peer: Peer) {}
}

@Injectable()
export class CircularDemoService {
  constructor(
    @Inject(FIRST_PEER) private readonly first: Peer,
    @Inject(SECOND_PEER) private readonly second: Peer,
  ) {}

  inspect() {
    return {
      peers: [this.first.name, this.second.name],
      firstPointsToSecond: this.first.peer === this.second,
      secondPointsToFirst: this.second.peer === this.first,
      roundTripPreservesIdentity: this.first.peer.peer === this.first,
    };
  }
}

@Module({
  providers: [
    { provide: FIRST_PEER, useClass: FirstPeer },
    { provide: SECOND_PEER, useClass: SecondPeer },
    CircularDemoService,
  ],
  exports: [CircularDemoService],
})
export class CircularDemoModule {}
