const { S3, paginateListObjectsV2 } = require('@aws-sdk/client-s3');
const { retry } = require('../utils');

const S3_DEFAULT_MAX_KEYS = 1000;

function shouldPageResults(totalMaxObjects, isTruncated, objects) {
  // We're ready to exit if the totalMaxObjects is defined, and
  // if either the response data are not truncated
  // or the current objects length is >= to the desired totalMaxObjects
  return totalMaxObjects && (!isTruncated || objects.length >= totalMaxObjects);
}

function createPagedResults(totalMaxObjects, isTruncated, objects) {
  // First, truncate the objects to the maximum total objects
  // or its length (slice will only go as far as the array's length)
  const truncatedObjects = objects.slice(0, totalMaxObjects);

  return {
    isTruncated,
    objects: truncatedObjects,
  };
}

function resolveCallback(resolve, reject) {
  return (err, objects) => {
    if (err) {
      reject(err);
    } else {
      resolve(objects);
    }
  };
}

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

  // TODO: Update this method next (WIP)
  async listObjectsPaged(prefix, startAfterKey = null, totalMaxObjects = 200) {
    console.log("S3Helper.S3Client.listObjects()");
    console.log(`  prefix: ${prefix}`);
    console.log(`  startAfterKey: ${startAfterKey}`);
    console.log(`  totalMaxObjects: ${totalMaxObjects}`);
    /*
     * Returns a promise that resolves to a potentially-truncated array of
     * the S3 Objects starting with the given prefix in
     * the bucket defined in the application's config.s3 object.
     * The object resolved by the promise will include an `isTruncated` flag
     * to indicate if the `files` array is truncated.
     */
    return new Promise((resolve, reject) => {
      const maxKeys = Math.min(S3_DEFAULT_MAX_KEYS, totalMaxObjects);

      this.listObjectsHelper(null,
        { Prefix: prefix, MaxKeys: maxKeys, StartAfter: startAfterKey },
        { totalMaxObjects },
        resolveCallback(resolve, reject));
    });
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

  // Private Methods
  async listObjectsHelper(currObjects, extraS3Params = {}, opts = {}, callback) {
    const listObjectArgs = { Bucket: this.bucket, ...extraS3Params };

    const command = new ListObjectsV2Command(listObjectArgs);

    try {
      response = await this.client.send(command);

      const aggregationKey = opts.aggregationKey || 'Contents';
      const { totalMaxObjects } = opts;

      const objects = currObjects ? currObjects.concat(data[aggregationKey])
        : data[aggregationKey];

      // if the number of results should be limited
      if (shouldPageResults(totalMaxObjects, data.IsTruncated, objects)) {
        // then callback with the paged results
        return callback(null, createPagedResults(totalMaxObjects, data.IsTruncated, objects));
      }
      // otherwise continue as normal (ie, not paged)
      if (data.IsTruncated) {
        const newExtraParams = {
          ...extraS3Params,
          ContinuationToken: data.NextContinuationToken,
        };
        // call recursively
        return this.listObjectsHelper(objects, newExtraParams, opts, callback);
      }
      // else done !
      return callback(null, objects);
    } catch(err) {
      console.log("Oh no!");
      return callback(err);
    };
  }
}

module.exports = { S3_DEFAULT_MAX_KEYS, S3Client };
