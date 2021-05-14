import {CheckQueueItem, OctokitApiResponse} from './types';
import { createHmac } from 'crypto';
import * as _ from 'lodash';
import {createAppAuth} from '@octokit/auth-app';
import HttpsProxyAgent from 'https-proxy-agent';
import {Octokit} from '@octokit/rest';
import {gheAppClientCredentials, OctokitUpdateCheckParams} from "./types";
import {PROJECT_ROOT, CHECK_TYPES} from './constants';
import {EVPC_APP_BINDINGS} from './keys';
import {getTestNamesFromPrBody} from "./prDescriptionParsers";
import octokitAPI from "./octokitAPI";
import { EpVmelementPrChecksApplication } from './application';
import {CHECK_CONCLUSION_TYPES, GHE_EVENT_TYPES} from './octokitConstants';

export async function updateCheckStatusToGithub(checkData:CheckQueueItem, extras?:object){
  const updateCheckParams:OctokitUpdateCheckParams = {
    installationClient: checkData.githubAppInstallationClient,
    owner: _.get(checkData.eventPayload, "owner", ""),
    repo: _.get(checkData.eventPayload, "repo", ""),
    checkRunId: _.get(checkData.eventPayload, "id"),
    checkName: checkData.name,
    startedAt: new Date().toISOString(),
    extras
  };
  const res:OctokitApiResponse = await octokitAPI.updateCheck(updateCheckParams);
  if (res.isSuccess === false){
    console.log(`Error Update Check: Check ID: ${_.get(checkData.eventPayload, "check_run.id")}, Check: ${checkData.name}`);
    throw new Error(`Exception while updating status to github: ${res.error}`);
  }
  return res;
}

export async function createAndQueueCheckRun(app:EpVmelementPrChecksApplication, appInstallationClient:Octokit, eventPayload:any, eventType: string){
  let checkCreationError = "";
  _.values(CHECK_TYPES).forEach( async checkName => {
    // Get the Head CommitSHA of the PR
    let headSha: string = "";
    let prDescription: string = "";
    let checkOwner:string = _.get(eventPayload, "sender.login");
    let checkRepo:string = _.get(eventPayload, "repository.name");
    let dataSet: boolean = false;

    if (eventType === GHE_EVENT_TYPES.PULL_REQUEST) {
      headSha = _.get(eventPayload, "pull_request.head.sha");
      prDescription = _.get(eventPayload, "pull_request.body");
      dataSet = true;

    } else if (eventType === GHE_EVENT_TYPES.CHECK_SUITE || eventType === GHE_EVENT_TYPES.CHECK_RUN) {
      const pullRequestsData = eventType === GHE_EVENT_TYPES.CHECK_SUITE
        ? _.get(eventPayload, "check_suite.pull_requests")
        : _.get(eventPayload, "check_run.check_suite.pull_requests");
      if (_.size(pullRequestsData) !== 1){
        checkCreationError = `The check suite requires exactly One pull request at a time for a commit, currently it's : ${_.size(pullRequestsData)}`
      }

      const res:OctokitApiResponse = await octokitAPI.getPullRequestData({
        installationClient: appInstallationClient,
        owner: checkOwner,
        repo: checkRepo,
        pullNumber: _.get(pullRequestsData, "[0].number")
      });

      if (res.isSuccess === false){
        console.log(`Error retreiving pull request information from check suite`);
        throw new Error(res.error);
      }
      headSha = _.get(res.data, "head.sha");
      prDescription = _.get(res.data, "body");
      dataSet = true;
    }
    if (dataSet === true){
      const checkCreationRes:OctokitApiResponse = await octokitAPI.createCheck({
        installationClient: appInstallationClient,
        owner: checkOwner,
        checkName,
        repo: checkRepo,
        headSha
      });

      if (checkCreationRes.isSuccess === false){
        console.log(`Failed to create Check: ${checkName} for commit: ${headSha}, error: ${checkCreationRes.error}`);
        return checkCreationRes.error;
      }

      const checksQueue = await app.get(EVPC_APP_BINDINGS.CHECKS_QUEUE);
      checksQueue.push({
        sha: headSha,
        githubAppInstallationClient: appInstallationClient,
        name: checkName,
        eventPayload: {
          owner: checkOwner,
          repo: checkRepo,
          ...checkCreationRes.data
        },
        testNames: getTestNamesFromPrBody(prDescription),
      });
      app.bind(EVPC_APP_BINDINGS.CHECKS_QUEUE).to(checksQueue);
    } else {
      await octokitAPI.createCheck({
        installationClient: appInstallationClient,
        owner: checkOwner,
        checkName,
        repo: checkRepo,
        headSha
      }).then(async ({data: checkData})=>{
        const updateCheckParams:OctokitUpdateCheckParams = {
          installationClient: appInstallationClient,
          owner: checkOwner,
          repo: checkRepo,
          checkRunId: _.get(checkData, "id"),
          checkName: checkName,
          startedAt: new Date().toISOString(),
          extras: {
            status: "completed",
            output: {
              title: "CHECK RESULTS",
              summary: "Fail",
              text: checkCreationError
            },
            conclusion: CHECK_CONCLUSION_TYPES.FAILURE
          }
        };
        await octokitAPI.updateCheck(updateCheckParams).catch(e=>e);
      }).catch(e=>e);
    }
  });
}

export class GheAppClient{
  private gheAPIBaseUrl: string;
  private gheAPPName: string;
  constructor(private args: gheAppClientCredentials, private proxyServer?: string){
    this.gheAPIBaseUrl = "https://github.hpe.com/api/v3";
    this.gheAPPName = "commit-checker";
  }

  _verifyWebhookSignature(payload: any, requestHeaders:any){
    const payloadRaw = JSON.stringify(payload);
    const signatureHeader = requestHeaders["x-hub-signature"];
    const [method, theirDiget] = _.split(signatureHeader, "=");
    const ourDigest = createHmac(method, this.args.webhookSecret)
      .update(payloadRaw)
      .digest('hex');
    if (theirDiget === ourDigest){
      console.log(`---- received event ${requestHeaders['x-github-event']}`);
      console.log(`---- action ${_.get(payload, 'action', 'N/A')}`);
    } else {
      throw new Error("401");
    }
  }

  getAuthenticatedInstallation(payload: any, requestHeaders: any){
    this._verifyWebhookSignature(payload, requestHeaders);
    const installationId = _.get(payload, "installation.id");

    return new Octokit({
      baseUrl: this.gheAPIBaseUrl,
      request: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        agent: new HttpsProxyAgent(this.proxyServer)
      },
      authStrategy: createAppAuth,
      userAgent: this.gheAPPName,
      auth: {
        appId: this.args.appIdentifier,
        privateKey: this.args.privateKey,
        installationId: installationId,
      },
    });
  }
}
