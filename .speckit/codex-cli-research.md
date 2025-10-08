# Codex CLI Research

Research findings for implementing CodexProvider in the commitment tool.

## Overview

OpenAI Codex CLI is a coding agent that runs in the terminal. It's built in Rust, open-source, and supports both interactive and non-interactive modes.

**Version Tested**: codex-cli 0.42.0
**Installation**: Available via npm/homebrew, command is `codex`
**Documentation**:

- https://developers.openai.com/codex
- https://github.com/openai/codex
- https://github.com/openai/codex/blob/main/docs/exec.md

## Command Structure

### Interactive Mode

```bash
codex [OPTIONS] [PROMPT]
```

### Non-Interactive Mode (exec)

```bash
codex exec [OPTIONS] "<natural language task>"
```

## Key Findings for Commit Message Generation

### 1. Command Syntax

**Basic Usage**:

```bash
codex exec "Generate a conventional commit message for these changes"
```

**With Directory**:

```bash
codex exec -C /path/to/repo "Generate commit message"
```

**Git Repository Requirement**:

- Requires git repository by default
- Can bypass with `--skip-git-repo-check` flag

### 2. Input/Output Format

**Input**:

- Prompt passed as command-line argument (not stdin)
- Cannot pipe commit context via stdin
- Codex reads git diff/status automatically from working directory

**Output**:

- Default: Streams activity to stderr, final message to stdout
- Final message includes metadata (timestamps, tokens, thinking process)
- Plain text format (not JSON by default)

**Example Output**:

```
[2025-10-08T21:41:16] OpenAI Codex v0.42.0 (research preview)
--------
workdir: /Users/drewritter/projects/typescript-nextjs-starter
model: gpt-5-codex
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: auto
--------
[2025-10-08T21:41:16] User instructions:
what is 2+2

[2025-10-08T21:41:20] thinking

**Providing simple numeric response**
[2025-10-08T21:41:20] codex

4
[2025-10-08T21:41:20] tokens used: 5,112
```

### 3. Output Options

**--json**: Streams events as JSON Lines (JSONL)

```bash
codex exec "task" --json
```

- Streams structured events (thread.started, turn.completed, etc.)
- More complex parsing required

**--output-last-message <FILE>**: Writes final message to file

```bash
codex exec "task" --output-last-message /tmp/output.txt
```

- Still streams to stdout/stderr
- Saves final message separately

**--output-schema <FILE>**: Structured output based on JSON Schema

```bash
codex exec "task" --output-schema schema.json
```

- Forces output to match schema
- Requires strict JSON Schema format

**--color never**: Disables color output

```bash
codex exec "task" --color never
```

### 4. Execution Modes

**Read-Only (default)**:

```bash
codex exec "task"
```

- Cannot modify files
- Cannot run network commands
- Safe for analysis tasks

**Full Auto**:

```bash
codex exec "task" --full-auto
```

- Allows file edits
- Still sandboxed

**Danger Mode**:

```bash
codex exec "task" --sandbox danger-full-access
```

- Full file system access
- Network access
- Use with caution

### 5. Authentication

**Default**: Uses stored Codex authentication

```bash
codex login
```

**API Key Override**:

```bash
CODEX_API_KEY=sk-... codex exec "task"
```

## Implementation Challenges

### 1. Output Parsing Complexity

**Issue**: Default output includes metadata, timestamps, and thinking process mixed with actual response.

**Solution Options**:

1. Parse stdout and extract content between `[timestamp] codex` marker and `[timestamp] tokens used`
2. Use `--output-last-message` to write clean output to temp file
3. Use `--json` with structured parsing (complex)

**Recommended**: Use `--output-last-message` with temp file for clean output extraction.

### 2. Git Repository Requirement

**Issue**: Codex requires running inside a git repository.

**Solution**:

