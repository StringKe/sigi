import { rootInjector } from './root-injector'
import { Type, InjectionToken, Provider, Token, ValueProvider } from './type'
import { Injector } from './injector'

export class Test<M extends AbstractTestModule> {
  static createTestingModule<M extends AbstractTestModule>(overrideConfig?: {
    TestModule?: Type<M>
    providers?: Provider[]
  }) {
    return new Test<M>(
      overrideConfig && overrideConfig.providers ? overrideConfig.providers : [],
      overrideConfig && overrideConfig.TestModule ? overrideConfig.TestModule : (TestModule as any),
    )
  }

  readonly providersMap = new Map<Token<unknown>, Provider>()

  private constructor(providers: Provider[], private TestModule: Type<M>) {
    for (const provier of providers) {
      this.providersMap.set((provier as ValueProvider<unknown>).provide ?? provier, provier)
    }
  }

  overrideProvider<T>(token: Token<T>): MockProvider<T, M> {
    return new MockProvider(this, token)
  }

  compile() {
    const childInjector = rootInjector.createChild(Array.from(this.providersMap.values()))
    return new this.TestModule(childInjector)
  }
}

export class MockProvider<T, M extends AbstractTestModule> {
  constructor(private test: Test<M>, private token: Type<T> | InjectionToken<T>) {}

  useClass(value: Type<T>) {
    this.test.providersMap.set(this.token, { provide: this.token, useClass: value })
    return this.test
  }

  useValue(value: T) {
    this.test.providersMap.set(this.token, { provide: this.token, useValue: value })
    return this.test
  }

  useFactory(value: (...args: any[]) => any) {
    this.test.providersMap.set(this.token, { provide: this.token, useFactory: value })
    return this.test
  }
}

export abstract class AbstractTestModule {
  abstract getInstance<T>(provider: Provider<T>): T
}

export class TestModule implements AbstractTestModule {
  constructor(private injector: Injector) {}

  getInstance<T>(token: Provider<T>): T {
    return this.injector.getInstance(token)
  }
}
