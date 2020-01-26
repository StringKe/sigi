import {
  Provider,
  ValueProvider,
  ClassProvider,
  FactoryProvider,
  ExistingProvider,
  Token,
  Type,
  InjectionToken,
} from './type'
import { ReflectiveProvider } from './injector-provider'
import { InjectionProvider } from './provider'

export class Injector {
  readonly provider = new InjectionProvider()

  protected readonly resolvedProviders = new Map<ReflectiveProvider<unknown>, unknown>()
  protected readonly providersCache = new Map<Provider, ReflectiveProvider<unknown>>()

  constructor(protected readonly parent: Injector | null = null) {}

  addProvider<T extends Provider<any>>(provider: T): T {
    return this.provider.addProvider(provider)
  }

  addProviders(providers: Provider[]) {
    for (const provider of providers) {
      this.provider.addProvider(provider)
    }
    return this
  }

  getInstance<T>(provider: Provider<T>): T {
    return this._getInstance(provider, true)
  }

  resolveAndInstantiate<T>(provider: Provider<T>): T {
    return this._getInstance(provider, false)
  }

  createChild(providers: Provider<unknown>[]): Injector {
    const childInjector = new Injector(this)
    childInjector.addProviders(providers)
    return childInjector
  }

  private resolveReflectiveProvider<T>(provider: Provider<T>): ReflectiveProvider<T> | null {
    let reflectiveProvider: ReflectiveProvider<T> | null = null
    if (this.provider.findProviderByToken((provider as ValueProvider<T>).provide ?? provider)) {
      if (this.providersCache.has(provider)) {
        return this.providersCache.get(provider) as ReflectiveProvider<T>
      }
      reflectiveProvider = new ReflectiveProvider(provider)
      this.providersCache.set(provider, reflectiveProvider)
    }
    return reflectiveProvider
  }

  private _getInstance<T>(provider: Provider<T>, useCache: boolean): T {
    let injector: Injector | null = this
    let instance: T | null = null
    let reflectiveProvider: ReflectiveProvider<T> | null = null
    const deps = this._findDeps(provider)
    while (injector) {
      reflectiveProvider = injector.resolveReflectiveProvider(provider)
      if (!reflectiveProvider) {
        injector = injector.parent
        continue
      }
      if (injector.resolvedProviders.has(reflectiveProvider)) {
        if (deps) {
          if (useCache && (injector === this || this._checkDepenciesClean(injector, deps))) {
            instance = injector.resolvedProviders.get(reflectiveProvider) as T
          } else {
            instance = this._resolveByReflectiveProvider(reflectiveProvider, false, this)
            if (useCache) {
              this.resolvedProviders.set(reflectiveProvider, instance)
            }
          }
        } else {
          instance = injector.resolvedProviders.get(reflectiveProvider) as T
        }
        break
      }
      instance = injector._resolveByReflectiveProvider(reflectiveProvider, useCache, this)
      if (instance) {
        if (useCache) {
          injector.resolvedProviders.set(reflectiveProvider!, instance)
        }
        break
      }
      injector = injector.parent
    }
    if (!instance) {
      reflectiveProvider = new ReflectiveProvider(provider)
      throw new TypeError(`No provider for ${reflectiveProvider.name}!`)
    }
    return instance
  }

  private _resolveByReflectiveProvider<T>(
    reflectiveProvider: ReflectiveProvider<T>,
    useCache = true,
    leaf = this,
  ): T | null {
    let instance: T | null = null
    const { provider, name } = reflectiveProvider
    if (typeof provider === 'function') {
      const deps: Array<Type<unknown> | InjectionToken<T>> = Reflect.getMetadata('design:paramtypes', provider) ?? []
      const depsInstance = deps.map((dep) => leaf._getInstance(leaf._findExisting(dep), useCache))
      instance = new provider(...depsInstance)
    } else if ((provider as ValueProvider<T>).useValue) {
      instance = (provider as ValueProvider<T>).useValue
    } else if ((provider as ClassProvider<T>).useClass) {
      instance = leaf._getInstance((provider as ClassProvider<T>).useClass, useCache)
    } else if ((provider as FactoryProvider<T>).useFactory) {
      let deps: unknown[] = []
      if ((provider as FactoryProvider<T>).deps) {
        deps = (provider as FactoryProvider<T>).deps!.map((dep) => leaf._getInstance(leaf._findExisting(dep), useCache))
      }
      instance = (provider as FactoryProvider<T>).useFactory(...deps)
    } else if ((provider as ExistingProvider<T>).useExisting) {
      instance = leaf._getInstance(this._findExisting((provider as ExistingProvider<T>).useExisting)!, useCache)
    }
    if (!instance) {
      throw new TypeError(`Can not resolve ${name}, it's not a valid provider`)
    }
    return instance
  }

  private _findExisting<T>(token: Token<T>): Provider<T> {
    let provider: Provider<T> | null = null
    let injector: Injector | null = this
    while (injector) {
      provider = injector.provider.findProviderByToken(token)
      if (provider) {
        break
      }
      injector = injector.parent
    }

    if (!provider) {
      throw new TypeError(`No provider for ${(token as Type<T>).name ?? token.toString()}`)
    }
    return provider
  }

  private _findDeps<T>(provider: Provider<T>): Token<unknown>[] {
    return typeof provider === 'function'
      ? Reflect.getMetadata('design:paramtypes', provider)
      : (provider as ClassProvider<T>).useClass
      ? Reflect.getMetadata('design:paramtypes', (provider as ClassProvider<T>).useClass)
      : (provider as FactoryProvider<T>).deps
      ? (provider as FactoryProvider<T>).deps
      : null
  }

  private _checkDepenciesClean(leaf: Injector, deps: Token<unknown>[]): boolean {
    return deps.every((dep) => {
      const depInLeaf = leaf._findExisting(dep)
      const depInRoot = this._findExisting(dep)
      const isEqual = depInLeaf === depInRoot
      const deps = this._findDeps(depInLeaf)
      if (deps) {
        return this._checkDepenciesClean(leaf, deps) && isEqual
      }
      return isEqual
    })
  }
}
