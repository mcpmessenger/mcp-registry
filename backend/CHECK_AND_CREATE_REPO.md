# Check and Create Artifact Registry Repository

## The Issue
The script is trying to use repository `mcp-registry` but it might not exist or permissions aren't set.

## Check Existing Repositories

In Cloud Shell, run:
```bash
gcloud artifacts repositories list --location=us-central1
```

This will show all Docker repositories in us-central1.

## If Repository Doesn't Exist

Create it manually:
```bash
gcloud artifacts repositories create mcp-registry \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for MCP Registry Backend"
```

## If Repository Exists But Has Different Name

If you see a repository with a different name, you can either:
1. Use that repository name (update deploy.sh)
2. Or create a new one called `mcp-registry`

## Check Repository Details

```bash
gcloud artifacts repositories describe mcp-registry --location=us-central1
```

## After Creating Repository

Try deploying again:
```bash
./deploy.sh
```

The script should now be able to push to the repository.


