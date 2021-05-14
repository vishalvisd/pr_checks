import {OctokitCreateCheckParams, OctokitUpdateCheckParams, OctokitPullRequestGetParams, OctokitApiResponse} from "./types";
import * as _ from 'lodash';

async function updateCheck(args: OctokitUpdateCheckParams):Promise<OctokitApiResponse>{
  let apiRes: OctokitApiResponse = {
    isSuccess: false,
  };
  await args.installationClient.rest.checks.update({
    owner: args.owner,
    repo: args.repo,
    "check_run_id": args.checkRunId,
    name: args.checkName,
    "started_at": args.startedAt,
    mediaType: {
      previews: [
        'antiope'
      ]
    },
    ...args.extras
  }).then(()=>{
    apiRes.isSuccess = true;
  }).catch((e: any)=>{
    apiRes.isSuccess = false;
    apiRes.error = e;
  });
  return apiRes;
}

async function getPullRequestData(args: OctokitPullRequestGetParams):Promise<OctokitApiResponse>{
  let apiRes: OctokitApiResponse = {
    isSuccess: false,
  };
  await args.installationClient.rest.pulls.get({
    owner: args.owner,
    repo: args.repo,
    "pull_number": args.pullNumber
  }).then((res)=>{
    if (_.startsWith(`${res.status}`, "2")){
      apiRes.isSuccess = true;
      apiRes.data = res.data;
    }
  }).catch((e: any)=>{
    apiRes.isSuccess = false;
    apiRes.error = e;
  });
  return apiRes;
}

async function createCheck(args:OctokitCreateCheckParams):Promise<OctokitApiResponse>{
  let apiRes: OctokitApiResponse = {
    isSuccess: false,
  };
  await args.installationClient.rest.checks.create({
    owner: args.owner,
    name: args.checkName,
    repo: args.repo,
    "head_sha": args.headSha,
    mediaType: {
      previews: [
        'antiope'
      ]
    }
  }).then((res)=>{
    if (_.startsWith(`${res.status}`, "2")){
      apiRes.isSuccess = true;
      apiRes.data = res.data;
      const pullRequestsData = _.get(res.data, "pull_requests");
      if (_.size(pullRequestsData) === 1){
        apiRes.isSuccess = true;
      } else {
        apiRes.isSuccess = false;
        apiRes.error = "Pull request for commit not equal to 1";
        apiRes.errorText = `The check suite requires exactly One pull request at a time for a commit, currently it's : ${_.size(pullRequestsData)}`
      }
    }
  }).catch((e: any)=>{
    apiRes.isSuccess = false;
    apiRes.error = e;
  });
  return apiRes;
}

export default {
  updateCheck,
  getPullRequestData,
  createCheck
}
