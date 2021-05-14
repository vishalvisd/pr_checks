import * as fs from 'fs';
import http from 'http';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import SmeeClient from 'smee-client';
import {AppHelperServiceSetupArgs} from "./types";

export class SetupHelperServices {
  private reportsDirectoryPath: string;
  private reportsFileServerPort: number;
  private smeeChannel: string | null;
  private appServerBaseUrl: string | null;
  constructor(args: AppHelperServiceSetupArgs){
    this.reportsDirectoryPath = args.reportsDirectoryPath;
    this.reportsFileServerPort = args.reportsFileServerPort;
    this.smeeChannel = args.smeeChannelId || null;
    this.appServerBaseUrl = args.appServerBaseUrl || null;
  }

  startReportsFileServer(){
    console.log("Starting reports file server...");
    const reportsDirectoryPath = this.reportsDirectoryPath;

    if (fs.existsSync(reportsDirectoryPath) == false){
      console.log(`Create directory: ${reportsDirectoryPath}`);
      fs.mkdirSync(reportsDirectoryPath);
    }

    const serve = serveStatic(reportsDirectoryPath);

    const server = http.createServer(function(req, res) {
      const done = finalhandler(req, res);
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      serve(req, res, done);
    });

    const reportFileServerPort = this.reportsFileServerPort;
    server.listen(reportFileServerPort);
    console.log(`Reports file server starts on port: ${reportFileServerPort}, serving files on directory: ${reportsDirectoryPath}`);
  }

  startSmeeClient(){
    const smee = new SmeeClient({
      source: `https://smee.io/${this.smeeChannel}`,
      target: `${this.appServerBaseUrl}/event_handler`,
      logger: console
    });
    const events = smee.start();

    ["exit", "SIGINT", "SIGUSR1", "SIGUSR2", "uncaughtException"].forEach((processCloseEvent)=>{
      process.on(processCloseEvent, () => {
        events.close();
        console.log("Closed Smee forwards");
        process.exit();
      });
    });
  }
}
