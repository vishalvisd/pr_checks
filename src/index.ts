import path from "path";
import * as fs from "fs";
import * as _ from 'lodash';
import {gheAppClientCredentials, prCheckAppArgs} from './types';
import {PROJECT_ROOT, LOCAL_CODEBASE_DIRECTORY_PATH} from "./constants";
import { EpVmelementPrChecksApplication } from './application';
import {SmeeEventSequence} from './sequence';
import {LocalDebugSequence} from './sequenceLocalDebug';
import { ApplicationConfig } from '@loopback/core';
import * as dotenv from 'dotenv';
import getGitCredentailsInput from "./takeGitCredentialInputFromUser";
import {SetupRuntimeEnvironment} from './setupEnvironment';
import {SetupHelperServices} from "./setupHelperServices";
import {GitService} from "./gitService";
import {EVPC_APP_BINDINGS} from './keys';
export { EpVmelementPrChecksApplication };

export async function main(optionsOverride: ApplicationConfig = {}) {
  if(fs.existsSync(path.join(PROJECT_ROOT, ".env"))) {
    dotenv.config();
  } else {
    console.log(`
        ----------------------------------------------------------! WARNING !--------------------------------------------------------------
        | .env not present at the node process root. Add a .env file OR make sure you are setting required variables in the environment.  |
        -----------------------------------------------------------------------------------------------------------------------------------
    `);
  }
  const isCodeDevelopmentMode = _.indexOf(process.argv, "deveLo") !== -1;

  const options: ApplicationConfig = {
    rest: {
      host: process.env.APP_SERVER_HOST,
      port: _.toNumber(process.env.APP_SERVER_PORT)
    },
    ...optionsOverride
  };

  const appArgs:prCheckAppArgs = {
    gheAppClientCredentials: {
      // Converts the newlines. Expects that the private key has been set as an
      // environment variable in PEM format.
      privateKey: _.replace(<string>process.env.GITHUB_PRIVATE_KEY, /\\n/g, '\n'),
      // Registered app must have a secret set. The secret is used to verify
      // that webhooks are sent by GitHub.
      webhookSecret: <string>process.env.GITHUB_WEBHOOK_SECRET,
      // The GitHub App's identifier
      appIdentifier: <string>process.env.GITHUB_APP_IDENTIFIER,
    },
    pyLinterConfigFilePath: path.join(LOCAL_CODEBASE_DIRECTORY_PATH, <string>process.env.PATH_TO_FLAKE8_CONFIG_IN_CODEBASE),
    psLinterConfigFilePath: path.join(LOCAL_CODEBASE_DIRECTORY_PATH, <string>process.env.PATH_TO_PSLINT_CONFIG_IN_CODEBASE),
    lintCheckOmmitedPaths: _.map(_.split(<string>process.env.LINTTER_CHECK_OMITTED_PATHS, ","), _.trim),
    lockedFilePaths: _.map(_.split(<string>process.env.LOCKED_FILES, ","), p => path.join(PROJECT_ROOT, _.trim(p))),
    reportsDirectoryPath: path.join(PROJECT_ROOT, <string>process.env.CHECK_REPORTS_DIR_RELATIVE_PATH),
    testRootDirectoryInCodebase: path.join(LOCAL_CODEBASE_DIRECTORY_PATH, <string>process.env.TEST_ROOT_DIRECTORY_IN_CODEBASE)
  };
  const app = new EpVmelementPrChecksApplication(options, appArgs);

  app.sequence(isCodeDevelopmentMode ? LocalDebugSequence : SmeeEventSequence);

  await app.boot();

  const {un:gitUser, tk:gitPAT} = isCodeDevelopmentMode ? {un: null, tk: null} : await getGitCredentailsInput();
  // todo: remove the env variable gitremote, and refactor the code to use the remote from github event payload
  const gitRemote = `https://${gitUser}:${gitPAT}@${<string> process.env.GIT_REMOTE_NAME}`;
  GitService.initService(gitRemote);

  await new SetupRuntimeEnvironment(gitRemote).setup();

  app.bind(EVPC_APP_BINDINGS.GHE_API_PROXY_SERVER).to(<string>process.env.http_proxy);

  await app.start().then(()=>{
    const helperServices = new SetupHelperServices({
      reportsDirectoryPath: path.join(PROJECT_ROOT, <string>process.env.CHECK_REPORTS_DIR_RELATIVE_PATH),
      reportsFileServerPort: _.toNumber(process.env.REPORTS_FILE_SERVER_PORT),
      smeeChannelId: process.env.SMEE_CHANNEL,
      appServerBaseUrl: `http://${process.env.APP_SERVER_HOST}:${_.toNumber(process.env.APP_SERVER_PORT)}`
    });

    helperServices.startReportsFileServer();

    if(isCodeDevelopmentMode === false){
      helperServices.startSmeeClient();
    }
  });

  console.log(`Server is running at ${app.restServer.url}`);

  return app;
}
