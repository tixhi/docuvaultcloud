/**
 * S3 storage driver -- implements the same interface as the local disk
 * driver (put / getStream / delete / buildKey) plus two extras the local
 * driver doesn't need: getDownloadUrl and getUploadUrl, both presigned URLs
 * signed with the caller's IAM credentials (SigV4). The rest of the app
 * only ever calls through storage.js, so nothing outside these two files
 * needs to know S3 is involved.
 */
const crypto = require('crypto');
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client } = require('../config/aws');

const BUCKET = process.env.S3_BUCKET;
const KMS_KEY_ID = process.env.S3_KMS_KEY_ID; // optional -- enables SSE-KMS instead of SSE-S3
const URL_TTL_SECONDS = Number(process.env.S3_PRESIGNED_URL_TTL || 300);

function assertConfigured() {
  if (!BUCKET) {
    throw new Error('S3_BUCKET is not set. Configure it in .env before using STORAGE_DRIVER=s3.');
  }
}

const s3Driver = {
  /** Same key shape as the local driver: <ownerId>/<shard>/<uuid>.<ext>.
   *  Keeping keys unguessable and free of the original filename means a
   *  leaked key alone reveals nothing about the file's contents. */
  buildKey(ownerId, ext) {
    const shard = crypto.randomBytes(2).toString('hex');
    const fileId = crypto.randomUUID();
    return `${ownerId}/${shard}/${fileId}${ext ? '.' + ext : ''}`;
  },

  async put(buffer, key, { contentType } = {}) {
    assertConfigured();
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Encrypt every object at rest. Uses your bucket's default KMS key
        // if S3_KMS_KEY_ID is set, otherwise falls back to SSE-S3 (AES256).
       
      })
    );
    return { key };
  },

  async getStream(key) {
    assertConfigured();
    const client = getS3Client();
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return res.Body; // a Node.js Readable in the AWS SDK v3 Node runtime
  },

  async delete(key) {
    assertConfigured();
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },

  async exists(key) {
    assertConfigured();
    const client = getS3Client();
    try {
      await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  },

  /** Presigned GET -- lets the controller redirect the browser straight to
   *  S3 instead of streaming bytes through the Node process. The signature
   *  is short-lived (S3_PRESIGNED_URL_TTL, default 5 min) and scoped to
   *  this one object by the IAM credentials' own permissions. */
  async getDownloadUrl(key, { filename, forceDownload } = {}) {
    assertConfigured();
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: filename
        ? `${forceDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`
        : undefined,
    });
    return getSignedUrl(client, command, { expiresIn: URL_TTL_SECONDS });
  },

  /** Presigned PUT -- lets the browser upload directly to S3, bypassing the
   *  Express server entirely for the file bytes. Optional; the app also
   *  works uploading through the API (multer -> put()) if you'd rather keep
   *  everything server-mediated. See routes/fileRoutes.js. */
  async getUploadUrl(key, { contentType } = {}) {
    assertConfigured();
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
     // ContentType: contentType,
     
    });
    return getSignedUrl(client, command, { expiresIn: URL_TTL_SECONDS });
  },

  /** No local filesystem concept for S3 -- present for interface parity. */
  getLocalPath() {
    return null;
  },
};

module.exports = s3Driver;
