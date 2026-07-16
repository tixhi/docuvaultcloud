/**
 * AWS client factory.
 * ----------------------------------------------------------------------------
 * Credential resolution, in order of preference (this is what makes it an
 * "IAM integration" rather than just hardcoded keys):
 *
 *   1. AWS_ROLE_ARN set            -> STS AssumeRole into that role, using
 *                                      whatever identity is running the app
 *                                      (an EC2 instance profile, an ECS task
 *                                      role, your local `aws configure`
 *                                      profile, etc.) as the caller.
 *   2. AWS_ROLE_ARN not set        -> default AWS SDK credential provider
 *                                      chain: environment variables, shared
 *                                      config file, EC2 instance metadata,
 *                                      ECS task role, or (if you're running
 *                                      on EKS) IRSA web identity. No keys are
 *                                      ever hardcoded here.
 *
 * Static AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env are supported ONLY
 * as a local-dev fallback (the SDK picks them up from the environment
 * automatically) and should never be used in a real deployment -- prefer an
 * IAM role so credentials are short-lived and never touch disk.
 */
const { S3Client } = require('@aws-sdk/client-s3');
const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers');

let cachedClient = null;

function getS3Client() {
  if (cachedClient) return cachedClient;

  const region = process.env.AWS_REGION || 'us-east-1';
  const roleArn = process.env.AWS_ROLE_ARN;

  const credentials = roleArn
    ? fromTemporaryCredentials({
        params: {
          RoleArn: roleArn,
          RoleSessionName: 'docuvault-backend',
          // Optional but recommended if your role's trust policy requires it
          // (protects against the "confused deputy" problem for cross-account roles).
          ExternalId: process.env.AWS_ROLE_EXTERNAL_ID || undefined,
          DurationSeconds: 3600,
        },
      })
    : undefined; // undefined -> SDK falls back to its default provider chain

  cachedClient = new S3Client({
    region,
    credentials,
  });

  return cachedClient;
}

module.exports = { getS3Client };
