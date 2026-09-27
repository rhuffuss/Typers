import {
  ConfigurableModuleBuilder,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';

export interface DemoSettings {
  readonly label: string;
  readonly mode: 'demo';
}

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<DemoSettings>()
    .setClassMethodName('forRoot')
    .build();

@Injectable()
export class DemoSettingsService {
  constructor(@Inject(MODULE_OPTIONS_TOKEN) readonly options: DemoSettings) {}
}

@Module({ providers: [DemoSettingsService], exports: [DemoSettingsService] })
export class DemoSettingsModule extends ConfigurableModuleClass {}
