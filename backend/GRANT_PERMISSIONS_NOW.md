# Grant Permissions - Repository Exists!

✅ The repository `mcp-registry` exists!

The issue is permissions. Grant them manually:

## In Cloud Shell:

```bash
PROJECT_ID="554655392699"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant Cloud Build permission to push
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"
```

## Then Deploy:

```bash
./deploy.sh
```

## If Permission Grant Fails

If you get an error saying you don't have permission to grant IAM roles, use Cloud Console:

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=554655392699
2. Find: `[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`
3. Click edit (pencil icon)
4. Add role: **Artifact Registry Writer**
5. Save

Then deploy again.


