import * as _ from 'lodash';
import * as readline from "readline";
import {appStartUserInput} from "./types";

export default async function takeGitCredentialInputFromUser():Promise<appStartUserInput>{
  let un:string | null = null, tk:string | null = null;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  rl._writeToOutput = function _writeToOutput(stringToWrite) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    // eslint-disable-next-line no-unused-expressions
    rl.stdoutMuted ? rl.output.write("*") : rl.output.write(stringToWrite);
  };
  [un, tk] = await new Promise(resolve => {
    _.set(rl, "stdoutMuted", false);
    rl.question("Github PAT ? ", (t)=> {
      _.set(rl, "stdoutMuted", false);
      rl.question("Github Username ? ", (u)=> {
        rl.close();
        resolve([u, t])
      });
    });
    _.set(rl, "stdoutMuted", true);
  });
  return {
    un, tk
  };
}