const axios = require('axios');
const { exit, send } = require('process');
const struct = require('python-struct');

const authentication = require('./authentication');
const handshake = require('./handshake');

function getAccessPoint() {
    return new Promise((resolve) => {
        axios.get('https://apresolve.spotify.com').then((resp) => resolve(resp.data['ap_list'][0])).catch((_) => resolve('ap.spotify.com:443'));
    });
}

async function asyncMain() {
    const apAddr = (await getAccessPoint()).split(':');
    console.log(`Connecting to ${apAddr.join(':')}`);
    var connection = await handshake.connectToAccessPoint(apAddr[0], apAddr[1]);
    console.log(`Connected to ${apAddr.join(':')}`);
    await authentication.passwordAuthentication(connection, '', '');
    exit(0);
}

asyncMain();

