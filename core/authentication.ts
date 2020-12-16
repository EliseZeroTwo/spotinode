import fs = require('fs');
import protobuf = require('protocol-buffers');
import ApConnection from './connection/apconnection';

const authenticationMessages = protobuf(fs.readFileSync(`${process.cwd()}/protocol/authentication.proto`));

export async function passwordAuthentication(apConnection: ApConnection, username: string, password: string) {
    let clientReponseEncrypted = authenticationMessages.ClientResponseEncrypted.encode({
        login_credentials: {
            username: username,
            typ: authenticationMessages.AuthenticationType.AUTHENTICATION_USER_PASS,
            auth_data: password
        },
        system_info: {
            cpu_family: authenticationMessages.CpuFamily.CPU_ARM,
            os: authenticationMessages.Os.OS_LINUX
        }
    });

    await apConnection.send(0xab, clientReponseEncrypted);
    let result = await apConnection.recieve();
    if (result.cmd == 0xac) { // APWelcome
        let apWelcomeResponse = authenticationMessages.APWelcome.decode(result.payload);
        return apWelcomeResponse;
    } 
    return undefined;
}
