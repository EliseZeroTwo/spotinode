const exit = require('process').exit;
const Session = require('./core/session').default;

const spotifyId = require('./core/spotifyID');


async function asyncMain() {
    var session = new Session();
    exit(0);
}

asyncMain();

