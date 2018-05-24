import _ from 'lodash';
import moment from 'moment';
import EventEmitter from 'events';
import {heartbeatUpdateAction} from './actions';

import Api from '../api';
import {terminalOnlineAction} from '../terminal/actions';

import {HEARTBEAT_RN_EVENT_EXCEPTION, HEARTBEAT_RN_EVENT_FAIL, HEARTBEAT_RN_EVENT_RESUME} from './const';
import {API_HEARTBEAT, API_SIGNALS} from '../api/const';

const META = '_simpozioListenerId';
const listeners = {};
const eventEmitter = new EventEmitter();

export default class Heartbeat {
    constructor({initialData, store}) {
        this._isStarted = false;

        this.store = store;
        this.cancelToken = null;
        this.checkConnectionTimeout = 0;
        this.api = new Api({store});
        this.currentData = {};
        this.requestTime = 0;

        this.store.subscribe(this._handleStoreChange.bind(this));
        this.store.dispatch(heartbeatUpdateAction(initialData));
    }

    _getKey(listener) {
        if (!listener) {
            return;
        }

        if (!listener.hasOwnProperty(META)) {
            if (!Object.isExtensible(listener)) {
                return 'F';
            }

            Object.defineProperty(listener, META, {
                value: _.uniqueId('SIMPOZIO_LISTENER_')
            });
        }

        return listener[META];
    }

    addListener(event, cb) {
        let key = this._getKey(cb);

        eventEmitter.addListener(event, cb);
        listeners[key] = {event, cb};

        return key;
    }

    _getMetadata() {
        const {touchpoint} = _.get(this.store.getState(), 'terminal', {});

        const {state, screen, connection, bandwidth, payload, next} = _.get(this.store.getState(), 'heartbeat', {});

        return {
            touchpoint,
            state,
            screen,
            connection,
            bandwidth,
            payload,
            next
        };
    }

    _handleStoreChange() {
        const {authorization} = _.get(this.store.getState(), 'terminal', {});
        let newData = _.get(this.store.getState(), 'heartbeat', {});
        newData.authorization = authorization;

        if (_.isEqual(this.currentData, newData)) {
            return;
        }

        if (newData === false || _.get(newData, 'next') === 0) {
            this._stopHeartbeat();
        } else if (this._isStarted === false && authorization) {
            this._startHeartbeat();
        }

        this.currentData = _.clone(newData);
    }

    _startHeartbeat() {
        if (this._isStarted) {
            return;
        }

        this._isStarted = true;

        const helper = () => {
            this.checkConnectionTimeout = 0;
            const {authorization, online, debug} = _.get(this.store.getState(), 'terminal', {});
            const {next, lastOffline} = _.get(this.store.getState(), 'heartbeat', {});

            if (!authorization) {
                this._isStarted = false;
                return;
            }

            const handleReject = error => {
                this.requestTime = this.requestTime || 1000;

                this.cancelToken = null;

                if (debug) {
                    console.log('SIMPOZIO SDK HEARTBEAT FAILED', error);
                }

                if (online) {
                    this.store.dispatch(terminalOnlineAction(false));
                    eventEmitter.emit(HEARTBEAT_RN_EVENT_FAIL, error);
                }

                if (!this.checkConnectionTimeout) {
                    this.checkConnectionTimeout = setTimeout(() => {
                        helper();
                    }, next - this.requestTime * 2);
                }
            };

            const handleResponse = ({result, requestTime} = {}) => {
                this.requestTime = requestTime;
                this.cancelToken = null;

                if (!online) {
                    eventEmitter.emit(HEARTBEAT_RN_EVENT_RESUME, {
                        duration: moment().valueOf() - lastOffline
                    });

                    this.store.dispatch(terminalOnlineAction(true));
                }
                if (!this.checkConnectionTimeout) {
                    this.checkConnectionTimeout = setTimeout(() => {
                        helper();
                    }, next - this.requestTime * 2);
                }
                return Promise.resolve(result);
            };

            const data = _.assign({}, this._getMetadata(), {
                timestamp: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZZ')
            });

            this.cancelToken = this.api.makeCancelToken().token;

            this.api
                .post({
                    data,
                    timeout: next * 0.5,
                    url: API_SIGNALS + API_HEARTBEAT,
                    cancelToken: this.cancelToken
                })
                .then(handleResponse)
                .catch(handleReject);
        };

        helper();
    }

    _stopHeartbeat() {
        if (this.checkConnectionTimeout) {
            clearTimeout(this.checkConnectionTimeout);
            this.checkConnectionTimeout = 0;
        }

        if (this.cancelToken) {
            this.cancelToken.cancel();
        }

        this._isStarted = false;
    }

    update(data) {
        this.store.dispatch(heartbeatUpdateAction(data));
    }

    onFail(cb) {
        return this.addListener(HEARTBEAT_RN_EVENT_FAIL, cb);
    }

    onResume(cb) {
        return this.addListener(HEARTBEAT_RN_EVENT_RESUME, cb);
    }

    onError(cb) {
        return this.addListener(HEARTBEAT_RN_EVENT_EXCEPTION, cb);
    }

    removeSubscription(key) {
        if (!listeners[key]) {
            return;
        }

        const {event, cd} = listeners[key];
        eventEmitter.removeListener(event, cd);

        listeners[key] = null;
    }

    isStarted() {
        return this._isStarted;
    }
}
