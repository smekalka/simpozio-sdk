import _ from 'lodash';
import SimpozioBackgroundWorker from 'react-native-simpozio-background-worker';
import Heartbeat from '../src/heartbeat';

const listeners = {};

export default class HeartbeatNative extends Heartbeat {
    constructor({initialData, store}) {
        super({initialData, store});
    }

    addListener(event, cb) {
        let key = this._getKey(cb);

        listeners[key] = SimpozioBackgroundWorker.addListener(event, cb);

        return key;
    }

    _getMetadata() {
        const {baseUrl, authorization, touchpoint, userAgent, acceptLanguage, xHttpMethodOverride} = _.get(
            this.store.getState(),
            'terminal',
            {}
        );

        const {state, screen, connection, bandwidth, payload, next} = _.get(this.store.getState(), 'heartbeat', {});

        return {
            baseUrl,
            headers: {
                Authorization: authorization,
                'User-Agent': userAgent,
                'Accept-Language': acceptLanguage,
                'X-HTTP-Method-Override': xHttpMethodOverride
            },
            body: {
                touchpoint,
                state,
                screen,
                connection,
                bandwidth,
                payload,
                next
            }
        };
    }

    _handleStoreChange() {
        const {debug} = _.get(this.store.getState(), 'terminal', {});
        const newData = _.get(this.store.getState(), 'heartbeat', {});

        if (_.isEqual(this.currentData, newData)) {
            return;
        }

        if (newData === false || _.get(newData, 'next') === 0) {
            SimpozioBackgroundWorker.stopHeartbeat()
                .then(() => {
                    this._isStarted = false;
                    if (debug) {
                        console.log('SDK HEARTBEAT STOPPED');
                    }
                })
                .catch(error => {
                    if (debug) {
                        console.log('SDK HEARTBEAT ERROR', error);
                    }
                });
        } else if (this._isStarted === false) {
            SimpozioBackgroundWorker.startHeartbeat(this._getMetadata())
                .then(() => {
                    this._isStarted = true;
                    if (debug) {
                        console.log('SDK HEARTBEAT STARTED');
                    }
                })
                .catch(error => {
                    if (debug) {
                        console.log('SDK HEARTBEAT ERROR', error);
                    }
                });
        } else {
            SimpozioBackgroundWorker.updateHeartbeat(this._getMetadata());
        }

        this.currentData = newData;
    }

    removeSubscription(key) {
        if (!listeners[key]) {
            return;
        }

        SimpozioBackgroundWorker.removeListener(key);

        listeners[key] = null;
    }
}