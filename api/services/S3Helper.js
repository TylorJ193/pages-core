const AWS = require('aws-sdk');

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

  const pagedResults = {
    isTruncated,
    objects: truncatedObjects,
  };

  return pagedResults;
}

function createWebsiteParams(bucket) {
  return {
    Bucket: bucket,
    WebsiteConfiguration: {
      ErrorDocument: {
        Key: '404.html',
      },
      IndexDocument: {
        Suffix: 'index.html',
      },
    },
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
    this.client = new AWS.S3({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
    });
  }

  listCommonPrefixes(prefix) {
    /*
     * Returns a promise that resolves to an array of
     * the "Common Prefixes" of the S3 Objects
     * starting with the given prefix in the bucket
     * defined in the application's config.s3 object.
     */
    return new Promise((resolve, reject) => {
      this.listObjectsHelper(null,
        { Prefix: prefix, Delimiter: '/' },
        { aggregationKey: 'CommonPrefixes' },
        resolveCallback(resolve, reject));
    });
  }

  listObjects(prefix) {
    /*
     * Returns a promise that resolves to an array of
     * the S3 Objects starting with the given prefix in
     * the bucket defined in the application's config.s3 object.
     */
    return new Promise((resolve, reject) => {
      this.listObjectsHelper(null,
        { Prefix: prefix },
        {},
        resolveCallback(resolve, reject));
    });
  }

  listObjectsPaged(prefix, startAfterKey = null, totalMaxObjects = 200) {
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

  putBucketWebsite(max = 10) {
    let attempt = 0;
    const { client } = this;
    const params = createWebsiteParams(this.bucket);

    return new Promise((resolve, reject) => {
      const request = (res, rej) => {
        client.putBucketWebsite(params, (err, data) => {
          if (err && attempt < max) {
            attempt += 1;
            return request(res, rej);
          }

          if (err && attempt >= max) return rej(err);

          return res(data);
        });
      };

      request(resolve, reject);
    });
  }

  // Private Methods
  listObjectsHelper(currObjects, extraS3Params = {}, opts = {}, callback) {
    const listObjectArgs = Object.assign({}, {
      Bucket: this.bucket,
    }, extraS3Params);

    this.client.listObjectsV2(listObjectArgs, (err, data) => {
      if (err) {
        return callback(err);
      }

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
        const newExtraParams = Object.assign({},
          extraS3Params,
          { ContinuationToken: data.NextContinuationToken });
        // call recursively
        return this.listObjectsHelper(objects, newExtraParams, opts, callback);
      }
      // else done !
      return callback(null, objects);
    });
  }
}

module.exports = { S3_DEFAULT_MAX_KEYS, S3Client };
