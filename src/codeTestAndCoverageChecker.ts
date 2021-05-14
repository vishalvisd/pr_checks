import path from "path";
import {CheckOutput, CheckQueueItem, CheckResult} from './types';
import {CODEBASE_SCID_FOLDER_PATH} from "./constants";
import dayjs from 'dayjs';
import * as _ from 'lodash';
import execSh from 'exec-sh';
import * as fs from 'fs';
import * as util from 'util';
import {CHECK_CONCLUSION_TYPES} from './octokitConstants';

const execShPromise = execSh.promise;
const readDir = util.promisify(fs.readdir);

const TESTS_IN_TEST_ROOT_PATH = "test_src";

export default async function codeTestAndCoverageCheck(
  checkData:CheckQueueItem,
  testDirectoryPath:string,
  coverageReportsDirectoryPath:string
): Promise<CheckResult>{
  let checkOutput: CheckOutput;
  try {
    const testingResultsFileName = `testCheck_${_.get(checkData.eventPayload, "head_sha")}_${dayjs().format("MM-DD-YYYY-hhmmss")}.txt`;

    const testNamesToRun = checkData.testNames;

    // get all the test in tests source directory
    const testNamesAvailable = await readDir(path.join(testDirectoryPath, TESTS_IN_TEST_ROOT_PATH)).catch(e=>[]);
    const checksSkipping = _.difference(testNamesAvailable, testNamesToRun);

    // todo: improvement to the logic - instead _.size, use names to compare
    if (_.isEmpty(testNamesToRun) || _.size(testNamesAvailable) === _.size(checksSkipping)) {
      checkOutput = {
        title: "CHECK RESULTS",
        summary: "No test name/s provided in PR description to run",
        text: `Please provide comma separated test names in the PR description. 
        The suite will run those test/s and provide the test and it's coverage report`
      };
    } else {
      const pytestTestIgnore = _.join(_.map(checksSkipping, v => `--ignore ${TESTS_IN_TEST_ROOT_PATH}/${v}`), " ");

      const filesInCodebaseScidDirectory = await readDir(CODEBASE_SCID_FOLDER_PATH).catch(e=>[]);
      const codebaseSICDFileName = _.find(filesInCodebaseScidDirectory, v => _.endsWith(v,".json")) || "";
      if (_.isEmpty(codebaseSICDFileName) === false){
        const testScidPath = path.join(CODEBASE_SCID_FOLDER_PATH, codebaseSICDFileName);
        const {stdout: toxRunOutput, stderr: commandError} = await execShPromise(`cd ${testDirectoryPath} && python tester.py run -s ${testScidPath} -g "${pytestTestIgnore}"`, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));
        const isToxRunError = toxRunOutput.indexOf("py37: commands failed") !== -1 || _.isEmpty(_.trim(commandError)) === false;
        fs.appendFile(path.join(coverageReportsDirectoryPath, testingResultsFileName), `${toxRunOutput} \n\n ${commandError}`, err=>{
          if (err){
            console.log("Error writing flake8 Results");
          }
        });
        checkOutput = {
          title: "CHECK RESULTS",
          summary: isToxRunError ? "Failure" : "Success",
          text: `http://16.83.110.59:8889/${testingResultsFileName}`
        };
      } else {
        checkOutput = {
          title: "CHECK RESULTS",
          summary: "SICD NOT FOUND",
          text: `Expected a file ending with .json to be present in ${CODEBASE_SCID_FOLDER_PATH} but none found.`
        };
      }
    }
  } catch (e){
    checkOutput = {
      title: "CHECK RESULTS",
      summary: "Error during check run",
      text: `${e}`
    };
  }
  let checkConclusion;
  if (checkOutput.summary === "Success"){
    checkConclusion = CHECK_CONCLUSION_TYPES.SUCCESS;
  } else if (checkOutput.summary === "Failure"){
    checkConclusion = CHECK_CONCLUSION_TYPES.FAILURE;
  } else if (checkOutput.summary === "No test name/s provided in PR description to run"){
    checkConclusion = CHECK_CONCLUSION_TYPES.NEUTRAL;
  } else {
    checkConclusion = CHECK_CONCLUSION_TYPES.CANCELLED;
  }
  return {
    checkOutput,
    conclusion: checkConclusion
  };
}