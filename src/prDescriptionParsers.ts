import * as _ from 'lodash';
import execSh from 'exec-sh';

const execShPromise = execSh.promise;

export function getTestNamesFromPrBody(prDescription:string):Array<string> {
  const TEST_NAME_LINE_IDENTIFIER = "comma separated test names releated to these changes, that will provide the reviewer about the test cases that";

  let testNames:Array<string> = [];
  const prDescriptionLines = _.filter(_.split(prDescription, "\n"), l => _.trim(l) !== "");
  const indexOfIdentifier = _.findIndex(prDescriptionLines, _.unary(_.partialRight(_.includes, TEST_NAME_LINE_IDENTIFIER)));
  if(indexOfIdentifier !== -1){
    testNames = _.map(_.split(prDescriptionLines[indexOfIdentifier + 2], ","), _.trim);
  }

  return testNames;
}

//
// export async function setSCIDFromPrBody(prDescription:string, testScidFilePath:string):Promise<boolean> {
//   const TEST_NAME_LINE_IDENTIFIER = "Please describe in detail how you tested your changes";
//
//   const prDescriptionLines = _.filter(_.split(prDescription, "\n"), l => _.trim(l) !== "");
//   const indexOfIdentifier = _.findIndex(prDescriptionLines, _.unary(_.partialRight(_.includes, TEST_NAME_LINE_IDENTIFIER)));
//   if(indexOfIdentifier !== -1){
//     const testScidFileInDescription = prDescriptionLines[indexOfIdentifier + 3];
//     const scidUrl = testScidFileInDescription.substring(testScidFileInDescription.indexOf("https://"), testScidFileInDescription.indexOf(")", testScidFileInDescription.indexOf("https://")));
//     const scidDownloadAndStoreShellCommand = `wget ${scidUrl} -O ${testScidFilePath}`;
//     const {stderr: shError} = await execShPromise(`${scidDownloadAndStoreShellCommand}`, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));
//     return !shError;
//   }
//   return false;
// }
