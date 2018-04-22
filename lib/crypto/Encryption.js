import baseX from 'base-x';
import xor from 'buffer-xor';

export const BASE_62_SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const base62 = baseX(BASE_62_SYMBOLS);

/**
 * @param {String} key
 * @param {String} hash
 * @param {Number} minLength
 * @return {Buffer}
 */
// export const encryptKey = (key, hash, minLength = 0) => {
// 	if (key.length < minLength)
// 	const wifAsBuffer = typeof key === 'string' ? base62.decode(key) : key;
// 	let encryptKey = '';
// 	for (let increment = 0; encryptKey.length / 2 < wifAsBuffer.byteLength; increment += 1) {
// 		encryptKey += hash;
// 	}
// 	encryptKey = encryptKey.slice(0, wifAsBuffer.byteLength * 2);
// 	const encryptKeyAsBuffer = Buffer.from(encryptKey, 'hex');
// 	return xor(wifAsBuffer, encryptKeyAsBuffer);
// };
