import { exit } from 'process';
import Session from './core/session';

async function asyncMain() {
    var session = new Session();
    exit(0);
}

asyncMain();

