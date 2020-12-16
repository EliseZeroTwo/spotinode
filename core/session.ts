import getAccessPoint from './apresolve';
import { passwordAuthentication } from './authentication';
import ApConnection from './connection/apconnection';
import connectToAccessPoint from './connection/handshake';

export default class Session {
    connection: ApConnection;

    constructor() {

    }

    async connect(username: string, password: string) {
        if (username == undefined || password == undefined || username == '' || password == '')
            throw new Error('Missing username or password');
        const apAddr = (await getAccessPoint()).split(':');
        console.log(`Connecting to ${apAddr.join(':')}`);
        this.connection = await connectToAccessPoint(apAddr[0], parseInt(apAddr[1]));
        let result = await passwordAuthentication(this.connection, username, password);
        if (result != undefined) {
            console.log(`Authenticated as ${result.canonical_username}`);
        } else {
            console.log('Failed to authenticate');
        }
    }
}