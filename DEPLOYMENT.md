# Deployment Guide

This guide covers deploying the Real-Time Collaborative Whiteboard to Cloudflare Workers using both manual deployment and automated GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Manual Deployment](#manual-deployment)
4. [Automated Deployment with GitHub Actions](#automated-deployment-with-github-actions)
5. [Environment Configuration](#environment-configuration)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- Cloudflare account (free tier works)
- Node.js 16 or higher
- Git repository (for GitHub Actions)
- Wrangler CLI installed globally

## Initial Setup

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with Cloudflare.

### 3. Get Your Cloudflare Account ID

```bash
wrangler whoami
```

Save the Account ID for later use.

### 4. Create KV Namespace

Create a KV namespace for session storage:

```bash
wrangler kv:namespace create "SESSIONS_KV"
```

You'll get output like:
```
{ binding = "SESSIONS_KV", id = "abcd1234efgh5678" }
```

Copy the `id` and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "YOUR_KV_ID_HERE"  # Replace with your actual ID
```

### 5. Create R2 Bucket

Create an R2 bucket for image storage:

```bash
wrangler r2 bucket create whiteboard-images
```

The bucket name should match what's in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "whiteboard-images"
```

## Manual Deployment

### Deploy to Production

```bash
npm run deploy
```

Or using Wrangler directly:

```bash
wrangler deploy
```

After deployment, your app will be available at:
```
https://realtime-whiteboard.<your-subdomain>.workers.dev
```

### Deploy to Preview Environment

For testing before production:

```bash
wrangler deploy --env preview
```

## Automated Deployment with GitHub Actions

The repository includes GitHub Actions workflows for automatic deployment.

### Setup GitHub Secrets

1. **Go to your GitHub repository**
2. **Navigate to Settings > Secrets and variables > Actions**
3. **Add the following secrets:**

#### CLOUDFLARE_API_TOKEN

Create an API token with Workers deployment permissions:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **My Profile > API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template
5. Configure permissions:
   - Account Resources: Include > Your Account
   - Zone Resources: All zones (or specific zone)
   - Permissions:
     - Account > Cloudflare Workers Scripts > Edit
     - Account > Account Settings > Read
6. Click **Continue to summary** and **Create Token**
7. Copy the token and add it as `CLOUDFLARE_API_TOKEN` in GitHub Secrets

#### CLOUDFLARE_ACCOUNT_ID

Add your Cloudflare Account ID (from step 3 of Initial Setup) as `CLOUDFLARE_ACCOUNT_ID`.

### GitHub Actions Workflows

#### 1. Production Deployment (`.github/workflows/deploy.yml`)

**Triggers:**
- Automatic: Push to `main` or `master` branch
- Manual: From Actions tab

**What it does:**
- Checks out code
- Sets up Node.js
- Installs dependencies
- Deploys to production

#### 2. Preview Deployment (`.github/workflows/deploy-preview.yml`)

**Triggers:**
- Automatic: Pull requests to `main` or `master`
- Manual: From Actions tab

**What it does:**
- Creates preview environment
- Comments on PR with preview URL
- Useful for testing before merging

### Using GitHub Actions

#### Automatic Deployment

Simply push to the main branch:

```bash
git push origin main
```

GitHub Actions will automatically deploy your changes.

#### Manual Deployment

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Deploy to Cloudflare Workers** workflow
4. Click **Run workflow**
5. Select branch and click **Run workflow**

#### Monitor Deployment

1. Go to **Actions** tab
2. Click on the running workflow
3. View logs and deployment status

## Environment Configuration

### Production Environment

Default configuration in `wrangler.toml`:

```toml
name = "realtime-whiteboard"
main = "src/worker/index.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
MAX_IMAGE_SIZE_MB = "10"
AUTO_SAVE_INTERVAL_MS = "30000"
```

### Preview Environment

Create a preview environment by adding to `wrangler.toml`:

```toml
[env.preview]
name = "realtime-whiteboard-preview"
vars = { ENVIRONMENT = "preview" }

[[env.preview.kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-preview-kv-id"

[[env.preview.r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "whiteboard-images-preview"
```

Create preview resources:

```bash
wrangler kv:namespace create "SESSIONS_KV" --env preview
wrangler r2 bucket create whiteboard-images-preview
```

## Custom Domain Setup

### 1. Add Custom Domain

In Cloudflare Dashboard:

1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Settings > Triggers**
4. Click **Add Custom Domain**
5. Enter your domain (e.g., `whiteboard.yourdomain.com`)
6. Click **Add Custom Domain**

### 2. Update wrangler.toml

Add routes to `wrangler.toml`:

```toml
routes = [
  { pattern = "whiteboard.yourdomain.com", custom_domain = true }
]
```

### 3. Deploy

```bash
wrangler deploy
```

Your app will now be available at your custom domain!

## Monitoring and Logs

### View Logs

Stream real-time logs:

```bash
wrangler tail
```

Filter logs:

```bash
wrangler tail --status error
```

### View Deployment History

```bash
wrangler deployments list
```

### Rollback Deployment

```bash
wrangler rollback [deployment-id]
```

## Troubleshooting

### Deployment Fails - "Namespace not found"

Make sure you've created the KV namespace and updated `wrangler.toml` with the correct ID.

### Deployment Fails - "Bucket not found"

Create the R2 bucket:

```bash
wrangler r2 bucket create whiteboard-images
```

### GitHub Actions Fails - "Unauthorized"

Check that your `CLOUDFLARE_API_TOKEN` has the correct permissions:
- Account > Cloudflare Workers Scripts > Edit
- Account > Account Settings > Read

### Images Not Uploading

1. Verify R2 bucket exists: `wrangler r2 bucket list`
2. Check bucket binding in `wrangler.toml`
3. Verify R2 is enabled in your Cloudflare account

### WebSocket Connection Fails

1. Verify Durable Objects are enabled in your account
2. Check Durable Object bindings in `wrangler.toml`
3. Review worker logs: `wrangler tail`

## Production Checklist

Before going to production, ensure:

- [ ] KV namespace created and configured
- [ ] R2 bucket created and configured
- [ ] Environment variables set correctly
- [ ] Custom domain configured (optional)
- [ ] GitHub Actions secrets configured
- [ ] Test deployment in preview environment
- [ ] Monitor logs after deployment
- [ ] Set up alerts in Cloudflare Dashboard

## Cost Estimation

Cloudflare Workers Free Tier includes:
- 100,000 requests per day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day
- R2: 10 GB storage, 1 million writes, 10 million reads per month
- Durable Objects: 1 million requests per month

For most small to medium projects, the free tier is sufficient!

## Support

If you encounter issues:

1. Check [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
2. Review [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
3. Check deployment logs: `wrangler tail`
4. Review GitHub Actions logs in Actions tab

## Next Steps

After deployment:

1. Share your whiteboard URL with team members
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up backup strategy for important sessions
5. Consider implementing rate limiting for production use
