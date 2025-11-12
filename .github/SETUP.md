# GitHub Actions Setup Guide

Quick guide to set up automated deployments with GitHub Actions.

## 🚀 What You Get

- ✅ **Automatic Production Deployment** - Deploys to production on every push to `main`
- ✅ **Pull Request Preview** - Creates preview environments for PRs
- ✅ **Manual Deployment** - Deploy anytime from GitHub Actions tab
- ✅ **Zero Downtime** - Automated with Cloudflare Workers

## 📋 Prerequisites

**CRITICAL**: Before setting up GitHub Actions, you MUST complete the Cloudflare setup first!

### ⚠️ Complete These First

1. **Cloudflare Resources Setup** - Follow [SETUP-QUICK.md](../SETUP-QUICK.md)
   - Create KV namespace
   - Create R2 bucket
   - Update `wrangler.toml`

2. **Verify Setup Works**
   ```bash
   npm run deploy  # Test manual deployment first
   ```

If manual deployment works, then proceed with GitHub Actions setup below.

## ⚡ Quick Setup (5 minutes)

### Step 1: Get Your Cloudflare Account ID

```bash
wrangler whoami
```

Copy the "Account ID" from the output.

### Step 2: Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Configure:
   - Account Resources: Include > Your Account
   - Permissions:
     - ✅ Account > Cloudflare Workers Scripts > Edit
     - ✅ Account > Account Settings > Read
5. Click **Continue to summary** → **Create Token**
6. **Copy the token** (you can only see it once!)

### Step 3: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

**Secret 1:**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: (paste the token from Step 2)

**Secret 2:**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: (paste the account ID from Step 1)

### Step 4: Test the Deployment

1. Push code to `main` branch:
   ```bash
   git push origin main
   ```

2. Go to **Actions** tab on GitHub
3. Watch the "Deploy to Cloudflare Workers" workflow run
4. Once complete, your app is live! 🎉

## 📝 Workflow Files

### Production Deployment (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main, master]
  workflow_dispatch:
```

**Triggers:**
- Automatic: Push to main/master
- Manual: Actions tab → Run workflow

### Preview Deployment (`.github/workflows/deploy-preview.yml`)

```yaml
name: Deploy Preview
on:
  pull_request:
    branches: [main, master]
  workflow_dispatch:
```

**Triggers:**
- Automatic: Pull requests
- Manual: Actions tab → Run workflow

## 🎯 Usage Examples

### Deploy Production Manually

1. Go to **Actions** tab
2. Select **Deploy to Cloudflare Workers**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow** button

### Create Preview for Testing

1. Create a new branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. Make changes and push:
   ```bash
   git push origin feature/my-new-feature
   ```

3. Create Pull Request on GitHub

4. GitHub Actions will automatically:
   - Deploy to preview environment
   - Comment on PR with preview URL

### View Deployment Logs

1. Go to **Actions** tab
2. Click on any workflow run
3. Click on the job name
4. Expand steps to see detailed logs

## 🔍 Troubleshooting

### "Unauthorized" Error

**Problem:** API token doesn't have correct permissions

**Solution:**
1. Create a new token with these permissions:
   - Account > Cloudflare Workers Scripts > Edit
   - Account > Account Settings > Read
2. Update `CLOUDFLARE_API_TOKEN` secret in GitHub

### "Namespace not found" Error

**Problem:** KV namespace not created or wrong ID in wrangler.toml

**Solution:**
```bash
wrangler kv:namespace create "SESSIONS_KV"
```
Update the `id` in `wrangler.toml`

### "Bucket not found" Error

**Problem:** R2 bucket not created

**Solution:**
```bash
wrangler r2 bucket create whiteboard-images
```

### Deployment Succeeds but App Doesn't Work

**Problem:** KV or R2 not properly configured

**Solution:**
1. Verify bindings in `wrangler.toml`
2. Check logs: `wrangler tail`
3. Test locally first: `npm run dev`

## 🔐 Security Best Practices

✅ **DO:**
- Use API tokens with minimal required permissions
- Rotate API tokens regularly
- Use separate tokens for production and preview
- Keep secrets in GitHub Secrets (never commit them)

❌ **DON'T:**
- Share API tokens publicly
- Commit tokens to repository
- Use API keys (use tokens instead)
- Give tokens more permissions than needed

## 📊 Monitor Deployments

### GitHub Actions

- View workflow runs: **Actions** tab
- Download logs: Click run → Click ⋯ → Download logs
- Re-run failed jobs: Click run → Re-run jobs

### Cloudflare Dashboard

- View deployments: Workers & Pages → Your Worker → Deployments
- Monitor traffic: Workers & Pages → Your Worker → Metrics
- View logs: Workers & Pages → Your Worker → Logs

## 🎉 You're All Set!

Your whiteboard now has:
- ✅ Automated production deployments
- ✅ Preview environments for PRs
- ✅ Manual deployment capability
- ✅ Full deployment history
- ✅ Professional CI/CD pipeline

## 📚 More Resources

- [Full Deployment Guide](../DEPLOYMENT.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## 💡 Pro Tips

1. **Use Preview Deployments** - Always test in preview before merging to main
2. **Enable Branch Protection** - Require PR reviews before merging to main
3. **Monitor Costs** - Check Cloudflare dashboard regularly (free tier is generous)
4. **Set Up Alerts** - Configure notifications in Cloudflare for errors
5. **Tag Releases** - Use git tags for version tracking

---

Need help? Check [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed troubleshooting!
