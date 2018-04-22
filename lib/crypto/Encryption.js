import baseX from 'base-x';
import xor from 'buffer-xor';
import sha256 from 'js-sha256';

export const BASE_62_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const base62 = baseX(BASE_62_SYMBOLS);

/**
 * @param {String} message
 * @param {Number} cryptoKey
 * @return {Buffer}
 */
export const encryptMessage = (message, cryptoKey) => {
	const data = Buffer.from(message);
	const dataAsHex = data.toString('hex');
	/** @type {String} */
	let keyHash = sha256(cryptoKey.toString());
	while (keyHash.length < dataAsHex.length) {
		keyHash += sha256(keyHash);
	}
	keyHash = keyHash.substring(0, dataAsHex.length);
	console.log(data);
	console.log(keyHash);
	return xor(data, Buffer.from(keyHash));
};
