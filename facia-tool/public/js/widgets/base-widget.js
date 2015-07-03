import Promise from 'Promise';
import mediator from 'utils/mediator';
import EventEmitter from 'EventEmitter';

var subscriptions = Symbol();

class BaseWidget extends EventEmitter {
    constructor() {
        super();
        Promise.resolve().then(() => {
            mediator.emit('widget:load', this);
        });
    }

    subscribeOn(observable, callback) {
        if (!this[subscriptions]) {
            this[subscriptions] = [];
        }
        this[subscriptions].push(observable.subscribe(callback.bind(this)));
    }

    dispose() {
        var listeners = this[subscriptions];
        if (listeners && listeners.length) {
            listeners.forEach(function (subscriber) {
                subscriber.dispose();
            });
        }
        delete this[subscriptions];
    }
}

export default BaseWidget;
