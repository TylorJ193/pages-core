const nock = require('nock');
const { expect } = require('chai');

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { mockClient } = require('aws-sdk-client-mock');
const mockTokenRequest = require('../../support/cfAuthNock');
const apiNocks = require('../../support/cfAPINocks');
const factory = require('../../support/factory');
const S3SiteRemover = require('../../../../api/services/S3SiteRemover');

const s3ServiceName = 'site-service';
const s3ServiceGuid = 'site-service-guid';
const awsBucketName = 'site-bucket-name';

function createServiceNocks(serviceName, guid, bucketName) {
  const serviceInstanceResponse = factory.responses.service({
    guid,
  }, {
    name: serviceName,
  });
  apiNocks.mockFetchServiceInstancesRequest({ resources: [serviceInstanceResponse] }, serviceName);

  const credentialsReponse = factory.responses.service({}, {
    credentials: factory.responses.credentials({
      access_key_id: '',
      secret_access_key: '',
      region: '',
      bucket: bucketName,
    }),
    guid,
  });
  apiNocks.mockFetchServiceInstanceCredentialsRequest(guid, { resources: [credentialsReponse] });
}

describe.only('S3SiteRemover', () => {
  beforeEach(() => {
    createServiceNocks(s3ServiceName, s3ServiceGuid, awsBucketName);
  });

  afterEach(() => nock.cleanAll());

  describe('.removeSite(site)', () => {
    it.only('should delete all objects in the site\'s S3 bucket', (done) => {
      let site;
      const objectsToDelete = [
        'site/owner/repo/index.html',
        'demo/owner/repo/redirect',
        '_cache/asdfhjkl',
        'site/owner/repo',
        'demo/owner/repo',
        '_cache',
        'robots.txt',
      ];

      const s3Mock = mockClient(S3Client);
      s3Mock
      .on(ListObjectsV2Command).resolves({
        IsTruncated: false,
        Contents: objectsToDelete.map(object => ({ Key: object })),
        ContinuationToken: "A",
        NextContinuationToken: null,
      })
      .on(DeleteObjectsCommand, {
        Contents: objectsToDelete.map(object => ({ Key: object }))
      }).resolves({});

      mockTokenRequest();
      apiNocks.mockDefaultCredentials();

      factory.site({
        awsBucketName,
        s3ServiceName,
      }).then((model) => {
        site = model;
        return S3SiteRemover.removeSite(site);
      }).then(() => {
        expect(s3Mock).toHaveReceivedCommand(ListObjectsV2Command);
        expect(s3Mock).toHaveReceivedCommand(DeleteObjectsCommand);
        done();
      })
    });

    it('should resolve if no bucket exists', (done) => {
      mockTokenRequest();
      apiNocks.mockDefaultCredentials(false);

      factory.site()
        .then(site => S3SiteRemover.removeSite(site))
        .then(done);
    });
  });

  describe('.removeInfrastructure', () => {
    it('should delete the bucket and proxy route service when site is in a private bucket', (done) => {
      let site;
      const s3Service = 'this-is-a-s3-service';
      const s3Guid = '8675-three-o-9';
      const routeName = 'route-hostname-is-bucket-name';
      const routeGuid = 'bev-hills-90210';

      mockTokenRequest();
      apiNocks.mockDeleteService(s3Service, s3Guid);
      apiNocks.mockDeleteRoute(routeName, routeGuid);

      factory.site({
        s3ServiceName: s3Service,
        awsBucketName: routeName,
      }).then((model) => {
        site = model;

        return S3SiteRemover.removeInfrastructure(site);
      }).then((res) => {
        expect(res.metadata.guid).to.equal(s3Guid);
        done();
      });
    });

    it('should resolve when services do not exist', (done) => {
      let site;
      const s3Service = 'this-is-a-s3-service';
      const s3Guid = '8675-three-o-9';
      const routeName = 'route-hostname-is-bucket-name';
      const routeGuid = 'bev-hills-90210';

      mockTokenRequest();
      apiNocks.mockDeleteService(s3Service, s3Guid, false);
      apiNocks.mockDeleteRoute(routeName, routeGuid, false);

      factory.site({
        s3ServiceName: s3Service,
        awsBucketName: routeName,
      }).then((model) => {
        site = model;

        return S3SiteRemover.removeInfrastructure(site);
      })
        .then(done);
    });
  });
});
