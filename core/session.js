const apResolve = require('./apresolve');
const authentication = require('./authentication');
const handshake = require('./connection/handshake');

class Session {
    constructor() {

    }

    async connect(username, password) {
        const apAddr = (await apResolve.getAccessPoint()).split(':');
        console.log(`Connecting to ${apAddr.join(':')}`);
        var connection = await handshake.connectToAccessPoint(apAddr[0], apAddr[1]);
        var result = await authentication.passwordAuthentication(connection, username, password);
        if (result != undefined) {
            console.log(`Authenticated as ${result.canonical_username}`);
        } else {
            console.log('Failed to authenticate');
        }
    }
}

module.exports = { Session };