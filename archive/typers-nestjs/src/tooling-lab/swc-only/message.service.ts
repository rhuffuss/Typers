import { Injectable } from '@nestjs/common';

export const BUILD_MESSAGE = 'swc-initial';

@Injectable()
export class BuildMessageService {
  value() {
    return BUILD_MESSAGE;
  }
}