- Use `-C <dir>` flag to specify working directory
- Ensure working directory is a git repo (matches commitment's use case)
- Add `--skip-git-repo-check` as fallback option

### 3. Prompt Design

**Issue**: Cannot pipe git diff via stdin; Codex reads git state automatically.

**Solution**:

- Provide high-level instruction: "Generate a conventional commit message for the staged changes"
- Let Codex discover git diff/status from working directory
- Simpler than manually constructing context

### 4. Timeout Handling

**Issue**: Codex can take 10-30 seconds for complex tasks.

**Solution**:

- Set appropriate timeout (30-60 seconds)
- Use timeout command wrapper if needed
- Handle timeout errors gracefully

## Recommended Implementation Approach

### CodexProvider Structure

```typescript
class CodexProvider extends BaseCLIProvider {
  protected getCommand(): string {
    return 'codex';
  }

  protected getArgs(): string[] {
    return [
      'exec',
      '<PROMPT>', // Injected dynamically
      '--color',
      'never',
      '--output-last-message',
      '<TEMP_FILE>', // Injected dynamically
    ];
  }

  async isAvailable(): Promise<boolean> {
    // Check if 'codex --version' succeeds
    return this.checkCommandAvailable();
  }

  protected parseResponse(output: string, options: GenerateOptions): string {
    // Read from temp file specified in --output-last-message
    // Clean any remaining metadata artifacts
    // Validate commit message format
  }
}
```

### Execution Flow

1. **Prepare**:
   - Create temp file for output
   - Construct args with prompt and temp file path
   - Set working directory to git repo

2. **Execute**:

   ```bash
   codex exec "Generate a conventional commit message" \
     --color never \
     --output-last-message /tmp/codex-output-12345.txt \
     -C /path/to/repo
   ```

3. **Parse**:
   - Read content from temp file
   - Clean any artifacts using `CLIResponseParser.cleanAIArtifacts()`
   - Validate commit message format
   - Return cleaned message

4. **Cleanup**:
   - Delete temp file

### Error Handling

- **Command not found**: `ProviderNotAvailableError`
- **Authentication failure**: `ProviderNotAvailableError` with hint to run `codex login`
- **Timeout**: `ProviderTimeoutError` (30-60s recommended)
- **Invalid output**: `ProviderError` with parsing details

## Configuration Example

```typescript
{
  type: 'cli',
  provider: 'codex',
  timeout: 45000, // 45 seconds (Codex can be slow)
  command: 'codex', // Optional override
  args: ['exec', '--color', 'never'], // Base args
}
```

## Testing Considerations

1. **Authentication**: Tests require valid Codex authentication or mocking
2. **Git Repository**: Tests must run in git repository context
3. **API Costs**: Each call uses OpenAI API credits
4. **Performance**: Codex is slower than claude/aider (10-30s vs 2-5s)

## Comparison to Other Providers

| Feature             | Claude           | Aider            | Codex                                        |
| ------------------- | ---------------- | ---------------- | -------------------------------------------- |
| **Stdin Support**   | ✅ Yes           | ✅ Yes           | ❌ No (reads git directly)                   |
| **Output Format**   | Clean text       | Clean text       | Metadata-heavy (needs --output-last-message) |
| **Speed**           | ~2-5s            | ~2-5s            | ~10-30s                                      |
| **Git Integration** | Manual via stdin | Manual via stdin | Automatic discovery                          |
| **Complexity**      | Simple           | Simple           | Moderate (temp file handling)                |

## Recommendations

1. **Use `--output-last-message` flag** to get clean output in temp file
2. **Set timeout to 45-60 seconds** to account for Codex's slower response time
3. **Leverage automatic git discovery** - simpler prompts like "Generate commit message"
4. **Handle authentication gracefully** - check for `codex --version` in `isAvailable()`
5. **Clean up temp files** - use try/finally to ensure cleanup
6. **Consider as optional provider** - may be slower/heavier than claude/aider

## Open Questions

1. ~~Does `--output-last-message` include metadata or just the final message?~~
   - **Answer**: Need to test, but documentation suggests it's the clean final message
2. ~~Can we use `--output-schema` to enforce commit message format?~~
   - **Answer**: Possible but adds complexity; plain text parsing is simpler
3. ~~Is there a way to disable the "thinking" output?~~
   - **Answer**: Redirect stderr to /dev/null, use --output-last-message for clean stdout

## Next Steps

1. ✅ Research complete
2. ⏳ Implement CodexProvider with temp file handling
3. ⏳ Add tests with mocked file I/O
4. ⏳ Update factory for auto-detection
5. ⏳ Document usage and configuration
