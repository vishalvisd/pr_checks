import {BindingKey} from '@loopback/context';
import {CheckQueueItem, gheAppClientCredentials} from './types';

export namespace EVPC_APP_BINDINGS {
  export const CHECKS_QUEUE = BindingKey.create<Array<CheckQueueItem>>('evpc.app.checksqueue');
  export const GHE_APP_CLIENT_CREDENTIALS = BindingKey.create<gheAppClientCredentials>('evpc.app.gheprivatekey');
  export const GHE_API_PROXY_SERVER = BindingKey.create<string>('evpc.app.gheapiproxyserver');

}

export namespace EVPC_REQUEST_BINDINGS {
  export const REQUEST_HEADERS = BindingKey.create<object>('evpc.event.requestheaders');
  export const EVENT_TYPE = BindingKey.create<string>('evpc.event.type');
  export const EVENT_PAYLOAD = BindingKey.create<object>('evpc.event.payload');
  export const APP_INSTALLATION_CLIENT = BindingKey.create<object>('evpc.app.installation_client');
}