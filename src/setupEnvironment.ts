import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import dayjs from 'dayjs';
import {LOCAL_CODEBASE_DIRECTORY_PATH} from './constants';
import PShell from 'node-powershell';
import {git} from './gitService';
import execSh from 'exec-sh';

const execShPromise = execSh.promise;

export class SetupRuntimeEnvironment {
  constructor(private gitRemote:string){}

  async setup(){
    await this.matchServerTimeWithRealTime();
    await this._setupLocalCodebase();
    await this._installPSScriptAnalyzer();
    // this.createTestScidStoringDirectoryIfNotExits();
  }

  async _setupLocalCodebase(){
    const remoteRepoName = path.basename(this.gitRemote);
    console.log("Setting up local codebase...");
    if (fs.existsSync(LOCAL_CODEBASE_DIRECTORY_PATH) && fs.existsSync(path.join(LOCAL_CODEBASE_DIRECTORY_PATH, '.git'))){
      console.log("Assuming local codebase already setup as the codebase directory exits and has a .git directory");
    } else {
      if (fs.existsSync(LOCAL_CODEBASE_DIRECTORY_PATH) === false) {
        // Create a directory to hold the repository code.
        console.log(`Creating directory ${LOCAL_CODEBASE_DIRECTORY_PATH} for cloning git repository: ${remoteRepoName}`);
        fs.mkdirSync(LOCAL_CODEBASE_DIRECTORY_PATH);
      }
      console.log(`Cloning remote repository: ${remoteRepoName} to ${LOCAL_CODEBASE_DIRECTORY_PATH}`);
      await git.clone(this.gitRemote, LOCAL_CODEBASE_DIRECTORY_PATH);
      // For sanity we will remove the remote 'origin' created during clone operation as it will have the credentials.
      await git.removeRemote("origin").catch(e => {
        console.log(`Ignoring exception while removing origin remote: ${e} --- continuing...`)
      });
    }

  }

  async _installPSScriptAnalyzer(){
    const ps = new PShell({
      executionPolicy: 'Bypass',
      noProfile: true
    });
    ps.addCommand('Install-Module -Name PSScriptAnalyzer -Repository PSGallery -Force');
    console.log("Installing PSScriptAnalyzer to powershell...");
    await ps.invoke().then((d)=>{
      console.log(`PSScriptAnalyzer installed to powershell ${_.replace(d, /\s\s+/g, ' ')}`);
    }).catch(e => e);
  }

  async matchServerTimeWithRealTime(){
    const shellCommand = `curl -s --head http://hpe.com | grep ^Date: | sed 's/Date: //g'`;
    const {stdout: hpeDotComTime} = await execShPromise(shellCommand, true).catch(e => ({ stdout: "", stderr: `err: ${e}` }));
    if (hpeDotComTime === ""){
      console.log("Failed to fetch real date and time, time verification between the host time and real is not done.")
    } else {
      const hpeDotComDateMilliS = dayjs(hpeDotComTime).valueOf();
      const hostTimeMilliS = dayjs().valueOf();

      if(Math.abs(hostTimeMilliS - hpeDotComDateMilliS) > 60000){ // 60000 == 1 minute
        console.log(`
        ----------------------------------------------------------! WARNING !---------------------------------------------------------
        | Clock on the host has high offset (> 1 min) with real time, app may not work properly as github authentication could fail! |
        | You probably may want to correct the host time. Try syncing time with NTP or set from internet using:-                     |
        | date -s "$(wget -qSO- --max-redirect=0 hpe.com 2>&1 | grep Date: | cut -d' ' -f5-8)Z"                                      |
        ------------------------------------------------------------------------------------------------------------------------------
        `);
      }
    }
  }
}
