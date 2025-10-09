import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listProvidersCommand } from '../list-providers';

describe('listProvidersCommand', () => {
  // Mock console.log and process.exit
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  it('should display list of providers', () => {
    expect(() => {
      listProvidersCommand();
    }).toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Available AI Providers'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('claude'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('codex'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('openai'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('cursor'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('gemini'));
  });

  it('should show example usage', () => {
    expect(() => {
      listProvidersCommand();
    }).toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Example usage: commitment --provider claude'),
    );
  });

  it('should exit with code 0', () => {
    expect(() => {
      listProvidersCommand();
    }).toThrow('process.exit called');

    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should indicate which providers are not yet implemented', () => {
    expect(() => {
      listProvidersCommand();
    }).toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('not yet implemented'));
  });

  it('should indicate Claude as default', () => {
    expect(() => {
      listProvidersCommand();
    }).toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('default'));
  });
});
