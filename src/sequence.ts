import { inject } from '@loopback/context';
import {
  FindRoute,
  InvokeMethod,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler,
} from '@loopback/rest';
import * as _ from 'lodash';
import {GheAppClient} from "./octokitGHE";

import {EVPC_APP_BINDINGS, EVPC_REQUEST_BINDINGS} from './keys';
import {gheAppClientCredentials} from "./types";

const SequenceActions = RestBindings.SequenceActions;

export class SmeeEventSequence implements SequenceHandler {
  private payload: object;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private payloadRaw: any;
  constructor(
    @inject(EVPC_APP_BINDINGS.GHE_APP_CLIENT_CREDENTIALS) private gheAppClientCredentials: gheAppClientCredentials,
    @inject(EVPC_APP_BINDINGS.GHE_API_PROXY_SERVER) private gheApiProxyServer: string,
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
  ) {}


  async handle(context: RequestContext) {
    try {
      const { request, response } = context;
      const payloadRaw = request.read();
      const payload = JSON.parse(payloadRaw);
      const route = this.findRoute(request);
      const args = await this.parseParams(request, route);


      // if (/[0-9A-Za-z\-\_]+/.test(_.get(this.payload, "repository.name", ""))){
      //
      //
      // } else {
      //   this.reject(context, new Error("400"));
      // }

      const appclient = new GheAppClient(this.gheAppClientCredentials, this.gheApiProxyServer);

      context.bind(EVPC_REQUEST_BINDINGS.EVENT_TYPE).to(_.get(request, 'headers.x-github-event', 'N/A'));
      context.bind(EVPC_REQUEST_BINDINGS.EVENT_PAYLOAD).to(payload);
      context.bind(EVPC_REQUEST_BINDINGS.REQUEST_HEADERS).to(request.headers);
      context.bind(EVPC_REQUEST_BINDINGS.APP_INSTALLATION_CLIENT).to(appclient);

      const result = await this.invoke(route, args);

      this.send(response, result);

    } catch (err) {
      this.reject(context, err);
    }
  }
}
