#!/bin/bash

# Cloudflare Workers Setup Script
# This script helps you set up the required Cloudflare resources

set -e

echo "🚀 Cloudflare Workers Setup for Real-Time Whiteboard"
echo "======================================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed."
    echo "Please install it first: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"
echo ""

# Check if logged in
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare."
    echo "Please run: wrangler login"
    exit 1
fi

echo "✅ Logged in to Cloudflare"
echo ""

# Create KV namespace
echo "📦 Creating KV namespace for session storage..."
echo "Running: wrangler kv:namespace create SESSIONS_KV"
echo ""

KV_OUTPUT=$(wrangler kv:namespace create "SESSIONS_KV" 2>&1)
echo "$KV_OUTPUT"
echo ""

# Extract KV namespace ID
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

if [ -z "$KV_ID" ]; then
    echo "⚠️  Could not automatically extract KV namespace ID."
    echo "Please manually copy the ID from the output above."
    read -p "Enter your KV namespace ID: " KV_ID
fi

echo "📝 KV Namespace ID: $KV_ID"
echo ""

# Create R2 bucket
echo "🗄️  Creating R2 bucket for image storage..."
echo "Running: wrangler r2 bucket create whiteboard-images"
echo ""

if wrangler r2 bucket create whiteboard-images 2>&1; then
    echo "✅ R2 bucket 'whiteboard-images' created successfully"
else
    echo "⚠️  R2 bucket might already exist or creation failed"
    echo "You can check existing buckets with: wrangler r2 bucket list"
fi

echo ""

# Update wrangler.toml
echo "📝 Updating wrangler.toml with your KV namespace ID..."
echo ""

# Create backup
cp wrangler.toml wrangler.toml.backup

# Update wrangler.toml
sed -i.bak "s/# \[\[kv_namespaces\]\]/[[kv_namespaces]]/" wrangler.toml
sed -i.bak "s/# binding = \"SESSIONS_KV\"/binding = \"SESSIONS_KV\"/" wrangler.toml
sed -i.bak "s/# id = \"YOUR_KV_NAMESPACE_ID_HERE\"/id = \"$KV_ID\"/" wrangler.toml

# Remove backup file
rm -f wrangler.toml.bak

echo "✅ wrangler.toml updated successfully"
echo ""

# Show the changes
echo "📋 Updated configuration in wrangler.toml:"
echo "-------------------------------------------"
grep -A 2 "kv_namespaces" wrangler.toml | head -3
echo ""

# Summary
echo "✅ Setup Complete!"
echo "===================="
echo ""
echo "Resources created:"
echo "  ✅ KV Namespace: SESSIONS_KV (ID: $KV_ID)"
echo "  ✅ R2 Bucket: whiteboard-images"
echo ""
echo "Next steps:"
echo "  1. Review wrangler.toml to ensure everything looks correct"
echo "  2. Test locally: npm run dev"
echo "  3. Deploy: npm run deploy"
echo ""
echo "For GitHub Actions, add these secrets to your repository:"
echo "  - CLOUDFLARE_API_TOKEN (create at: https://dash.cloudflare.com/profile/api-tokens)"
echo "  - CLOUDFLARE_ACCOUNT_ID (get from: wrangler whoami)"
echo ""
echo "🎉 You're all set! Happy coding!"
