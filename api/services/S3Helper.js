const { S3, paginateListObjectsV2 } = require('@aws-sdk/client-s3');
const { retry } = require('../utils');

const S3_DEFAULT_MAX_KEYS = 1000;

class S3Client {
  constructor(credentials) {
    this.bucket = credentials.bucket;
    this.client = new S3({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
    });
  }

  waitForCredentials() {
    const { bucket, client } = this;
    return retry(() => client.headBucket({ Bucket: bucket }).promise(), { waitTime: 2000 });
  }

  async listCommonPrefixes(prefix) {
    /*
     * Returns a promise that resolves to an array of
     * the "Common Prefixes" of the S3 Objects
     * starting with the given prefix in the bucket
     * defined in the application's config.s3 object.
     */
    const paginationsConfig = { client: this.client };
    const listCommandInput = { Bucket: this.bucket, Prefix: prefix, Delimiter: '/' };

    const paginator = paginateListObjectsV2(paginationsConfig, listCommandInput);
    const commonPrefixes = [];
    for await (const page of paginator) {
      commonPrefixes.push(...page.CommonPrefixes);
    }

    return commonPrefixes;
  }

  async listObjects(prefix) {
    /*
     * Returns a promise that resolves to an array of
     * the S3 Objects starting with the given prefix in
     * the bucket defined in the application's config.s3 object.
     */
    const paginationsConfig = { client: this.client };
    const listCommandInput = { Bucket: this.bucket, Prefix: prefix, Delimiter: '/' };

    const paginator = paginateListObjectsV2(paginationsConfig, listCommandInput);
    const objects = [];
    for await (const page of paginator) {
      objects.push(...page.Contents);
    }

    return objects;
  }

  async listObjectsPaged(prefix, startAfterKey = null, totalMaxObjects = 200) {
    /*
     * Returns a promise that resolves to a potentially-truncated array of
     * the S3 Objects starting with the given prefix in
     * the bucket defined in the application's config.s3 object.
     * The object resolved by the promise will include an `isTruncated` flag
     * to indicate if the `files` array is truncated.
     */
    const maxKeys = Math.min(S3_DEFAULT_MAX_KEYS, totalMaxObjects);

    const paginationsConfig = {
      client: this.client,
      pageSize: maxKeys,
    };
    const listCommandInput = {
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: '/',
      StartAfter: startAfterKey,
    };

    const paginator = paginateListObjectsV2(paginationsConfig, listCommandInput);
    const objects = [];

    var wereS3ResultsTruncated = false;
    // Concatenate S3 pages until there are enough for OUR page size
    for await (const page of paginator) {
      objects.push(...page.Contents);
      if (objects.length >= totalMaxObjects) {
        break;
      }
      wereS3ResultsTruncated = page.isTruncated;
    }

    // Truncate results before returning if there are more than our page size
    const truncatedObjects = objects.slice(0, totalMaxObjects);
    var isTruncated = (wereS3ResultsTruncated || truncatedObjects.length < objects.length);

    return {
      isTruncated,
      objects: truncatedObjects,
    };
  }

  putObject(body, key, extras = {}) {
    const { bucket, client } = this;
    const params = {
      Body: body,
      Bucket: bucket,
      Key: key,
      ...extras,
    };

    return client.putObject(params).promise();
  }

  getObject(key, extras = {}) {
    const { bucket, client } = this;
    const params = {
      Bucket: bucket,
      Key: key,
      ...extras,
    };
    return client.getObject(params).promise();
  }
}

module.exports = { S3_DEFAULT_MAX_KEYS, S3Client };
