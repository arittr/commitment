import { describe, expect, it } from 'bun:test';
import { cleanAIResponse, isCLINotFoundError, validateConventionalCommit } from '../agent-utils.js';

describe('cleanAIResponse', () => {
  describe('markdown code blocks', () => {
    it('should remove markdown code blocks', () => {
      const input = '```\nfeat: add feature\n\nDescription here\n```';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature\n\nDescription here');
    });

    it('should remove code blocks with language specifier', () => {
      const input = '```typescript\nfeat: add feature\n```';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should remove multiple code blocks', () => {
      const input = '```\nfirst block\n```\ntext\n```\nsecond block\n```';
      const result = cleanAIResponse(input);
      // Code block delimiters removed but content preserved
      expect(result).toBe('first block\n\ntext\nsecond block');
    });

    it('should handle nested backticks inside code blocks', () => {
      const input = '```\ncode with ` backtick\n```';
      const result = cleanAIResponse(input);
      expect(result).toBe('code with ` backtick');
    });
  });

  describe('thinking tags', () => {
    it('should remove <thinking> tags with content', () => {
      const input = '<thinking>analyzing changes...</thinking>\nfeat: add feature';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should remove "thinking:" prefix lines', () => {
      const input = 'thinking: let me analyze this\n\nfeat: add feature';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should remove unclosed thinking tags', () => {
      const input = '<thinking>analyzing...\nfeat: add feature';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should be case-insensitive for thinking prefix', () => {
      const input = 'THINKING: analyzing\nfeat: add feature';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should handle thinking at start of line only', () => {
      const input = 'feat: thinking about this implementation';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: thinking about this implementation');
    });
  });

  describe('excessive newlines', () => {
    it('should normalize 3 newlines to 2', () => {
      const input = 'line1\n\n\nline2';
      const result = cleanAIResponse(input);
      expect(result).toBe('line1\n\nline2');
    });

    it('should normalize many newlines to 2', () => {
      const input = 'line1\n\n\n\n\n\nline2';
      const result = cleanAIResponse(input);
      expect(result).toBe('line1\n\nline2');
    });

    it('should preserve single newlines', () => {
      const input = 'line1\nline2';
      const result = cleanAIResponse(input);
      expect(result).toBe('line1\nline2');
    });

    it('should preserve double newlines', () => {
      const input = 'line1\n\nline2';
      const result = cleanAIResponse(input);
      expect(result).toBe('line1\n\nline2');
    });
  });

  describe('whitespace trimming', () => {
    it('should trim leading whitespace', () => {
      const input = '   feat: add feature';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should trim trailing whitespace', () => {
      const input = 'feat: add feature   ';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should trim leading and trailing whitespace', () => {
      const input = '   feat: add feature   ';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });

    it('should trim leading and trailing newlines', () => {
      const input = '\n\nfeat: add feature\n\n';
      const result = cleanAIResponse(input);
      expect(result).toBe('feat: add feature');
    });
  });

  describe('combined transformations', () => {
    it('should apply all transformations in order', () => {
      const input = `
<thinking>analyzing the changes...</thinking>

\`\`\`
feat: add feature

This adds a new feature



with proper description
\`\`\`


`;
      const result = cleanAIResponse(input);
      expect(result).toBe(
        'feat: add feature\n\nThis adds a new feature\n\nwith proper description'
      );
    });

    it('should handle real-world AI response', () => {
      const input = `thinking: Let me analyze the changes

\`\`\`markdown
feat(core): add dark mode toggle

Implement theme switching functionality:
- Add toggle component in settings
- Create theme context provider
- Update existing components for theme support
\`\`\``;
      const result = cleanAIResponse(input);
      expect(result).toBe(
        'feat(core): add dark mode toggle\n\nImplement theme switching functionality:\n- Add toggle component in settings\n- Create theme context provider\n- Update existing components for theme support'
      );
    });

    it('should preserve commit message structure', () => {
      const input =
        'feat: add feature\n\nDetailed description\n\n- Bullet point 1\n- Bullet point 2';
      const result = cleanAIResponse(input);
      expect(result).toBe(
        'feat: add feature\n\nDetailed description\n\n- Bullet point 1\n- Bullet point 2'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = cleanAIResponse('');
      expect(result).toBe('');
    });

    it('should handle string with only whitespace', () => {
      const result = cleanAIResponse('   \n\n   ');
      expect(result).toBe('');
    });

    it('should handle string with only code blocks', () => {
      const input = '```\ncode\n```';
      const result = cleanAIResponse(input);
      expect(result).toBe('code');
    });

    it('should handle string with only thinking tags', () => {
      const input = '<thinking>thinking content</thinking>';
      const result = cleanAIResponse(input);
      expect(result).toBe('');
    });

    it('should not modify already clean output', () => {
      const input = 'feat: add feature\n\nClean description';
      const result = cleanAIResponse(input);
      expect(result).toBe(input);
    });
  });
});

describe('validateConventionalCommit', () => {
  describe('valid formats', () => {
    it('should accept feat type', () => {
      expect(validateConventionalCommit('feat: add feature')).toBe(true);
    });

    it('should accept fix type', () => {
      expect(validateConventionalCommit('fix: resolve bug')).toBe(true);
    });

    it('should accept docs type', () => {
      expect(validateConventionalCommit('docs: update readme')).toBe(true);
    });

    it('should accept style type', () => {
      expect(validateConventionalCommit('style: format code')).toBe(true);
    });

    it('should accept refactor type', () => {
      expect(validateConventionalCommit('refactor: simplify logic')).toBe(true);
    });

    it('should accept test type', () => {
      expect(validateConventionalCommit('test: add unit tests')).toBe(true);
    });

    it('should accept chore type', () => {
      expect(validateConventionalCommit('chore: update deps')).toBe(true);
    });

    it('should accept perf type', () => {
      expect(validateConventionalCommit('perf: optimize query')).toBe(true);
    });

    it('should accept type with scope', () => {
      expect(validateConventionalCommit('feat(core): add feature')).toBe(true);
    });

    it('should accept scope with hyphens', () => {
      expect(validateConventionalCommit('fix(api-client): resolve issue')).toBe(true);
    });

    it('should accept scope with underscores', () => {
      expect(validateConventionalCommit('feat(user_auth): add login')).toBe(true);
    });

    it('should accept multi-word description', () => {
      expect(validateConventionalCommit('feat: add new authentication system')).toBe(true);
    });

    it('should accept description with special characters', () => {
      expect(validateConventionalCommit('fix: resolve issue #123')).toBe(true);
    });
  });

  describe('invalid formats', () => {
    it('should reject invalid type', () => {
      expect(validateConventionalCommit('invalid: message')).toBe(false);
    });

    it('should reject uppercase type', () => {
      expect(validateConventionalCommit('FEAT: add feature')).toBe(false);
    });

    it('should reject mixed case type', () => {
      expect(validateConventionalCommit('Feat: add feature')).toBe(false);
    });

    it('should reject missing colon', () => {
      expect(validateConventionalCommit('feat add feature')).toBe(false);
    });

    it('should reject missing description', () => {
      expect(validateConventionalCommit('feat:')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateConventionalCommit('')).toBe(false);
    });

    it('should reject message without type', () => {
      expect(validateConventionalCommit('add new feature')).toBe(false);
    });

    it('should reject extra space before colon', () => {
      expect(validateConventionalCommit('feat : add feature')).toBe(false);
    });

    it('should reject malformed scope', () => {
      expect(validateConventionalCommit('feat core: add feature')).toBe(false);
    });
  });

  describe('multiline messages', () => {
    it('should validate first line of multiline message', () => {
      const message = 'feat: add feature\n\nDetailed description\n\nMore details';
      expect(validateConventionalCommit(message)).toBe(true);
    });

    it('should reject multiline with invalid first line', () => {
      const message = 'invalid message\n\nDetailed description';
      expect(validateConventionalCommit(message)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept minimal valid message', () => {
      expect(validateConventionalCommit('feat:x')).toBe(true);
    });

    it('should reject message with only whitespace after colon', () => {
      expect(validateConventionalCommit('feat: ')).toBe(false);
    });

    it('should reject message with only scope', () => {
      expect(validateConventionalCommit('(scope): description')).toBe(false);
    });

    it('should accept long description', () => {
      const longDesc = 'a'.repeat(1000);
      expect(validateConventionalCommit(`feat: ${longDesc}`)).toBe(true);
    });

    it('should accept scope with numbers', () => {
      expect(validateConventionalCommit('feat(v2): add feature')).toBe(true);
    });

    it('should accept scope with dots', () => {
      expect(validateConventionalCommit('fix(api.v1): resolve bug')).toBe(true);
    });
  });
});

describe('isCLINotFoundError', () => {
  describe('ENOENT errors', () => {
    it('should return true for error with code ENOENT', () => {
      const error = { code: 'ENOENT' };
      expect(isCLINotFoundError(error)).toBe(true);
    });

    it('should return true for Error object with ENOENT code', () => {
      const error = new Error('Command not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      expect(isCLINotFoundError(error)).toBe(true);
    });

    it('should return true for execa error with ENOENT', () => {
      // Simulate execa error structure
      const error = {
        code: 'ENOENT',
        command: 'claude',
        message: 'Command failed',
        stderr: '',
        stdout: '',
      };
      expect(isCLINotFoundError(error)).toBe(true);
    });
  });

  describe('non-ENOENT errors', () => {
    it('should return false for error with different code', () => {
      const error = { code: 'EACCES' };
      expect(isCLINotFoundError(error)).toBe(false);
    });

    it('should return false for error without code', () => {
      const error = new Error('Some error');
      expect(isCLINotFoundError(error)).toBe(false);
    });

    it('should return false for error with code as number', () => {
      const error = { code: 1 };
      expect(isCLINotFoundError(error)).toBe(false);
    });

    it('should return false for error with empty code', () => {
      const error = { code: '' };
      expect(isCLINotFoundError(error)).toBe(false);
    });
  });

  describe('non-error inputs', () => {
    it('should return false for null', () => {
      expect(isCLINotFoundError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCLINotFoundError(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isCLINotFoundError('error message')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isCLINotFoundError(123)).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isCLINotFoundError(true)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isCLINotFoundError([])).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isCLINotFoundError({})).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle object with code property but wrong value', () => {
      const error = { code: 'NOT_ENOENT' };
      expect(isCLINotFoundError(error)).toBe(false);
    });

    it('should handle object with ENOENT in message but not code', () => {
      const error = { message: 'ENOENT: file not found' };
      expect(isCLINotFoundError(error)).toBe(false);
    });

    it('should handle error with additional properties', () => {
      const error = {
        code: 'ENOENT',
        errno: -2,
        message: 'Command not found',
        path: '/usr/bin/claude',
        syscall: 'spawn',
      };
      expect(isCLINotFoundError(error)).toBe(true);
    });

    it('should be case-sensitive for ENOENT', () => {
      const error1 = { code: 'enoent' };
      expect(isCLINotFoundError(error1)).toBe(false);

      const error2 = { code: 'Enoent' };
      expect(isCLINotFoundError(error2)).toBe(false);
    });
  });
});
