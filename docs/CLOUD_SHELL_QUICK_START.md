# Quick Start: Google Cloud Shell Deployment

## Step 1: Open Cloud Shell

1. Go to: https://console.cloud.google.com
2. Click the **Cloud Shell icon** (terminal icon) in the top-right corner
3. Wait for it to load (10-30 seconds)

## Step 2: Clone or Navigate to Your Code

If you need to clone the repository:
```bash
git clone https://github.com/mcpmessenger/mcp-registry.git
cd mcp-registry/backend
```

If the code is already there, just navigate:
```bash
cd ~/mcp-registry/backend
```

## Step 3: Set Your Project

```bash
gcloud config set project 554655392699
```

## Step 4: Build and Deploy

```bash
# Build the container
gcloud builds submit --tag gcr.io/554655392699/mcp-registry-backend --region us-central1 .

# Deploy to Cloud Run
gcloud run deploy mcp-registry-backend \
  --image gcr.io/554655392699/mcp-registry-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Step 5: Wait for Deployment

You'll see:
- "Building..."
- "Pushing..."
- "Deploying..."
- "Done!"

## Step 6: Test

After deployment completes, test your design request in the chat interface again!

