import Config from './config';
import Session from '../core/session';

class PlayerTrackLoader {
    session: Session;
    config: Config;

    constructor(session: Session, config: Config) {
        this.session = session;
        this.config = config;
    }
}