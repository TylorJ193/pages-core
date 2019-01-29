const expect = require('chai').expect;
const proxyquire = require('proxyquire').noCallThru();
const factory = require('../../support/factory');
const MockGitHub = require('../../support/mockGitHub');
const { SiteUser } = require('../../../../api/models');

const SiteUserAuditor = proxyquire('../../../../api/services/SiteUserAuditor', { './GitHub': MockGitHub });


describe('SiteUserAuditor', () => {
  context('auditAllUsers', () => {
    it('it should remove sites without push from user and site w/o repo', (done) => {
      let user;

      factory.user()
        .then((model) => {
          user = model;
          return Promise.resolve();
        })
        .then(() => MockGitHub.getRepositories(user.githubAccessToken))
        .then((repositories) => {
          const sites = [];
          repositories.forEach((r) => {
            const fullName = r.full_name.split('/');
            const owner = fullName[0];
            const repository = fullName[1];
            sites.push(factory.site({ owner, repository, users: [user] }));
          });
          sites.push(factory.site({ owner: 'owner', repository: 'remove-repo', users: [user] }));
          return Promise.all(sites);
        })
        .then(() => SiteUser.findAll({ where: { user_sites: user.id } }))
        .then((siteUsers) => {
          expect(siteUsers.length).to.eql(11);
          return SiteUserAuditor.auditAllUsers();
        })
        .then(() => SiteUser.findAll({ where: { user_sites: user.id } }))
        .then((siteUsers) => {
          expect(siteUsers.length).to.eql(9);
          done();
        })
        .catch(done);
    });
  });

  context('auditAllSites', () => {
    it('should remove user from site if not push collaborator', (done) => {
      let site;
      const owner = 'owner';
      const repository = 'repo';

      MockGitHub.getCollaborators('githubAccessToken', owner, repository)
        .then((collaborators) => {
          const users = [];
          collaborators.forEach(collab => users.push(factory.user({ username: collab.login })));
          users.push(factory.user({ username: 'non-collab' }));
          return Promise.all(users);
        })
        .then(users => factory.site({ owner, repository, users }))
        .then((model) => {
          site = model;
          return SiteUser.findAll({ where: { site_users: site.id } });
        })
        .then(siteUsers => Promise.resolve(expect(siteUsers.length).to.eql(11)))
        .then(() => SiteUserAuditor.auditAllSites())
        .then(() => SiteUser.findAll({ where: { site_users: site.id } }))
        .then((siteUsers) => {
          expect(siteUsers.length).to.eql(9);
          done();
        })
        .catch(done);
    });
  });
});
