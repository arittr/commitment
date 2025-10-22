import { describe, expect, it } from 'vitest';

import {
  hasContent,
  hasProperty,
  isArrayOf,
  isDefined,
  isError,
  isFilePath,
  isNonEmptyArray,
  isNumber,
  isObject,
  isString,
} from '../guards';

describe('Type Guards', () => {
  describe('hasContent', () => {
    it('should return true for non-empty strings', () => {
      expect(hasContent('hello')).toBe(true);
      expect(hasContent('  content  ')).toBe(true);
      expect(hasContent('a')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(hasContent('')).toBe(false);
      expect(hasContent('   ')).toBe(false);
      expect(hasContent('\t\n')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(hasContent(null)).toBe(false);
      expect(hasContent(undefined)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const value: string | null = 'test';
      if (hasContent(value)) {
        // TypeScript should allow string methods
        const upper: string = value.toUpperCase();
        expect(upper).toBe('TEST');
      }
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a', 'b'])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('should work with readonly arrays', () => {
      const readonlyArray: readonly number[] = [1, 2, 3];
      expect(isNonEmptyArray(readonlyArray)).toBe(true);

      const emptyReadonly: readonly number[] = [];
      expect(isNonEmptyArray(emptyReadonly)).toBe(false);
    });

    it('should narrow type to tuple with at least one element', () => {
      const array: string[] = ['first', 'second'];
      if (isNonEmptyArray(array)) {
        // TypeScript should know first element exists
        const first: string = array[0];
        expect(first).toBe('first');
      }
    });

    it('should preserve type information', () => {
      const numbers: number[] = [1, 2, 3];
      if (isNonEmptyArray(numbers)) {
        const first: number = numbers[0];
        expect(typeof first).toBe('number');
      }
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined('string')).toBe(true);
    });

    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const value: string | null | undefined = 'test';
      if (isDefined(value)) {
        // TypeScript should allow string methods
        const { length } = value;
        expect(length).toBe(4);
      }
    });

    it('should work with optional values', () => {
      const optional: number | undefined = 42;
      if (isDefined(optional)) {
        const doubled: number = optional * 2;
        expect(doubled).toBe(84);
      }
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
      expect(isObject({ nested: { object: true } })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it('should return true for class instances', () => {
      class MyClass {}
      expect(isObject(new MyClass())).toBe(true);
      expect(isObject(new Date())).toBe(true);
    });

    it('should narrow type correctly', () => {
      const data: unknown = { name: 'test' };
      if (isObject(data)) {
        // TypeScript should allow object operations
        const keys: string[] = Object.keys(data);
        expect(keys).toContain('name');
      }
    });
  });

  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('type error'))).toBe(true);
      expect(isError(new RangeError('range error'))).toBe(true);
    });

    it('should return false for non-Error objects', () => {
      expect(isError({})).toBe(false);
      expect(isError({ message: 'fake error' })).toBe(false);
      expect(isError('error string')).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const error: unknown = new Error('test error');
      if (isError(error)) {
        // TypeScript should allow Error properties
        const { message } = error;
        const { stack } = error;
        expect(message).toBe('test error');
        expect(stack).toBeDefined();
      }
    });

    it('should work in catch blocks', () => {
      try {
        throw new Error('caught error');
      } catch (error: unknown) {
        if (isError(error)) {
          expect(error.message).toBe('caught error');
        } else {
          throw new Error('Should have been an Error');
        }
      }
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
      expect(isString('123')).toBe(true);
      expect(isString(String('test'))).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString({})).toBe(false);
    });

    it('should narrow type correctly', () => {
      const data: unknown = 'test string';
      if (isString(data)) {
        // TypeScript should allow string methods
        const upper: string = data.toUpperCase();
        const { length } = data;
        expect(upper).toBe('TEST STRING');
        expect(length).toBe(11);
      }
    });
  });

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(Number.POSITIVE_INFINITY)).toBe(true);
      expect(isNumber(Number.NEGATIVE_INFINITY)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(Number.NaN)).toBe(false);
      expect(isNumber(0 / 0)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(true)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber([])).toBe(false);
      expect(isNumber({})).toBe(false);
    });

    it('should narrow type correctly', () => {
      const data: unknown = 42;
      if (isNumber(data)) {
        // TypeScript should allow number methods
        const fixed: string = data.toFixed(2);
        const doubled: number = data * 2;
        expect(fixed).toBe('42.00');
        expect(doubled).toBe(84);
      }
    });
  });

  describe('isFilePath', () => {
    it('should return true for valid file paths', () => {
      expect(isFilePath('/path/to/file.txt')).toBe(true);
      expect(isFilePath('./relative/path.js')).toBe(true);
      expect(isFilePath('../parent/file.ts')).toBe(true);
      expect(isFilePath('simple-file.txt')).toBe(true);
      expect(isFilePath('/usr/bin/node')).toBe(true);
      expect(isFilePath('C:\\Windows\\System32\\file.dll')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isFilePath('')).toBe(false);
      expect(isFilePath('   ')).toBe(false);
      expect(isFilePath('\t\n')).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isFilePath(null)).toBe(false);
      expect(isFilePath(undefined)).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isFilePath(123)).toBe(false);
      expect(isFilePath({})).toBe(false);
      expect(isFilePath([])).toBe(false);
    });

    it('should return false for paths with null bytes', () => {
      expect(isFilePath('/path/to/file\0.txt')).toBe(false);
      expect(isFilePath('test\0')).toBe(false);
    });

    it('should return false for only dots', () => {
      expect(isFilePath('.')).toBe(false);
      expect(isFilePath('..')).toBe(false);
    });

    it('should narrow type correctly', () => {
      const path: unknown = '/etc/hosts';
      if (isFilePath(path)) {
        // TypeScript should know this is a string
        const upper: string = path.toUpperCase();
        expect(upper).toBe('/ETC/HOSTS');
      }
    });
  });

  describe('hasProperty', () => {
    it('should return true when object has property', () => {
      expect(hasProperty({ name: 'test' }, 'name')).toBe(true);
      expect(hasProperty({ count: 0 }, 'count')).toBe(true);
      expect(hasProperty({ nested: { value: 1 } }, 'nested')).toBe(true);
    });

    it('should return false when object does not have property', () => {
      expect(hasProperty({}, 'missing')).toBe(false);
      expect(hasProperty({ name: 'test' }, 'other')).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasProperty(null, 'key')).toBe(false);
      expect(hasProperty(undefined, 'key')).toBe(false);
      expect(hasProperty('string', 'key')).toBe(false);
      expect(hasProperty(123, 'key')).toBe(false);
      expect(hasProperty([], 'key')).toBe(false);
    });

    it('should work with symbol properties', () => {
      const sym = Symbol('test');
      const object = { [sym]: 'value' };
      expect(hasProperty(object, sym)).toBe(true);
    });

    it('should work with number properties', () => {
      const object = { 0: 'zero', 1: 'one' };
      expect(hasProperty(object, 0)).toBe(true);
      expect(hasProperty(object, 1)).toBe(true);
    });

    it('should narrow type correctly', () => {
      const data: unknown = { age: 30, name: 'test' };
      if (hasProperty(data, 'name')) {
        // TypeScript should allow accessing the property
        const value: unknown = data.name;
        expect(value).toBe('test');
      }
    });

    it('should work with multiple checks', () => {
      const data: unknown = { age: 30, name: 'test' };
      if (hasProperty(data, 'name') && hasProperty(data, 'age')) {
        expect(data.name).toBe('test');
        expect(data.age).toBe(30);
      }
    });
  });

  describe('isArrayOf', () => {
    it('should return true for array of matching type', () => {
      expect(isArrayOf(['a', 'b', 'c'], isString)).toBe(true);
      expect(isArrayOf([1, 2, 3], isNumber)).toBe(true);
      expect(isArrayOf([{}, { key: 'value' }], isObject)).toBe(true);
    });

    it('should return true for empty arrays', () => {
      expect(isArrayOf([], isString)).toBe(true);
      expect(isArrayOf([], isNumber)).toBe(true);
    });

    it('should return false for mixed type arrays', () => {
      expect(isArrayOf(['a', 1, 'b'], isString)).toBe(false);
      expect(isArrayOf([1, '2', 3], isNumber)).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isArrayOf('not an array', isString)).toBe(false);
      expect(isArrayOf({ 0: 'a', 1: 'b' }, isString)).toBe(false);
      expect(isArrayOf(null, isString)).toBe(false);
    });

    it('should work with custom guards', () => {
      type User = {
        name: string;
      };
      const isUser = (value: unknown): value is User => {
        return isObject(value) && hasProperty(value, 'name') && isString(value.name);
      };

      const users = [{ name: 'Alice' }, { name: 'Bob' }];
      expect(isArrayOf(users, isUser)).toBe(true);

      const invalid = [{ name: 'Alice' }, { age: 30 }];
      expect(isArrayOf(invalid, isUser)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const data: unknown = ['a', 'b', 'c'];
      if (isArrayOf(data, isString)) {
        // TypeScript should know this is string[]
        const upper: string[] = data.map((s) => s.toUpperCase());
        expect(upper).toEqual(['A', 'B', 'C']);
      }
    });

    it('should work with nested guards', () => {
      const data: unknown = [
        [1, 2],
        [3, 4],
      ];
      if (isArrayOf(data, (item): item is number[] => isArrayOf(item, isNumber))) {
        // TypeScript should know this is number[][]
        const flattened: number[] = data.flat();
        expect(flattened).toEqual([1, 2, 3, 4]);
      }
    });
  });

  describe('Type narrowing integration', () => {
    it('should work with multiple guards together', () => {
      const data: unknown = { items: ['a', 'b', 'c'] };

      if (isObject(data) && hasProperty(data, 'items') && isArrayOf(data.items, isString)) {
        // TypeScript should infer correct types
        const first = data.items[0];
        if (isDefined(first)) {
          const upper: string = first.toUpperCase();
          expect(upper).toBe('A');
        }
      }
    });

    it('should enable safe array access', () => {
      const array: string[] = ['hello', 'world'];

      if (isNonEmptyArray(array)) {
        // First element is guaranteed to exist
        const first: string = array[0];
        expect(first).toBe('hello');
      }
    });

    it('should enable safe optional chaining alternatives', () => {
      const value: string | null | undefined = 'test';

      if (isDefined(value) && hasContent(value)) {
        // Both checks passed, safe to use
        expect(value.toUpperCase()).toBe('TEST');
      }
    });
  });
});
