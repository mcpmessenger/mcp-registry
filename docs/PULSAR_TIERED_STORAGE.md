# Pulsar Tiered Storage Configuration

This document describes how to configure tiered storage for offloading execution logs to GCS (Google Cloud Storage) or S3.

## Overview

Tiered storage allows Pulsar to automatically offload old data from BookKeeper to cheaper object storage (GCS/S3), reducing storage costs while maintaining data availability.

### Benefits

- **Cost Reduction**: 30-50% reduction in storage costs
- **Hot/Cold Separation**: Frequently accessed data stays in BookKeeper, old data in object storage
- **Automatic Offload**: Configurable triggers (size-based or time-based)
- **Transparent Access**: Consumers can read from both hot and cold storage seamlessly

## Configuration

### GCS (Google Cloud Storage)

#### Prerequisites

1. Create a GCS bucket:
   ```bash
   gsutil mb gs://my-pulsar-logs
   ```

2. Create a service account with Storage Admin role:
   ```bash
   gcloud iam service-accounts create pulsar-storage \
     --display-name="Pulsar Tiered Storage"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:pulsar-storage@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   ```

3. Download service account key:
   ```bash
   gcloud iam service-accounts keys create pulsar-gcs-key.json \
     --iam-account=pulsar-storage@PROJECT_ID.iam.gserviceaccount.com
   ```

#### Docker Compose Configuration

Update `docker-compose.pulsar.yml` environment variables:

```yaml
broker:
  environment:
    - TIERED_STORAGE_ENABLED=true
    - TIERED_STORAGE_PROVIDER=gcs
    - TIERED_STORAGE_GCS_BUCKET=my-pulsar-logs
    - TIERED_STORAGE_GCS_KEY_FILE=/pulsar/conf/gcs-key.json
  volumes:
    - ./pulsar-gcs-key.json:/pulsar/conf/gcs-key.json:ro
```

#### Pulsar Admin Configuration

```bash
# Enable tiered storage globally
pulsar-admin broker-config set-tieredStorageEnabled true
pulsar-admin broker-config set-tieredStorageProvider gcs
pulsar-admin broker-config set-tieredStorageGcsBucket my-pulsar-logs
pulsar-admin broker-config set-tieredStorageGcsServiceAccountKeyFile /pulsar/conf/gcs-key.json

# Restart broker
docker restart pulsar-broker
```

### S3 (AWS S3)

#### Prerequisites

1. Create an S3 bucket:
   ```bash
   aws s3 mb s3://my-pulsar-logs
   ```

2. Create IAM user with S3 access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::my-pulsar-logs/*"
     }]
   }
   ```

#### Docker Compose Configuration

```yaml
broker:
  environment:
    - TIERED_STORAGE_ENABLED=true
    - TIERED_STORAGE_PROVIDER=s3
    - TIERED_STORAGE_S3_BUCKET=my-pulsar-logs
    - TIERED_STORAGE_S3_REGION=us-east-1
    - AWS_ACCESS_KEY_ID=your-access-key
    - AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Namespace-Level Configuration

Configure tiered storage per namespace:

```bash
# Set offload threshold (1GB)
pulsar-admin namespaces set-offload-threshold \
  tenant/agent-456/execution \
  --size 1G

# Set offload threshold (7 days)
pulsar-admin namespaces set-offload-threshold \
  tenant/agent-456/execution \
  --time 7d

# Set deletion lag (90 days - data deleted from cold storage after this)
pulsar-admin namespaces set-retention \
  tenant/agent-456/execution \
  --size -1 \
  --time 90d
```

## Retention Policies

### Hot Storage (BookKeeper)

- **Duration**: 7 days (frequent access)
- **Purpose**: Active execution logs, recent tool invocations
- **Cost**: Higher (SSD storage)

### Cold Storage (GCS/S3)

- **Duration**: 90 days (infrequent access)
- **Purpose**: Execution logs, audit trail, historical data
- **Cost**: Lower (object storage)

### Configuration Example

```bash
# Execution logs namespace: 7 days hot, 90 days cold
pulsar-admin namespaces set-retention \
  tenant/agent-456/execution \
  --size -1 \
  --time 90d

pulsar-admin namespaces set-offload-threshold \
  tenant/agent-456/execution \
  --size 1G \
  --time 7d
```

## Monitoring

### Check Offload Status

```bash
# List offloaded ledgers
pulsar-admin topics list-subscriptions \
  persistent://tenant/agent-456/execution/execution-logs

# Get namespace stats (includes offload info)
pulsar-admin namespaces stats tenant/agent-456/execution
```

### Metrics

Monitor these metrics:
- `pulsar_storage_offload_bytes_total`: Total bytes offloaded
- `pulsar_storage_offload_errors_total`: Offload errors
- `pulsar_storage_offload_read_bytes_total`: Bytes read from cold storage

## Troubleshooting

### Offload Not Working

1. Check tiered storage is enabled:
   ```bash
   pulsar-admin broker-config get-tieredStorageEnabled
   ```

2. Verify GCS/S3 credentials are correct
3. Check broker logs for errors:
   ```bash
   docker logs pulsar-broker | grep -i offload
   ```

### High Offload Latency

- Increase offload threads: `managedLedgerOffloadMaxThreads=4`
- Check network connectivity to GCS/S3
- Monitor BookKeeper disk I/O

### Data Not Accessible After Offload

- Verify offload was successful (check namespace stats)
- Check GCS/S3 bucket permissions
- Ensure broker has access to cold storage

## Cost Optimization

### Best Practices

1. **Aggressive Offload for Execution Logs**: Offload after 7 days
2. **Retain Hot Data for Active Users**: Keep 30 days hot for orchestrator topics
3. **Archive Old Data**: Delete from cold storage after 90 days
4. **Monitor Storage Usage**: Set up alerts for namespace storage

### Estimated Savings

- **Before**: 100% data in BookKeeper (SSD) = $X/month
- **After**: 7 days hot + 90 days cold (GCS) = ~$0.3X/month
- **Savings**: ~70% reduction in storage costs

## References

- [Pulsar Tiered Storage](https://pulsar.apache.org/docs/tiered-storage/)
- [GCS Offloader](https://pulsar.apache.org/docs/tiered-storage-gcs/)
- [S3 Offloader](https://pulsar.apache.org/docs/tiered-storage-s3/)
