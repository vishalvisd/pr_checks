import path from "path";
import dayjs from 'dayjs';
import PShell from 'node-powershell';
import {CheckOutput, CheckQueueItem, CheckResult} from './types';
import {PROJECT_ROOT, LOCAL_CODEBASE_DIRECTORY_PATH} from './constants';
import * as _ from 'lodash';
import execSh from 'exec-sh';
import * as fs from 'fs';
import * as util from 'util';
import {GitService} from "./gitService";
import {CHECK_CONCLUSION_TYPES} from "./octokitConstants";

const execShPromise = execSh.promise;
const readFile = util.promisify(fs.readFile);
const deleteFile = util.promisify(fs.unlink);

export default async function checkLintIssues(checkData: CheckQueueItem, pyLinterConfigFilePath:string, psLinterConfigFilePath:string, lintCheckOmmitedPaths:Array<string>, lintReportsDirectoryPath:string): Promise<CheckResult>{
  let checkOutput: CheckOutput;
  let isPyLintCheckPassed: boolean = false, isPwshLintCheckPassed: boolean = false;
  const linterRawResultsTempFile = path.join(PROJECT_ROOT, "lintRawResults.txt");
  try {
    // *** Get all files Changed in PR ****************************************************************************** //
    const headSha = _.get(checkData.eventPayload, "pull_requests[0].head.sha");
    const baseSha = _.get(checkData.eventPayload, "pull_requests[0].base.sha");
    const {upDirection: filesChangedInThePR} = await GitService.getFileChangedBetweenCommits({head: headSha, base: baseSha});

    // *** Filter python and powershell files Changed among changed files to run lint check ************************* //
    const pythonFilesChangedInThePR = _.filter(filesChangedInThePR, fileCodebasePath=>{
      return _.endsWith(fileCodebasePath, ".py");
    });

    const powershellFilesChangedInThePR = _.filter(filesChangedInThePR, fileCodebasePath=>{
      return _.endsWith(fileCodebasePath, ".psm1");
    });

    // *** Filter again based on ommited path defined in environment *************************************************//
    const linterCheckOmittedPathList = _.map(lintCheckOmmitedPaths, _.trim);

    const pythonFilteredFiles = _.filter(pythonFilesChangedInThePR, fileCodebasePath=> {
      const isOmmited = _.some(linterCheckOmittedPathList, omittedPath => _.startsWith(fileCodebasePath, omittedPath));
      return !isOmmited;
    });
    const powershellFilteredFiles = _.filter(powershellFilesChangedInThePR, fileCodebasePath=> {
      const isOmmited = _.some(linterCheckOmittedPathList, omittedPath => _.startsWith(fileCodebasePath, omittedPath));
      return !isOmmited;
    });

    // ***************************************************************************************************************//

    // For sanity delete temporary lint results file if it already exits
    await deleteFile(linterRawResultsTempFile).catch(e => e);

    // *** Run Flake8 linter and get the run results *****************************************************************//
    const flake8lintResultsSummary = [];
    for (const pythonFileCodebasePath of pythonFilteredFiles){
      const shellCommand = `flake8 --config=${pyLinterConfigFilePath} ${path.join(LOCAL_CODEBASE_DIRECTORY_PATH, `${pythonFileCodebasePath}`)} >> ${linterRawResultsTempFile}`;
      //.then(r => `${pythonFileCodebasePath} - Done`)
      const res = await execShPromise(shellCommand).catch(e => false);
      flake8lintResultsSummary.push(res);
    }
    const flake8RawResults = await readFile(linterRawResultsTempFile, 'utf8').catch(e => "");
    await deleteFile(linterRawResultsTempFile).catch(e => e);
    let flake8Results = _.split(flake8RawResults, "\n");
    isPyLintCheckPassed = _.includes(flake8lintResultsSummary, false) === false;

    // *** Now run the powershell linter PSScript analyser to check lint issues with powershell files ****************//
    const ps = new PShell({
      executionPolicy: 'Bypass',
      noProfile: true
    });
    // For sanity delete temporary lint results file if it already exits
    await deleteFile(linterRawResultsTempFile).catch(e => e);
    for (const powershellFileCodebasePath of powershellFilteredFiles){
      const shellCommand = `Invoke-ScriptAnalyzer -Path  ${path.join(LOCAL_CODEBASE_DIRECTORY_PATH, powershellFileCodebasePath)} -CustomRulePath ${psLinterConfigFilePath} >> ${linterRawResultsTempFile}`;
      ps.addCommand(shellCommand);
    }
    const psinvokeres = await ps.invoke();
    console.log(psinvokeres);

    // Invoke-ScriptAnalyzer -Path [path to folder/file] -CustomRulePath [path to rule file]
    const pwshLinterRawResults = await readFile(linterRawResultsTempFile, 'utf8').catch(e => "");
    await deleteFile(linterRawResultsTempFile).catch(e => e);
    isPwshLintCheckPassed = _.size(_.trim(pwshLinterRawResults)) === 0;

    const psLinterResults = _.split(pwshLinterRawResults, "\n");

    // *** Generate the combined report file and put the file at the specified location for hosting ******************//
    const lintResultsFile = `lintCheck_${_.get(checkData.eventPayload, "head_sha")}_${dayjs().format("MM-DD-YYYY-hhmmss")}.txt`;
    const lintResultsFilePath = path.join(lintReportsDirectoryPath, lintResultsFile);
    _.forEach(flake8Results, line => fs.appendFile(lintResultsFilePath, `${path.relative(LOCAL_CODEBASE_DIRECTORY_PATH, line)} \n`, err=>{
      if (err){
        console.log("Error writing flake8 Results");
      }
    }));

    _.forEach(psLinterResults, line => fs.appendFile(lintResultsFilePath, `${line} \n`, err=>{
      if (err){
        console.log("Error writing ps analyzer results");
      }
    }));

    checkOutput = {
      title: "CHECK RESULTS",
      summary: isPyLintCheckPassed && isPwshLintCheckPassed ? "Success" : "Failure",
      text: isPyLintCheckPassed && isPwshLintCheckPassed ? "" : `http://16.83.110.59:8889/${lintResultsFile}`
    };
  } catch(e){
    checkOutput = {
      title: "CHECK RESULTS",
      summary: "Error during check run",
      text: `${e}`
    };
  } finally {
    await deleteFile(linterRawResultsTempFile).catch(e => e);
  }

  return {
    checkOutput,
    conclusion: checkOutput.summary === "Success" ? CHECK_CONCLUSION_TYPES.SUCCESS : CHECK_CONCLUSION_TYPES.FAILURE
  };
}