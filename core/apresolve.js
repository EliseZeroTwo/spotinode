const axios = require('axios');

const apFallback = 'ap.spotify.com:443';
const apResolveEndpoint = 'https://apresolve.spotify.com';

async function getAccessPoint() {
    try {
        var resp = await axios.get(apResolveEndpoint);
        if (resp.data['ap_list'] != undefined && resp.data['ap_list'].length > 0)
            return resp.data['ap_list'][0];
        return apFallback;
    } catch {
        return apFallback;
    }
}

module.exports = { getAccessPoint };