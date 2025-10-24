# Publishing Guide

How to publish commitment to npm.

## Prerequisites

### 1. NPM Account Setup

**Create account:**
```bash
npm login
```

**Verify you're logged in:**
```bash
npm whoami
# Should show: arittr (or your npm username)
```

### 2. NPM Token for GitHub Actions

**Generate token:**
1. Go to https://www.npmjs.com/settings/[username]/tokens
2. Click "Generate New Token" → "Automation"
3. Copy the token (starts with `npm_...`)

**Add to GitHub:**
1. Go to https://github.com/Snug-Labs/commitment/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click "Add secret"

### 3. Package Scope Access

The package is scoped to `@arittr`. Ensure you have publish access:

```bash
npm access ls-packages
# Should show @arittr/commitment
```

If not listed, request access or publish under your own scope by changing `"name": "@yourscope/commitment"` in package.json.

## Publishing Process

### Automatic (via GitHub Release) - Recommended

**1. Update version in package.json:**

```bash
# Bump version (patch, minor, or major)
npm version patch  # 1.0.0 → 1.0.1
# or
npm version minor  # 1.0.0 → 1.1.0
# or
npm version major  # 1.0.0 → 2.0.0
```

This creates a git tag automatically (e.g., `v1.0.1`).

**2. Push tag to GitHub:**

```bash
git push origin main
git push origin --tags
```

**3. Create GitHub Release:**

