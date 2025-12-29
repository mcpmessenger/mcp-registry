# Deploy from Cloud Shell

## Setup in Cloud Shell

### Step 1: Clone your repository (or upload files)

If your code is in GitHub:
```bash
git clone <your-repo-url>
cd mcp-registry/backend
```

Or if you need to upload:
1. Click the three-dot menu (⋮) in Cloud Shell
2. Select "Upload file"
3. Upload your backend folder files

### Step 2: Set up environment variables

Create your `.env` file:
```bash
nano .env
```

Paste your environment variables from your local `.env` file, then save (Ctrl+X, then Y, then Enter).

### Step 3: Grant permissions (if not already done)

```bash
PROJECT_ID="554655392699"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Cloud Build permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create repository if needed
gcloud artifacts repositories create mcp-registry \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for MCP Registry Backend" 2>/dev/null || echo "Repository exists"
```

### Step 4: Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
1. Build the Docker image using Cloud Build
2. Push to Artifact Registry
3. Deploy to Cloud Run

Cloud Shell avoids all Windows/PowerShell permission issues!

