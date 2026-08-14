import type { Provider, ProviderMetadata } from "./types.js";
import { openRouterProvider } from "./openrouter.js";
import { groqProvider } from "./groq.js";
import { nvidiaProvider } from "./nvidia.js";

/**
 * ProviderRegistry maps a provider id to a Provider implementation.
 * Adding a provider = create a file exporting a Provider and register it here.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): this {
    this.providers.set(provider.metadata.id, provider);
    return this;
  }

  registerAll(providers: Provider[]): this {
    for (const provider of providers) this.register(provider);
    return this;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  get(id: string): Provider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list(): ProviderMetadata[] {
    return Array.from(this.providers.values()).map((p) => p.metadata);
  }
}

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry().registerAll([openRouterProvider, groqProvider, nvidiaProvider]);
}
