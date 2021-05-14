import path from "path";
import {CheckOutput, CheckQueueItem, CheckResult} from './types';
import {LOCAL_CODEBASE_DIRECTORY_PATH} from './constants';
import * as _ from 'lodash';
import {GitService} from "./gitService";
import {CHECK_CONCLUSION_TYPES} from "./octokitConstants";

export default async function lockedFileModificationCheck(checkData: CheckQueueItem, lockedFilesPath: Array<string>): Promise<CheckResult>{
  let checkOutput: CheckOutput;
  let checkPassed: boolean = false;
  try {
    // *** Get all files Changed in PR ****************************************************************************** //
    const headSha = _.get(checkData.eventPayload, "pull_requests[0].head.sha");
    const baseSha = await GitService.getHeadCommitIdOfRemoteBranch(_.get(checkData.eventPayload, "pull_requests[0].base.ref"));
    let {upDirection: filesChangedInThePR, downDirection: fileChangedInBase} = await GitService.getFileChangedBetweenCommits({head: headSha, base: baseSha});
    filesChangedInThePR = _.map(filesChangedInThePR, fc => fc ? path.join(LOCAL_CODEBASE_DIRECTORY_PATH, fc) : "");
    fileChangedInBase = _.map(fileChangedInBase, fc => fc ? path.join(LOCAL_CODEBASE_DIRECTORY_PATH, fc) : "");

    const lockedFileList = _.map(lockedFilesPath, _.trim);

    const lockedFilesChangedLocally = _.intersectionWith(filesChangedInThePR, lockedFileList, _.isEqual);

    const lockedFilesChangedRemotely = _.intersectionWith(fileChangedInBase, lockedFileList, _.isEqual);

    if(_.isEmpty(lockedFilesChangedLocally) && _.isEmpty(lockedFilesChangedRemotely)){
      checkPassed = true;
    }

    const lockedFileChangedLocallyMessage = _.isEmpty(lockedFilesChangedLocally) ? "Local: None" : "Local: " + _.join(_.map(lockedFilesChangedLocally, f => path.basename(f)), ", ");
    const lockedFileChangedRemotelyMessage = _.isEmpty(lockedFilesChangedRemotely) ? "Remote: None" : "Remote: " + _.join(_.map(lockedFilesChangedRemotely, f => path.basename(f)), ", ");

    checkOutput = {
      title: "CHECK RESULTS",
      summary: checkPassed ? "Success" : "Failure",
      text: checkPassed ? `No locked file changes` : `Locked Files changed: ${lockedFileChangedLocallyMessage}; ${lockedFileChangedRemotelyMessage}. 
      The check may fail if locked file is modified at the base branch end- pull from base and update the PR`
    };
  } catch(e){
    checkOutput = {
      title: "CHECK RESULTS",
      summary: "Error during check run",
      text: `${e}`
    };
  }

  return {
    checkOutput,
    conclusion: checkOutput.summary === "Success" ? CHECK_CONCLUSION_TYPES.SUCCESS : CHECK_CONCLUSION_TYPES.FAILURE
  };
}