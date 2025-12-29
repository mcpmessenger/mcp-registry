# Finding the Cloud SQL Connection Name

## What You're Looking For

The **Connection name** format is:
```
554655392699:us-central1:mcp-registry-db
```
(Project ID : Region : Instance Name)

## Where to Find It

1. **On the Overview page** of your Cloud SQL instance
   - Look for a section labeled **"Connection name"** or **"Instance connection name"**
   - It should show something like: `554655392699:us-central1:mcp-registry-db`

2. **Or check the instance details card** at the top of the Overview page
   - Sometimes it's shown next to the instance name/region

3. **Alternative: Construct it yourself**
   - Project ID: `554655392699`
   - Region: `us-central1`
   - Instance name: `mcp-registry-db`
   - **Connection name**: `554655392699:us-central1:mcp-registry-db`

## What You Showed Me

`p554655392699-jau6xt@gcp-sa-cloud-sql.iam.gserviceaccount.com` 
- This is the **Cloud SQL service account** (used for permissions)
- Not the connection name we need

## Quick Answer

Your connection name should be:
```
554655392699:us-central1:mcp-registry-db
```

You can use this directly - it follows the standard format!

