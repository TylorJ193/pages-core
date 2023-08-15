const S3Helper = require('./S3Helper');
const { paginateListObjectsV2, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const CloudFoundryAPIClient = require('../utils/cfApiClient');

// handle error if service is not found and throw all other errors
const handleError = (err) => {
  try {
    if (!err.message.match(/Not found/)) {
      throw err;
    }
  } catch (e) {
    throw err;
  }
};

const apiClient = new CloudFoundryAPIClient();

const removeInfrastructure = site => apiClient.deleteRoute(site.awsBucketName)
  .catch(handleError) // if route does not exist continue to delete service instance
  .then(() => apiClient.deleteServiceInstance(site.s3ServiceName))
  .catch(handleError); // if service instance does not exist handle error & delete site

/**
  Deletes all of the objects in the S3 bucket belonging to the specified site.
*/
const removeSite = async (site) => {
  let credentials;
  try {
    try {
      credentials = await apiClient.fetchServiceInstanceCredentials(site.s3ServiceName);
    } catch (err) {
      if (!err.message.match(/Not found/)) {
        throw err;
      }
      const service = await apiClient.fetchServiceInstance(site.s3ServiceName);
      await apiClient.createServiceKey(site.s3ServiceName, service.metadata.guid);
      credentials = await apiClient.fetchServiceInstanceCredentials(site.s3ServiceName);
    }

    console.log("S3SiteRemover.removeSite() about to initialize the S3Client");
    const s3Client = new S3Helper.S3Client({
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.secret_access_key,
      region: credentials.region,
      bucket: credentials.bucket,
    });

    console.log(`s3Client: $(s3Client)`);

    // Added to wait until AWS credentials are usable in case we had to
    // provision new ones. This may take up to 10 seconds.
    await s3Client.waitForCredentials();



    // Iterate by page over all of the objects in the bucket
    const paginationsConfig = { client: s3Client.client };
    const listCommandInput = { Bucket: s3Client.bucket, Delimiter: '/' };

    console.log("S3SiteRemover.removeSite() about to iterate over paginated bucket objects");
    const paginator = paginateListObjectsV2(paginationsConfig, listCommandInput);
    for await (const page of paginator) {
      // Delete all of the objects in the current page
      const commandInput = {
        Bucket: s3Client.bucket,
        Delete: {
          Objects: page.Contents.map(object => ({ Key: object.key })),
        }
      };
      command = new DeleteObjectsCommand(commandInput);
      console.log("S3SiteRemover.removeSite() about to delete a page of objects");
      await s3Client.client.send(command);
    }
  } catch (error) {
    handleError(error);
  }
};

module.exports = {
  removeInfrastructure,
  removeSite,
};
