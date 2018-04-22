import baseX from 'base-x';
import xor from 'buffer-xor';
import sha256 from 'js-sha256';

export const BASE_62_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const base62 = baseX(BASE_62_SYMBOLS);

export const encryptMessage = (message, cryptoKey) => {
	const data = Buffer.from(message);
	const dataAsHex = data.toString('hex');
	/** @type {String} */
	let keyHash = sha256(cryptoKey.toString());
	while (keyHash.length < dataAsHex.length) {
		keyHash += sha256(keyHash);
	}
	keyHash = keyHash.substring(0, dataAsHex.length);
	return base62.encode(xor(data, Buffer.from(keyHash, 'hex')))
};

export const decryptMessage = (encryptedMessage, cryptoKey) => {
	const crypt = base62.decode(encryptedMessage);
	console.log(crypt);
	const cryptAsHex = crypt.toString('hex');
	let keyHash = sha256(cryptoKey.toString());
	while (keyHash.length < cryptAsHex.length) {
		keyHash += sha256(keyHash);
	}
	keyHash = keyHash.substring(0, cryptAsHex.length);
	return xor(crypt, Buffer.from(keyHash, 'hex')).toString();
};
