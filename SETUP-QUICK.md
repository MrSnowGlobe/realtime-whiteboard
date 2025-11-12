# Quick Setup Guide - Before First Deployment

**IMPORTANT**: You must complete these steps before deploying to Cloudflare Workers.

## Prerequisites

✅ Node.js 16+ installed
✅ Cloudflare account created (free tier works)
✅ Wrangler CLI installed: `npm install -g wrangler`

## Automated Setup (Recommended)

### Option 1: Use the Setup Script

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Run the automated setup script
./setup-cloudflare.sh
```

The script will:
- Create KV namespace for session storage
- Create R2 bucket for images
- Automatically update `wrangler.toml` with the correct IDs

### Option 2: Manual Setup

If you prefer to set up manually or the script doesn't work:

#### Step 1: Login to Cloudflare

```bash
wrangler login
```

#### Step 2: Create KV Namespace

```bash
wrangler kv:namespace create "SESSIONS_KV"
```

You'll get output like:
```
🌀 Creating namespace with title "realtime-whiteboard-SESSIONS_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SESSIONS_KV", id = "abcd1234efgh5678ijkl" }
```

**Copy the ID** (e.g., `abcd1234efgh5678ijkl`)

#### Step 3: Update wrangler.toml

Open `wrangler.toml` and find these lines:

```toml
# [[kv_namespaces]]
# binding = "SESSIONS_KV"
# id = "YOUR_KV_NAMESPACE_ID_HERE"
```

**Uncomment and update** with your KV namespace ID:

```toml
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "abcd1234efgh5678ijkl"  # Your actual ID here
```

#### Step 4: Create R2 Bucket

```bash
wrangler r2 bucket create whiteboard-images
```

You should see:
```
✅ Created bucket 'whiteboard-images'
```

## Verify Setup

```bash
# Check KV namespaces
wrangler kv:namespace list

# Check R2 buckets
wrangler r2 bucket list

# Verify wrangler.toml is configured
cat wrangler.toml | grep -A 2 "kv_namespaces"
```

## Test Locally

Before deploying, test locally:

```bash
npm install
npm run dev
```

Open http://localhost:8787 in your browser. You should see the whiteboard.

## Deploy to Production

Once setup is complete and local testing works:

```bash
npm run deploy
```

Your whiteboard will be live at:
```
https://realtime-whiteboard.<your-subdomain>.workers.dev
```

## GitHub Actions Setup

After manual deployment works, set up automated deployments:

### Get Your Account ID

```bash
wrangler whoami
```

Copy the "Account ID" from the output.

### Create API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Click **Continue to summary** → **Create Token**
5. Copy the token

### Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

Add two secrets:
- `CLOUDFLARE_API_TOKEN` - Your API token
- `CLOUDFLARE_ACCOUNT_ID` - Your account ID

### Enable Actions

Push to main branch - GitHub Actions will automatically deploy!

## Troubleshooting

### "Namespace is not valid" Error

✅ **Solution**: You haven't created the KV namespace yet
```bash
wrangler kv:namespace create "SESSIONS_KV"
```
Then update `wrangler.toml` with the returned ID.

### "Bucket not found" Error

✅ **Solution**: Create the R2 bucket
```bash
wrangler r2 bucket create whiteboard-images
```

### "Not logged in" Error

✅ **Solution**: Login to Cloudflare
```bash
wrangler login
```

### KV Namespace Still Commented Out

✅ **Solution**: Uncomment the lines in `wrangler.toml`
```toml
# Remove the # from these lines:
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-id-here"
```

## Common Issues

**Q: Can I use a different bucket name?**
A: Yes, but update `bucket_name` in `wrangler.toml` to match.

**Q: Do I need to pay for Cloudflare?**
A: No! The free tier includes:
- 100,000 requests/day
- KV: 100k reads/day, 1k writes/day
- R2: 10GB storage, 1M writes, 10M reads/month
- Durable Objects: 1M requests/month

**Q: Can I test without deploying?**
A: Yes! Use `npm run dev` for local development.

**Q: How do I update my deployment?**
A: Just run `npm run deploy` again, or push to main if using GitHub Actions.

## Next Steps

✅ Setup complete? Great! Now you can:

1. **Share your whiteboard** - Send the URL to collaborators
2. **Customize colors** - Edit `src/shared/constants.js`
3. **Add features** - Check the codebase and start coding
4. **Monitor usage** - Check Cloudflare dashboard for analytics

## Need More Help?

- 📖 [Full Deployment Guide](DEPLOYMENT.md)
- 🔧 [GitHub Actions Setup](.github/SETUP.md)
- 📚 [README](README.md)

---

**Quick Command Reference:**

```bash
# Setup
wrangler login
wrangler kv:namespace create "SESSIONS_KV"
wrangler r2 bucket create whiteboard-images

# Development
npm install
npm run dev

# Deployment
npm run deploy

# Monitoring
wrangler tail
wrangler kv:namespace list
wrangler r2 bucket list
```
