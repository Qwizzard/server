# GitHub Actions Workflows - Server

This directory contains automated CI/CD workflows for the Qwizzard **Server** project.

## 📋 Workflows Overview

### 1. **Server CI** (`server-ci.yml`)
**Triggers:** Push/PR to any branch

**What it does:**
- ✅ Installs dependencies
- ✅ Runs ESLint linting
- ✅ Performs TypeScript type checking
- ✅ Builds the project
- ✅ Reports success/failure

**When it runs:**
- On push to any branch
- On pull requests

**Status:** Fails if any linting or build errors are found

---

### 2. **Auto-fix Linting** (`auto-fix-lint.yml`)
**Triggers:** Push to any branch (except main/master)

**What it does:**
- 🔧 Runs ESLint with `--fix` flag
- 💾 Automatically commits fixes (if any)
- 🚀 Pushes the fixes back to the branch

**Safety features:**
- ❌ Does NOT run on `main` or `master` branches
- ❌ Skips if commit message contains `[skip ci]` or `[ci skip]`
- ✅ Adds `[skip ci]` to commit message to prevent infinite loops
- ✅ Can be manually triggered via GitHub Actions UI

**Use case:** Automatically fixes formatting and simple linting issues

---

### 3. **PR Checks** (`pr-checks.yml`)
**Triggers:** Pull requests to main/master/develop branches

**What it does:**
- ✅ Runs comprehensive checks on all code
- 📊 Provides a summary of all checks

**Checks performed:**
- ESLint linting
- TypeScript type checking
- Build verification
- Summary report

---

## 🚀 How to Use

### For Regular Development

1. **Push your changes to any branch:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin your-branch
   ```

2. **GitHub Actions will automatically:**
   - ✅ Check for linting errors
   - ✅ Check for build errors
   - ✅ Check for type errors
   - 🔧 Auto-fix fixable linting errors (on feature branches)

3. **Check the status:**
   - Go to your repository on GitHub
   - Click "Actions" tab
   - See the running/completed workflows

### For Pull Requests

1. **Create a PR to main/master/develop:**
   ```bash
   git checkout -b feature/my-feature
   # Make changes
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

2. **PR Checks will run automatically:**
   - Shows detailed status for server and UI separately
   - Must pass before merging
   - Provides summary in PR conversation

### Manual Trigger (Auto-fix)

1. Go to **Actions** tab on GitHub
2. Select **"Auto-fix Linting Errors"** workflow
3. Click **"Run workflow"**
4. Select branch
5. Click **"Run workflow"** button

---

## 📊 Workflow Status Badges

Add this to your server `README.md`:

```markdown
![Server CI](https://github.com/YOUR_USERNAME/qwizzard-server/workflows/Server%20CI/badge.svg)
```

---

## 🔧 Configuration

### Node.js Version
All workflows use **Node.js 20.x**. To change:
```yaml
node-version: 20.x  # Change this in each workflow
```

### Branch Protection
Recommended branch protection rules for `main`:

1. **Require status checks to pass:**
   - ✅ Server CI
   - ✅ UI CI
   - ✅ PR Checks

2. **Require pull request reviews**

3. **Require branches to be up to date**

4. **Include administrators** (optional)

---

## 🛠️ Customization

### Skip CI for Certain Commits
Add to your commit message:
```bash
git commit -m "Update documentation [skip ci]"
```

### Change Auto-fix Behavior
Edit `auto-fix-lint.yml`:
```yaml
# To enable on main branch, remove this line:
- '!main'
```

### Add More Checks
Example - add testing:
```yaml
- name: 🧪 Run tests
  run: npm test
```

---

## 🐛 Troubleshooting

### Workflow Not Running?
- Check if your changes affect the paths specified in the workflow
- Verify branch name matches the trigger conditions
- Check if `[skip ci]` is in commit message

### Auto-fix Creating Infinite Loops?
- The workflow adds `[skip ci]` to commit messages
- If still looping, check your ESLint configuration

### Permission Denied?
- Workflows use `GITHUB_TOKEN` which has default permissions
- For private repos, may need to adjust permissions in repo settings

### Build Failing?
- Check the workflow logs in GitHub Actions
- Run the same commands locally:
  ```bash
  npm ci
  npm run lint
  npm run build
  ```

---

## 📈 Best Practices

1. **Commit frequently** - Workflows catch errors early
2. **Fix locally first** - Run `npm run lint` before pushing
3. **Review auto-fixes** - Check what the bot changed
4. **Keep workflows updated** - Update Node.js versions regularly
5. **Monitor workflow runs** - Fix failing workflows promptly

---

## 🔗 Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ESLint Documentation](https://eslint.org/docs/latest/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

## 📝 Workflow Files

| File | Purpose | Trigger |
|------|---------|---------|
| `server-ci.yml` | Build & lint checks | Push/PR |
| `auto-fix-lint.yml` | Auto-fix linting errors | Push (feature branches) |
| `pr-checks.yml` | Comprehensive PR validation | PR to main/master/develop |

---

## 🔗 UI Workflows

The UI project has its own workflows located in `/ui/.github/workflows/`

---

**Last Updated:** November 2025

