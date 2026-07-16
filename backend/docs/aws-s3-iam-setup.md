# S3 + IAM setup for DocuVault

This walks through everything needed to switch `STORAGE_DRIVER` from
`local` to `s3`: the bucket, its encryption/CORS/lifecycle config, and the
IAM policy the backend needs. All commands use the AWS CLI; swap in
Terraform/CloudFormation if that's how you manage infrastructure.

## 1. Create the bucket

```bash
aws s3api create-bucket \
  --bucket your-docuvault-bucket \
  --region us-east-1

# Block all public access -- this app only ever talks to S3 via signed
# requests, so the bucket itself should never be publicly reachable.
aws s3api put-public-access-block \
  --bucket your-docuvault-bucket \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Default encryption at rest (SSE-S3). Use a KMS key instead if you want
# customer-managed keys -- see step 1b.
aws s3api put-bucket-encryption \
  --bucket your-docuvault-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{ "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }]
  }'

# Version objects so an accidental overwrite/delete is recoverable.
aws s3api put-bucket-versioning \
  --bucket your-docuvault-bucket \
  --versioning-configuration Status=Enabled
```

### 1b. Optional: use a KMS key instead of SSE-S3

```bash
aws kms create-key --description "DocuVault object encryption"
# note the KeyId from the output, then:
aws s3api put-bucket-encryption \
  --bucket your-docuvault-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "<key-id-or-arn>"
      }
    }]
  }'
```
Set `S3_KMS_KEY_ID` in `.env` to the same key ID/ARN so uploaded objects
request that key explicitly (belt-and-suspenders alongside the bucket
default).

## 2. CORS (only needed for direct browser uploads/downloads)

The app's default upload path goes through the Express server, so this step
is optional. If you want the Upload Center's direct-to-S3 presigned upload
to work from a browser running on a different origin than the API, add:

```bash
aws s3api put-bucket-cors --bucket your-docuvault-bucket --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["https://your-frontend-domain.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
```

## 3. Lifecycle rule for the trash/versioning cleanup (optional)

DocuVault soft-deletes files in Postgres (`is_trashed = true`) before a user
permanently deletes them. If you enabled bucket versioning above, old
versions accumulate; a lifecycle rule keeps storage costs sane:

```bash
aws s3api put-bucket-lifecycle-configuration --bucket your-docuvault-bucket --lifecycle-configuration '{
  "Rules": [{
    "ID": "expire-old-versions",
    "Status": "Enabled",
    "Filter": {},
    "NoncurrentVersionExpiration": { "NoncurrentDays": 90 }
  }]
}'
```

## 4. IAM policy (least privilege)

The backend only ever needs to read, write, delete, and head objects under
its own bucket -- nothing account-wide. Save as `docuvault-s3-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DocuVaultObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-docuvault-bucket/*"
    },
    {
      "Sid": "DocuVaultBucketListing",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-docuvault-bucket"
    },
    {
      "Sid": "DocuVaultKmsUsage",
      "Effect": "Allow",
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:us-east-1:<account-id>:key/<key-id>",
      "Condition": {
        "StringLike": { "kms:ViaService": "s3.*.amazonaws.com" }
      }
    }
  ]
}
```
Drop the `DocuVaultKmsUsage` statement if you're using SSE-S3 rather than a
KMS key.

## 5. Attach the policy via an IAM role (preferred over IAM users)

Pick whichever matches how you'll actually run the backend:

**EC2** — create an instance profile and attach it to the instance:
```bash
aws iam create-role --role-name docuvault-backend-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{ "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }]
  }'
aws iam put-role-policy --role-name docuvault-backend-role \
  --policy-name docuvault-s3-access --policy-document file://docuvault-s3-policy.json
aws iam create-instance-profile --instance-profile-name docuvault-backend-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name docuvault-backend-profile --role-name docuvault-backend-role
# attach docuvault-backend-profile to your EC2 instance
```

**ECS Fargate/EC2** — same role, but the trust policy's principal is
`ecs-tasks.amazonaws.com`, and you reference the role as the task's
`taskRoleArn` in your task definition.

**Cross-account access** (backend runs in Account A, bucket lives in
Account B) — create the role in Account B with a trust policy that allows
Account A's role/user to assume it, then set `AWS_ROLE_ARN` in `.env` to
that role's ARN:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::<account-a-id>:role/docuvault-backend-caller" },
    "Action": "sts:AssumeRole",
    "Condition": { "StringEquals": { "sts:ExternalId": "<choose-a-shared-secret>" } }
  }]
}
```
Set `AWS_ROLE_EXTERNAL_ID` in `.env` to match. `backend/src/config/aws.js`
already handles the `sts:AssumeRole` call when `AWS_ROLE_ARN` is set — no
code changes needed.

With any of the above, leave `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
unset. The SDK's default credential provider chain finds the role
automatically. Static keys in `.env` are supported only as a local-dev
fallback (`aws configure` / environment variables) and should never be used
for a real deployment.

## 6. Flip the switch

```bash
# backend/.env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_BUCKET=your-docuvault-bucket
```

Restart the backend. Existing files uploaded under `STORAGE_DRIVER=local`
stay on disk and keep working (each file row remembers its own
`storage_driver` value) — only new uploads go to S3. There's no built-in
migration job here; if you need to backfill existing local files into S3,
write a one-off script that reads each `files` row with
`storage_driver = 'local'`, streams it through the local driver's
`getStream`, `PutObject`s it to S3, and updates the row's `storage_key` /
`storage_driver`.
