import React from 'react';
import { Route, redirect } from 'react-router-dom';

import App from './components/app';
import * as Organization from './components/organization';
import UserSettings from './components/user/Settings';
import SiteList from './components/siteList/siteList';
import SiteContainer from './components/siteContainer';
import SiteBuilds from './components/site/siteBuilds';
import SiteBuildLogs from './components/site/siteBuildLogs';
import SitePublishedBranchesTable from './components/site/sitePublishedBranchesTable';
import SitePublishedFilesTable from './components/site/SitePublishedFilesTable';
import SiteSettings from './components/site/SiteSettings';
import AddSite from './components/AddSite';
import NotFound from './components/NotFound';
import Error from './components/Error';

import siteActions from './actions/siteActions';
import userActions from './actions/userActions';
import organizationActions from './actions/organizationActions';

const { NODE_ENV } = process.env;

let ErrorElement = null;
if (NODE_ENV !== 'development') {
  ErrorElement = <Error />;
}

const fetchInitialData = () => {
  userActions.fetchUser();
  siteActions.fetchSites();
  organizationActions.fetchOrganizations();
};

export default (
  <Route path="/" element={<App onEnter={fetchInitialData} />} errorElement={ErrorElement}>
    <Route path="organizations" element={<Organization.List />} />
    <Route path="organizations/:id" element={<Organization.Edit />} />
    <Route path="sites" element={<SiteList />} />
    <Route path="sites/new" element={<AddSite />} />
    <Route path="sites/:id" element={<SiteContainer />}>
      <Route path="" loader={() => redirect('builds')} />
      <Route path="settings" element={<SiteSettings />} />
      <Route path="published" element={<SitePublishedBranchesTable />} />
      <Route path="published/:name" element={<SitePublishedFilesTable />} />
      <Route path="builds" element={<SiteBuilds />} />
      <Route path="builds/:buildId/logs" element={<SiteBuildLogs />} />
    </Route>
    <Route path="settings" element={<UserSettings />} />
    <Route path="*" element={<NotFound />} />
  </Route>
);
