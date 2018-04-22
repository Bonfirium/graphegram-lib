import { base62 } from './Encryption';
import bigInt from 'big-integer';
import sha256 from 'js-sha256';

// TODO: increase P and G
// BroodForce expected time ~= 1y 160d

export const P = 11337409;
export const G = 7;

// MAX_HASH = floor(2**256 / P) * P
export const MAX_HASH = bigInt('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff86ddf8', 16);

export const divByMod = (a, b, mod) => {
	let result = 1;
	for (let i = 0; i < b; i++) {
		result = (result * a) % mod;
	}
	return result;
};

export const getPrivateKey = (postingKey, withUser) => {
	let hash, inc = 0, hashAsInt = bigInt(0);
	do {
		hash = sha256(postingKey + withUser + inc.toString());
		hashAsInt = bigInt(hash, 16);
	} while (hashAsInt.compare(MAX_HASH) === 1);
	return hashAsInt.mod(bigInt(P)).toJSNumber();
};

export const getPublicKey = (privateKey) => {
	return divByMod(G, privateKey, P);
};

export const getCryptoKey = (interlocutorPublicKey, selfPrivateKey) =>
	divByMod(interlocutorPublicKey, selfPrivateKey, P);
