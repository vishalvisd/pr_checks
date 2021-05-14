import path from "path";
import {LOCAL_CODEBASE_DIRECTORY_PATH} from './constants';
import {SimpleGit, SimpleGitOptions} from 'simple-git';
import simpleGit from 'simple-git';
import {FileChangedBetweenCommits, CommitDiffSet} from './types';
import * as _ from 'lodash';
import * as fs from 'fs';
import execSh from 'exec-sh';
import {acquireLock, releaseLock} from "./lockUtil";

const execShPromise = execSh.promise;

export let git:SimpleGit;

let gitService;
let remoteRepo = "";

function initService(remote:string){
  const simpleGitOptions: Partial<SimpleGitOptions> = {
    baseDir: LOCAL_CODEBASE_DIRECTORY_PATH,
    binary: 'git'
  };
  if (fs.existsSync(LOCAL_CODEBASE_DIRECTORY_PATH) === false) {
    // Create a directory to hold the repository code.
    console.log(`Creating directory ${LOCAL_CODEBASE_DIRECTORY_PATH} for cloning git repository`);
    fs.mkdirSync(LOCAL_CODEBASE_DIRECTORY_PATH);
  }
  git = simpleGit(simpleGitOptions);
  remoteRepo = remote
}

async function bringLocalCodebaseToCommitSHA(commitSHA: string){
  const functionLockIdentity = "gitService_bringLocalCodebaseToCommitSHA";
  await acquireLock(functionLockIdentity);

  try {
    const temporaryGitRemote = "tempgitremote";
    // For sanity remove the temporaryGitRemote if such named remote already exits
    await git.removeRemote(temporaryGitRemote).catch(e => e);

    // Now add the remote configured with https instead ssl having
    // user github credentials [this remote will be removed after doing transactions with github and git in the upcoming expressions.]
    await git.addRemote(temporaryGitRemote, remoteRepo).catch(e => {
      // If we fail here, we exit this functionality by throwing error.
      throw new Error(e);
    });

    // Do git fetch, so that the local git will have knowledge of all those commits not present in local.
    await git.fetch([temporaryGitRemote]).catch(e=>{
      // If we fail here, we exit this functionality by throwing error.
      throw new Error(e);
    });

    // Bring the local code to the commit being inspected - the headSha
    await git.checkout(commitSHA, {"-f": null}).catch(e => {
      // If we fail here, we exit this functionality by throwing error.
      throw new Error(e);
    });

    // Done with getting the code from remote repo, hence now remove the https remote
    await git.removeRemote(temporaryGitRemote).catch(e => e);
  } catch(e){
    throw new Error(e);
  } finally {
    releaseLock(functionLockIdentity);
  }
}

async function getFileChangedBetweenCommits(commits:CommitDiffSet): Promise<FileChangedBetweenCommits>{
  const functionLockIdentity = "gitService_getFileChangedInPR";
  await acquireLock(functionLockIdentity);

  try {
    const headSha = commits.head;
    const baseSha = commits.base;

    const {stdout: upDiffRes, stderr: upDiffError} = await execShPromise(`cd ${LOCAL_CODEBASE_DIRECTORY_PATH} && git diff --name-status ${baseSha}..${headSha}`, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));
    const {stdout: downDiffRes, stderr: downDiffError} = await execShPromise(`cd ${LOCAL_CODEBASE_DIRECTORY_PATH} && git diff --name-status ${headSha}..${baseSha}`, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));

    if (upDiffError) throw new Error(upDiffError);
    if (downDiffError) throw new Error(downDiffError);

    const upLines = _.split(upDiffRes, "\n");
    const downLines = _.split(downDiffRes, "\n");
    return {
      upDirection: _.map(upLines, line =>_.get(_.split(line, "\t"), "[1]")),
      downDirection: _.map(downLines, line =>_.get(_.split(line, "\t"), "[1]"))
    }
  } catch (e){
    throw new Error(e);
  } finally {
    releaseLock(functionLockIdentity);
  }
}

async function getHeadCommitIdOfRemoteBranch(branch:string):Promise<string>{
  const {stdout: res, stderr: err} = await execShPromise(`cd ${LOCAL_CODEBASE_DIRECTORY_PATH} && git ls-remote ${remoteRepo} refs/heads/${branch}`, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));
  return _.isEmpty(err) ?  _.get(_.map(_.split(res, "\t"), _.trim), "[0]") : "";
}

export const GitService = (()=>{
  if (gitService){
    return gitService;
  } else {
    gitService = {
      initService,
      bringLocalCodebaseToCommitSHA,
      getFileChangedBetweenCommits: getFileChangedBetweenCommits,
      getHeadCommitIdOfRemoteBranch: getHeadCommitIdOfRemoteBranch
    };
    return gitService;
  }
})();
