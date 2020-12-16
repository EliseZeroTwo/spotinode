const axios = require('axios');

const apFallback: string = 'ap.spotify.com:443';
const apResolveEndpoint: string = 'https://apresolve.spotify.com';

export default async function getAccessPoint(): Promise<string> {
    try {
        let resp = await axios.get(apResolveEndpoint);
        if (resp.data['ap_list'] != undefined && resp.data['ap_list'].length > 0)
            return resp.data['ap_list'][0];
        return apFallback;
    } catch {
        return apFallback;
    }
}