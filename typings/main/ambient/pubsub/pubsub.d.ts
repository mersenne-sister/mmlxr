// Compiled using typings@0.6.7
// Source: https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/fc2078411b1765bc5ce000bacde8ff13b31623b3/pubsubjs/pubsub.d.ts
// Type definitions for PubSubJS 1.5.2
// Project: https://github.com/mroderick/PubSubJS
// Definitions by: Boris Yankov <https://github.com/borisyankov/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module PubSubJS {
    interface Base extends Publish, Subscribe, Unsubscribe, ClearAllSubscriptions {
        version: string;
        name: string;
    }

    interface Publish{
        publish(message: any, data: any): boolean;

        publish(message:any, data:any, sync:boolean, immediateExceptions:Function): boolean;

        publishSync(message: any, data: any): boolean;
    }

    interface Subscribe{
        subscribe(message: any, func: Function): any;
    }


    interface Unsubscribe{
        unsubscribe(tokenOrFunction: any): any;
    }


    interface ClearAllSubscriptions{
        clearAllSubscriptions(): any;
    }
}

declare var PubSub: PubSubJS.Base;

declare module "pubsub-js" {
  export = PubSub;
}