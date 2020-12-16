const exit = require('process').exit;
const Session = require('./core/session').Session;


async function asyncMain() {
    var session = new Session();
    await session.connect('', '');
    exit(0);
}

asyncMain();

