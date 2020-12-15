const fs = require('fs');
const protobuf = require('protocol-buffers');
const authenticationMessages = protobuf(fs.readFileSync('authentication.proto'));

async function passwordAuthentication(apConnection, user, password) {
    var clientReponseEncrypted = authenticationMessages.ClientResponseEncrypted.encode({
        login_credentials: {
            username: user,
            typ: authenticationMessages.AuthenticationType.AUTHENTICATION_USER_PASS,
            auth_data: password
        },
        system_info: {
            cpu_family: authenticationMessages.CpuFamily.CPU_ARM,
            os: authenticationMessages.Os.OS_LINUX
        }
    });

    await apConnection.send(0xab, clientReponseEncrypted);
    var result = await apConnection.recieve();
    if (result.cmd == 0xac) { // APWelcome
        var apWelcomeResponse = authenticationMessages.APWelcome.decode(result.payload);
        console.log(apWelcomeResponse);
    }
}

module.exports = { passwordAuthentication };