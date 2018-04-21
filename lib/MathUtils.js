import baseX from 'base-x';
import sha256 from 'js-sha256';
import xor from 'buffer-xor';

export const BASE_62_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const base62 = baseX(BASE_62_SYMBOLS);

/**
 * @param {String} key
 * @param {String} password
 * @return {Buffer}
 */
export const encryptKey = (key, password) => {
	const wifAsBuffer = typeof key === 'string' ? base62.decode(key) : key;
	let encryptKey = '';
	for (let increment = 0; encryptKey.length / 2 < wifAsBuffer.byteLength; increment += 1) {
		encryptKey += sha256(password);
	}
	encryptKey = encryptKey.slice(0, wifAsBuffer.byteLength * 2);
	const encryptKeyAsBuffer = Buffer.from(encryptKey, 'hex');
	return xor(wifAsBuffer, encryptKeyAsBuffer);
};
