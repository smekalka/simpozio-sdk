// @flow

import Simpozio from './simpozio/constructor.js';
import Heartbeat from './heartbeat';
import type {SmpzTerminalModelType} from './terminal/reducer';

export default class SimpozioWeb extends Simpozio {
    constructor(configObj: SmpzTerminalModelType) {
        super(configObj, Heartbeat);
    }
}