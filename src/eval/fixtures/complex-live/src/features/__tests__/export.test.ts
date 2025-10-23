import { describe, expect, it } from 'vitest';
import { Exporter } from '../export.ts';

describe('Exporter', () => {
  it('exports to JSON', async () => {
    const exporter = new Exporter();
    const result = await exporter.exportToJSON({ foo: 'bar' });
    expect(result).toBe('{\n  "foo": "bar"\n}');
  });

  it('handles empty objects', async () => {
    const exporter = new Exporter();
    const result = await exporter.exportToJSON({});
    expect(result).toBe('{}');
  });
});
