import { describe, expect, it } from 'vitest';

import { ProviderError } from '../../errors';
import { CLIResponseParser } from '../cli-response-parser';

describe('CLIResponseParser', () => {
  describe('parse', () => {
    it('should parse plain text responses', () => {
      const result = CLIResponseParser.parse('feat: add new feature');

      expect(result).toBe('feat: add new feature');
    });

    it('should parse JSON responses with content field', () => {
      const json = '{"content": "feat: add new feature"}';
      const result = CLIResponseParser.parse(json);

      expect(result).toBe('feat: add new feature');
    });

    it('should parse JSON responses with message field', () => {
      const json = '{"message": "fix: bug fix"}';
      const result = CLIResponseParser.parse(json);

      expect(result).toBe('fix: bug fix');
    });

    it('should parse JSON responses with text field', () => {
      const json = '{"text": "docs: update readme"}';
      const result = CLIResponseParser.parse(json);

      expect(result).toBe('docs: update readme');
    });

    it('should trim whitespace by default', () => {
      const result = CLIResponseParser.parse('  feat: add feature  \n');

      expect(result).toBe('feat: add feature');
    });

    it('should not trim whitespace when disabled', () => {
      const result = CLIResponseParser.parse('  feat: add feature  ', { trimWhitespace: false });

      expect(result).toBe('  feat: add feature  ');
    });

    it('should reject empty responses by default', () => {
      expect(() => CLIResponseParser.parse('')).toThrow(ProviderError);
      expect(() => CLIResponseParser.parse('   ')).toThrow(ProviderError);
    });

    it('should allow empty responses when configured', () => {
      const result = CLIResponseParser.parse('', { allowEmpty: true });

      expect(result).toBe('');
    });

    it('should validate commit message format', () => {
      expect(() => CLIResponseParser.parse('x')).toThrow(ProviderError);
      expect(() => CLIResponseParser.parse('abc')).toThrow(ProviderError);
    });

    it('should accept valid commit messages', () => {
      expect(CLIResponseParser.parse('feat: add feature')).toBeTruthy();
      expect(CLIResponseParser.parse('fix: bug fix')).toBeTruthy();
      expect(CLIResponseParser.parse('Add new feature')).toBeTruthy();
    });

    it('should prefer JSON parsing when output starts with {', () => {
      const json = '{"content": "feat: from json"}';
      const result = CLIResponseParser.parse(json);

      expect(result).toBe('feat: from json');
    });

    it('should fall back to plain text if JSON parsing fails', () => {
      const notJson = '{ not valid json';
      const result = CLIResponseParser.parse(notJson);

      expect(result).toBe('{ not valid json');
    });

    it('should use expectJSON option', () => {
      const json = '{"content": "feat: test"}';
      const result = CLIResponseParser.parse(json, { expectJSON: true });

      expect(result).toBe('feat: test');
    });
  });

  describe('parseJSON', () => {
    it('should extract content from JSON with content field', () => {
      const result = CLIResponseParser.parseJSON('{"content": "test message"}');

      expect(result).toBe('test message');
    });

    it('should extract content from JSON with message field', () => {
      const result = CLIResponseParser.parseJSON('{"message": "test message"}');

      expect(result).toBe('test message');
    });

    it('should extract content from JSON with text field', () => {
      const result = CLIResponseParser.parseJSON('{"text": "test message"}');

      expect(result).toBe('test message');
    });

    it('should handle plain string JSON', () => {
      const result = CLIResponseParser.parseJSON('"plain string"');

      expect(result).toBe('plain string');
    });

    it('should return null for non-JSON', () => {
      const result = CLIResponseParser.parseJSON('not json');

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const result = CLIResponseParser.parseJSON('{"incomplete":');

      expect(result).toBeNull();
    });

    it('should return null for JSON without recognized fields', () => {
      const result = CLIResponseParser.parseJSON('{"other": "field"}');

      expect(result).toBeNull();
    });

    it('should handle JSON with extra whitespace', () => {
      const result = CLIResponseParser.parseJSON('  {"content": "test"}  ');

      expect(result).toBe('test');
    });

    it('should handle nested JSON', () => {
      const result = CLIResponseParser.parseJSON(
        '{"data": {"content": "ignored"}, "content": "used"}',
      );

      expect(result).toBe('used');
    });
  });

  describe('parsePlainText', () => {
    it('should clean and return text', () => {
      const result = CLIResponseParser.parsePlainText('test message');

      expect(result).toBe('test message');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = CLIResponseParser.parsePlainText('  test message  \n');

      expect(result).toBe('test message');
    });

    it('should preserve internal formatting', () => {
      const result = CLIResponseParser.parsePlainText('line 1\n\nline 2');

      expect(result).toBe('line 1\n\nline 2');
    });

    it('should remove code block markers', () => {
      const result = CLIResponseParser.parsePlainText('```\ntest message\n```');

      expect(result).toBe('test message');
    });

    it('should normalize line endings', () => {
      const result = CLIResponseParser.parsePlainText('line 1\r\nline 2\r\n');

      expect(result).toBe('line 1\nline 2');
    });

    it('should handle empty input', () => {
      const result = CLIResponseParser.parsePlainText('');

      expect(result).toBe('');
    });

    it('should handle whitespace-only input', () => {
      const result = CLIResponseParser.parsePlainText('   \n  \n  ');

      expect(result).toBe('');
    });
  });

  describe('validateCommitMessage', () => {
    it('should accept valid commit messages', () => {
      expect(CLIResponseParser.validateCommitMessage('feat: add feature')).toBe(true);
      expect(CLIResponseParser.validateCommitMessage('fix: bug fix')).toBe(true);
      expect(CLIResponseParser.validateCommitMessage('Add new feature')).toBe(true);
      expect(CLIResponseParser.validateCommitMessage('Update documentation')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(CLIResponseParser.validateCommitMessage('')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('   ')).toBe(false);
    });

    it('should reject messages that are too short', () => {
      expect(CLIResponseParser.validateCommitMessage('x')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('ab')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('abc')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('abcd')).toBe(false);
    });

    it('should accept messages at minimum length', () => {
      expect(CLIResponseParser.validateCommitMessage('fix x')).toBe(true);
      expect(CLIResponseParser.validateCommitMessage('12345')).toBe(true);
    });

    it('should reject whitespace-only messages', () => {
      expect(CLIResponseParser.validateCommitMessage('     ')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('\n\n\n')).toBe(false);
    });

    it('should reject messages with only special characters', () => {
      expect(CLIResponseParser.validateCommitMessage('!!!')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('---')).toBe(false);
      expect(CLIResponseParser.validateCommitMessage('...')).toBe(false);
    });

    it('should accept messages with mixed content', () => {
      expect(CLIResponseParser.validateCommitMessage('feat: add feature!')).toBe(true);
      expect(CLIResponseParser.validateCommitMessage('fix(api): bug')).toBe(true);
    });
  });

  describe('cleanAIArtifacts', () => {
    it('should remove "here\'s a commit message" preamble', () => {
      const result = CLIResponseParser.cleanAIArtifacts(
        "Here's a commit message:\nfeat: add feature",
      );

      expect(result).toBe('feat: add feature');
    });

    it('should remove "based on git diff" preamble', () => {
      const result = CLIResponseParser.cleanAIArtifacts('Based on the git diff\nfeat: add feature');

      expect(result).toBe('feat: add feature');
    });

    it('should remove "looking at changes" preamble', () => {
      const result = CLIResponseParser.cleanAIArtifacts(
        'Looking at the changes\nfeat: add feature',
      );

      expect(result).toBe('feat: add feature');
    });

    it('should remove "analyzing changes" preamble', () => {
      const result = CLIResponseParser.cleanAIArtifacts('Analyzing the changes\nfeat: add feature');

      expect(result).toBe('feat: add feature');
    });

    it('should extract content between sentinel markers', () => {
      const input =
        'Some text\n<<<COMMIT_MESSAGE_START>>>feat: add feature<<<COMMIT_MESSAGE_END>>>\nMore text';
      const result = CLIResponseParser.cleanAIArtifacts(input);

      expect(result).toBe('feat: add feature');
    });

    it('should handle missing end marker', () => {
      const input = 'Some text\n<<<COMMIT_MESSAGE_START>>>feat: add feature';
      const result = CLIResponseParser.cleanAIArtifacts(input);

      expect(result).toBe('Some text\n<<<COMMIT_MESSAGE_START>>>feat: add feature');
    });

    it('should handle missing start marker', () => {
      const input = 'feat: add feature<<<COMMIT_MESSAGE_END>>>More text';
      const result = CLIResponseParser.cleanAIArtifacts(input);

      expect(result).toBe('feat: add feature<<<COMMIT_MESSAGE_END>>>More text');
    });

    it('should preserve message when no artifacts present', () => {
      const result = CLIResponseParser.cleanAIArtifacts('feat: add feature');

      expect(result).toBe('feat: add feature');
    });

    it('should handle multiple preamble patterns', () => {
      const input = "Here's a commit message:\nBased on the git diff\nfeat: add feature";
      const result = CLIResponseParser.cleanAIArtifacts(input);

      expect(result).toBe('feat: add feature');
    });

    it('should trim result', () => {
      const result = CLIResponseParser.cleanAIArtifacts('  feat: add feature  ');

      expect(result).toBe('feat: add feature');
    });
  });
});
