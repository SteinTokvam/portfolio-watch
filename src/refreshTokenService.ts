import { updateToken } from "./db";
import { KronToken } from "./types";

export async function refreshKronToken(refresh_token: string): Promise<KronToken> {
    console.log('Refreshing kron token.');
    const url = 'https://id.storebrand.no/auth/realms/storebrand/protocol/openid-connect/token';
    const grantType = 'refresh_token';
    const clientId = 'kron.web';
    return await fetch(`${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'grant_type': grantType,
            'client_id': clientId,
            'refresh_token': refresh_token,
        }),
    }).then((response) => {
        if(response.ok) {
            console.log('Token refreshed successfully');
            return response.json();
        }
        console.error('Failed to refresh token:', response.status);
        console.error('Response:', response.json());
        throw new Error('Failed to refresh token');
    })
    .then(token => {
        updateToken(token.refresh_token, token.access_token);
        return token;
    })
    .catch((error) => {
        console.error('Error refreshing token:', error);
        return {}
    })
}