import {Octokit} from '@octokit/rest';
import * as _ from 'lodash';

export type gheAppClientCredentials = {
  privateKey: string,
  webhookSecret: string,
  appIdentifier: string,
}

export type prCheckAppArgs = {
  gheAppClientCredentials: gheAppClientCredentials,
  pyLinterConfigFilePath: string,
  psLinterConfigFilePath: string,
  lintCheckOmmitedPaths: Array<string>,
  lockedFilePaths: Array<string>,
  reportsDirectoryPath: string,
  testRootDirectoryInCodebase: string,
}

export type FileChangedBetweenCommits = {
  upDirection: Array<string>,
  downDirection: Array<string>
}

export type CommitDiffSet = {
  head: string,
  base: string
}

export type CheckQueueItem = {
  sha: string,
  githubAppInstallationClient: Octokit,
  eventPayload: object;
  name: string;
  testNames: Array<string>;
};

export type CheckOutput = {
  title: string,
  summary: string,
  text: string
}

export type CheckResult = {
  checkOutput: CheckOutput,
  conclusion: string
}

export type AppHelperServiceSetupArgs = {
  reportsDirectoryPath: string,
  reportsFileServerPort: number,
  smeeChannelId?: string,
  appServerBaseUrl?: string
}

export type appStartUserInput = {
  un: string | null,
  tk: string | null
}

export type OctokitCreateCheckParams = {
  installationClient: Octokit,
  owner: string,
  repo: string,
  headSha: string
  checkName: string
}

export type OctokitUpdateCheckParams = {
  installationClient: Octokit,
  owner: string,
  repo: string,
  checkRunId: string,
  checkName: string,
  startedAt?: string,
  extras?: { [key: string]: any },

}

export type OctokitPullRequestGetParams = {
  installationClient: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
}

export type OctokitApiResponse = {
  isSuccess: boolean,
  error?: string,
  errorText?: string,
  message?: string,
  data?: { [key: string]: any }
}