Option A - Via GitHub UI:
1. Go to https://github.com/Snug-Labs/commitment/releases/new
2. Choose the tag (e.g., `v1.0.1`)
3. Title: `v1.0.1` (same as tag)
4. Description: Release notes (what's new, what changed)
5. Click "Publish release"

Option B - Via gh CLI:
```bash
gh release create v1.0.1 \
  --title "v1.0.1" \
  --notes "### Added
- New feature X

### Fixed
- Bug Y

### Changed
- Updated Z"
```

**4. Workflow runs automatically:**

The `.github/workflows/publish.yml` workflow will:
- ✅ Checkout code
- ✅ Install dependencies
- ✅ Run type checking
- ✅ Run linting
- ✅ Run unit tests
- ✅ Build package
- ✅ Verify build artifacts
- ✅ Publish to npm with provenance
- ✅ Comment on release with npm link

**5. Verify publication:**

```bash
# Check npm
npm view @arittr/commitment

# Or visit
# https://www.npmjs.com/package/@arittr/commitment
```

### Manual Publishing (Emergency)

Only use if GitHub Actions fails.

**1. Ensure you're on main and up-to-date:**

```bash
git checkout main
git pull origin main
```

**2. Clean and build:**

```bash
bun run clean
bun install --frozen-lockfile
bun run build
```

**3. Verify build:**

```bash
ls -la dist/
# Should see cli.js and other built files
```

**4. Run tests:**

```bash
bun run lint
bun run test:unit
```

**5. Publish:**

```bash
npm publish --access public
```

**6. Verify:**

```bash
npm view @arittr/commitment version
```

## Version Strategy

### Semantic Versioning

Follow [semver](https://semver.org/):

- **Patch** (1.0.0 → 1.0.1): Bug fixes, docs, internal changes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes

### When to Bump

**Patch:**
- Fix bugs
- Update docs
- Refactor internal code
- Update dependencies (non-breaking)

**Minor:**
- Add new CLI options
- Add new AI agent support
- Add new features
- Update dependencies (new features)

**Major:**
- Remove CLI options
- Change CLI option behavior
- Remove AI agent support
- Change output format
- Require newer Node.js version
- Any breaking API change

### Pre-releases

For testing before official release:

```bash
# Create pre-release version
npm version prerelease --preid=beta
# 1.0.0 → 1.0.1-beta.0

# Publish with beta tag
npm publish --tag beta --access public

# Users install with
npm install @arittr/commitment@beta
```

## Release Checklist

Before creating a release:

- [ ] All tests passing locally (`bun test`)
- [ ] All tests passing in CI (check GitHub Actions)
- [ ] CHANGELOG updated (or release notes prepared)
- [ ] README up-to-date
- [ ] Breaking changes documented
- [ ] Migration guide written (if breaking changes)
- [ ] Version bumped in package.json
- [ ] Git tag created and pushed
- [ ] GitHub release created

After release:

- [ ] npm package published successfully
- [ ] Package installable (`npm install @arittr/commitment@latest`)
- [ ] CLI works after install (`npx @arittr/commitment --version`)
- [ ] Announcement posted (Twitter, Discord, etc.)
- [ ] GitHub release has npm link comment

## Troubleshooting

### "You do not have permission to publish"

**Solution:**

Check package scope:
```bash
npm access ls-packages @arittr
```

If not listed, either:
1. Request access from @arittr
2. Change package name to your own scope

### "Tag already exists"

**Solution:**

Delete and recreate tag:
```bash
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
npm version patch  # Creates new tag
git push origin --tags
```

### "Build failed in workflow"

**Solution:**

Check workflow logs:
```bash
# Via gh CLI
gh run list --workflow=publish.yml

# Or visit
# https://github.com/Snug-Labs/commitment/actions
```

Common issues:
- Linting errors → Fix locally, commit, tag again
- Test failures → Fix tests, commit, tag again
- Build errors → Fix build.ts, commit, tag again

### "Package published but CLI doesn't work"

**Checklist:**

1. Verify dist/cli.js has shebang:
   ```bash
   head -1 dist/cli.js
   # Should show: #!/usr/bin/env node
   ```

2. Verify bin field in package.json:
   ```json
   "bin": {
     "commitment": "./dist/cli.js"
   }
   ```

3. Verify files array includes dist:
   ```json
   "files": ["dist", "README.md", "LICENSE"]
   ```

4. Test locally:
   ```bash
   npm pack
   npm install -g ./arittr-commitment-1.0.0.tgz
   commitment --version
   ```

### "Provenance failed"

**Solution:**

Ensure workflow has correct permissions:
```yaml
permissions:
  contents: read
  id-token: write  # Required for npm provenance
```

If still fails, publish without provenance:
```bash
npm publish --access public
```

## Rollback

If a release has critical bugs:

**1. Deprecate the version:**

```bash
npm deprecate @arittr/commitment@1.0.1 "Critical bug - use 1.0.2 instead"
```

**2. Publish fixed version:**

```bash
npm version patch
# Fix the bug
git push origin main --tags
# Create new release
```

**3. Never unpublish:**

npm policy: Can only unpublish within 72 hours, and discouraged.

Better to deprecate and publish fix.

## Best Practices

### 1. Test Before Release

**Create a test package:**

```bash
# Pack without publishing
npm pack

# Install locally
npm install -g ./arittr-commitment-1.0.0.tgz

# Test all commands
commitment --version
commitment --help
commitment init --help

# Test actual usage
cd /tmp/test-repo
git init
echo "test" > file.txt
git add .
commitment --dry-run

# Cleanup
npm uninstall -g @arittr/commitment
```

### 2. Changelog

Maintain CHANGELOG.md (or use GitHub Release notes):

```markdown
## [1.0.1] - 2025-01-15

### Added
- New `--timeout` flag for AI generation

### Fixed
- Fix hook installation on Windows
- Fix commit message validation

### Changed
- Improve error messages
```

### 3. Tag Format

Always use `v` prefix: `v1.0.0`, not `1.0.0`

This is standard and expected by tools.

### 4. Release Notes Template

```markdown
## What's New in v1.0.1

### 🎉 Features
- Add support for Gemini AI agent
- New `--template` flag for custom message templates

### 🐛 Bug Fixes
- Fix Windows line ending issues (#123)
- Fix hook installation with husky 9 (#124)

### 📚 Documentation
- Add troubleshooting guide
- Update installation instructions

### 🔧 Internal
- Refactor error handling
- Improve test coverage to 95%

## Installation

\`\`\`bash
npm install -D @arittr/commitment@1.0.1
\`\`\`

## Full Changelog

https://github.com/Snug-Labs/commitment/compare/v1.0.0...v1.0.1
```

## Monitoring

After publishing, monitor:

**npm downloads:**
```bash
npm view @arittr/commitment

# Or use
# https://npmtrends.com/@arittr/commitment
```

**GitHub issues:**
- Watch for installation issues
- Watch for bug reports
- Watch for feature requests

**GitHub discussions:**
- Answer questions
- Gather feedback

## Security

### 1. 2FA on npm

Enable 2FA:
```bash
npm profile enable-2fa auth-and-writes
```

### 2. Token Security

- Never commit NPM_TOKEN
- Rotate tokens every 6 months
- Use automation tokens (not publish tokens) for CI

### 3. Provenance

Always publish with provenance (enabled in workflow):
```bash
npm publish --provenance --access public
```

This creates a verifiable link between npm package and GitHub source.

## Resources

- [npm Publishing Docs](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
