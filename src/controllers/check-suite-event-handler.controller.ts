import {CoreBindings} from '@loopback/core';
import {inject } from '@loopback/context';
import { post } from '@loopback/rest';
import * as _ from 'lodash';
import { EpVmelementPrChecksApplication } from '../application';
import {createAndQueueCheckRun} from "../octokitGHE";
import {GHE_EVENT_TYPES, GHE_EVENT_PAYLOAD_ACTION} from "../octokitConstants";
import {EVPC_REQUEST_BINDINGS} from '../keys';

export class CheckSuiteEventHandlerController {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private app: EpVmelementPrChecksApplication,
    @inject(EVPC_REQUEST_BINDINGS.REQUEST_HEADERS)
    private readonly requestHeaders: object,
    @inject(EVPC_REQUEST_BINDINGS.EVENT_TYPE)
    private readonly eventType: string,
    @inject(EVPC_REQUEST_BINDINGS.EVENT_PAYLOAD)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly eventPayload: any,
    @inject(EVPC_REQUEST_BINDINGS.APP_INSTALLATION_CLIENT)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly appInstallationClient: any,
  ) {}

  @post('/event_handler')
  async eventHandler(): Promise<object> {
    if ((this.eventType === GHE_EVENT_TYPES.PULL_REQUEST
      && (
        this.eventPayload.action === GHE_EVENT_PAYLOAD_ACTION.PR_OPENED
        || this.eventPayload.action === GHE_EVENT_PAYLOAD_ACTION.PR_REOPENED
        || this.eventPayload.action === GHE_EVENT_PAYLOAD_ACTION.PR_UPDATED
        || (this.eventPayload.action === GHE_EVENT_PAYLOAD_ACTION.PULL_REQUEST_EDITED
            && _.has(this.eventPayload, "changes.body")
        )
      )
    ) || ((this.eventType === GHE_EVENT_TYPES.CHECK_SUITE || this.eventType ===  GHE_EVENT_TYPES.CHECK_RUN)
        && this.eventPayload.action === GHE_EVENT_PAYLOAD_ACTION.CHECK_REREQUESTED
      )
    ){
      const gheAppInstallationClient = this.appInstallationClient.getAuthenticatedInstallation(this.eventPayload, this.requestHeaders);
      await createAndQueueCheckRun(this.app, gheAppInstallationClient, this.eventPayload, this.eventType);
    }
    return new Promise(resolve => resolve());
  }
}
