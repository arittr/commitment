import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderConfig } from '../../providers/index';

import { buildProviderChain } from '../provider-config-builder';

describe('buildProviderChain', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  it('should return undefined when no fallback providers specified', () => {
    const result = buildProviderChain(undefined, undefined);

    expect(result).toBeUndefined();
  });

  it('should return undefined when fallback array is empty', () => {
    const result = buildProviderChain(undefined, []);

    expect(result).toBeUndefined();
  });

  it('should build chain with main provider and fallbacks', () => {
    const mainProvider: ProviderConfig = {
      type: 'cli',
      provider: 'claude',
      timeout: 60_000,
    };

    const result = buildProviderChain(mainProvider, ['claude']);

    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual(mainProvider);
    expect(result?.[1]).toEqual({
      type: 'cli',
      provider: 'claude',
    });
  });

  it('should build chain with only fallback providers when no main provider', () => {
    const result = buildProviderChain(undefined, ['claude']);

    expect(result).toHaveLength(1);
    expect(result?.[0]).toEqual({
      type: 'cli',
      provider: 'claude',
    });
  });

  it('should build chain with multiple fallback providers', () => {
    const result = buildProviderChain(undefined, ['claude', 'claude']);

    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({
      type: 'cli',
      provider: 'claude',
    });
    expect(result?.[1]).toEqual({
      type: 'cli',
      provider: 'claude',
    });
  });

  it('should exit when fallback provider is not implemented', () => {
    expect(() => buildProviderChain(undefined, ['openai'])).toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fallback provider 'openai' is not yet implemented"),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should be case-insensitive for fallback provider names', () => {
    const result = buildProviderChain(undefined, ['CLAUDE', 'Claude']);

    expect(result).toHaveLength(2);
    expect(result?.[0]?.provider).toBe('claude');
    expect(result?.[1]?.provider).toBe('claude');
  });

  it('should display provider chain when built successfully', () => {
    const mainProvider: ProviderConfig = {
      type: 'cli',
      provider: 'claude',
    };

    buildProviderChain(mainProvider, ['claude']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Provider fallback chain: claude → claude'),
    );
  });

  it('should handle mixed case provider names in error messages', () => {
    expect(() => buildProviderChain(undefined, ['CoDex'])).toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Fallback provider 'codex' is not yet implemented"),
    );
  });

  it('should build correct chain with main provider and multiple fallbacks', () => {
    const mainProvider: ProviderConfig = {
      type: 'cli',
      provider: 'claude',
      command: 'custom-claude',
    };

    const result = buildProviderChain(mainProvider, ['claude', 'claude']);

    expect(result).toHaveLength(3);
    expect(result?.[0]).toEqual(mainProvider);
    expect(result?.[1]?.provider).toBe('claude');
    expect(result?.[2]?.provider).toBe('claude');
  });
});
