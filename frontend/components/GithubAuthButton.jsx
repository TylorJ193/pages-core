/* global window */
import React from 'react';
import PropTypes from 'prop-types';

import globals from '../globals';
import api from '../util/federalistApi';
import { IconGitHub } from './icons';

const apiUrl = globals.APP_HOSTNAME;
const path = '/auth/github2';

const calcWindow = () => ({
  width: 800,
  height: 800,
  left: window.screen.width / 2 - 800 / 2,
  top: window.screen.height / 2 - 800 / 2,
});

function authorize(revokeFirst) {
  const authPromise = () => new Promise((resolve, reject) => {
    const url = `${apiUrl}${path}`;

    const {
      width, height, top, left,
    } = calcWindow();

    const opts = `resizable=yes,scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

    const authWindow = window.open(url, 'authWindow', opts);

    const handleMessage = (e) => {
      if (e.origin === apiUrl && e.data === 'success') {
        authWindow.close();
        return resolve(true);
      }
      return reject(new Error('Authentication failed'));
    };

    window.addEventListener('message', handleMessage, { once: true });

    authWindow.focus();
  });

  if (revokeFirst) {
    return api.revokeApplicationGrant().then(authPromise);
  }
  return authPromise();
}

const GithubAuthButton = ({
  onFailure, onSuccess, text, revokeFirst,
}) => (
  <div className="well-gray-lightest">
    <p>{text}</p>
    <button
      type="button"
      className="usa-button github-auth-button"
      onClick={
        () => authorize(revokeFirst)
          .then(onSuccess)
          .catch(onFailure)
      }
    >
      <IconGitHub />
      {' '}
      Connect with Github
    </button>
  </div>
);

GithubAuthButton.propTypes = {
  onFailure: PropTypes.func,
  onSuccess: PropTypes.func,
  text: PropTypes.string.isRequired,
  revokeFirst: PropTypes.bool,
};

GithubAuthButton.defaultProps = {
  onFailure: () => {},
  onSuccess: () => {},
  revokeFirst: false,
};

export default GithubAuthButton;
