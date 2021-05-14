import path from 'path';
import * as _ from 'lodash';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RestApplication} from '@loopback/rest';
import {ServiceMixin} from '@loopback/service-proxy';
import {EVPC_APP_BINDINGS} from './keys';
import {CheckQueueItem, prCheckAppArgs, CheckResult} from './types';
import {CHECK_TYPES} from './constants';
import {updateCheckStatusToGithub} from './octokitGHE';
import {CHECK_CONCLUSION_TYPES} from "./octokitConstants";
import {GitService} from './gitService';
import checkLintIssues from './lintChecker';
import codeTestAndCoverageCheck from './codeTestAndCoverageChecker';
import lockedFileModificationCheck from './lockedFileModificationCheck';

export class EpVmelementPrChecksApplication extends BootMixin(
  ServiceMixin(RestApplication),
) {
  constructor(options: ApplicationConfig = {}, private args:prCheckAppArgs) {
    super(options);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Set App context bindings
    // Initializing the checks task queue
    this.bind(EVPC_APP_BINDINGS.CHECKS_QUEUE).to([]);
    this.bind(EVPC_APP_BINDINGS.GHE_APP_CLIENT_CREDENTIALS).to(args.gheAppClientCredentials);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };

    this.checkLoop();
  }

  async checkLoop(){
    while(true){
      try{
        const checksQueue = await this.get(EVPC_APP_BINDINGS.CHECKS_QUEUE);
        const nextCheckData:CheckQueueItem | undefined = checksQueue.shift();
        if (nextCheckData !== undefined){
          await updateCheckStatusToGithub(nextCheckData, {status: "in_progress"}).catch(e=>{
            throw new Error(e);
          });

          await GitService.bringLocalCodebaseToCommitSHA(nextCheckData.sha).catch(e =>{
            console.log(`Encountered error while setting the local codebase: ${e}`);
            console.log(`Check ID: ${_.get(nextCheckData.eventPayload, "check_run.id")}, Check: ${nextCheckData.name}`);
            throw new Error(e);
          });

          const reportsDirectoryPath = this.args.reportsDirectoryPath;
          let checkResult:CheckResult;
          if (nextCheckData.name === CHECK_TYPES.LINT_CHECKS){
            checkResult = await checkLintIssues(
              nextCheckData,
              this.args.pyLinterConfigFilePath,
              this.args.psLinterConfigFilePath,
              this.args.lintCheckOmmitedPaths,
              reportsDirectoryPath
            );
            await updateCheckStatusToGithub(nextCheckData, {status: "completed", output: checkResult.checkOutput, conclusion: checkResult.conclusion,});
          } else if (nextCheckData.name === CHECK_TYPES.COVERAGE_CHECKS){
            checkResult = await codeTestAndCoverageCheck(
              nextCheckData,
              this.args.testRootDirectoryInCodebase,
              reportsDirectoryPath
            );
            await updateCheckStatusToGithub(nextCheckData, {status: "completed", output: checkResult.checkOutput, conclusion: checkResult.conclusion,});
          } else if(nextCheckData.name === CHECK_TYPES.LOCKED_FILE_MODIFICATION_CHECK){
            checkResult = await lockedFileModificationCheck(
              nextCheckData,
              this.args.lockedFilePaths
            );
            await updateCheckStatusToGithub(nextCheckData, {status: "completed", output: checkResult.checkOutput, conclusion: checkResult.conclusion,});
          }else {
            await updateCheckStatusToGithub(nextCheckData, {status: "completed", conclusion: CHECK_CONCLUSION_TYPES.CANCELLED});
          }
        }
      } catch(e){
        console.log(e);
      }

      await new Promise(resolve => setTimeout(()=> resolve(), 1000));
    }
  }
}
