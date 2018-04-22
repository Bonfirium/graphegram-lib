import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62 } from './crypto/Encryption';
import { getCryptoKey, getPrivateKey, getPublicKey } from './crypto/DiffieHellman';

const DRE_PERMLINK_PREFIX = 'graphigram-receiver';
// TODO: set RECEIVING_POSTS_COUNT to average user posts count
const RECEIVING_POSTS_COUNT = 100;
// const

export const DRE_NOT_FOUND_ERROR = 'dialog receiver entry not found';

export default class Session {

	/**
	 * @param {String} username
	 * @param {String} postingKey
	 * @return {Promise<undefined>}
	 */
	async signUp(username, postingKey) {
		this._username = username;
		this._postingKey = postingKey;
		this._keys = {};
		this._dres = {};
		console.log('Start DRE searching...');
		try {
			console.log(`DRE has been found: ${this._drePermlink = await this.getDRE(this._username)}`);
		} catch (error) {
			if (error !== DRE_NOT_FOUND_ERROR) throw error;
			console.log('DRE not found, creating...');
			console.log(`DRE has been created with permlink: ${await this._createDRE()}`);
		}
		// }).catch((error) => {
		// 	if (error === DRE_NOT_FOUND_ERROR) {
		// 		console.log('DRE not found, creating...');
		// 		this._createDRE()
		// 			.then((res) => {
		// 				console.log('DRE has been created: ' + res);
		// 				this._drePermlink = res.operations[0][1].permlink;
		// 				resolve();
		// 			})
		// 			.catch(reject);
		// 		return;
		// 	}
		// 	reject(error);
		// });
	}

	/**
	 * @typedef {Object} CommentOperationResponse
	 * @property {String} parent_author Author of parent comment (or empty string if new comment is post)
	 * @property {String} parent_permlink Permlink of parent comment (or just tag if new comment is post)
	 * @property {String} author You
	 * @property {String} permlink Permlink of new post
	 * @property {String} title Title of new post
	 * @property {String} body Body of new post
	 * @property {Object} json_metadata MetaData of new post
	 */

	/**
	 * @typedef {Object} CommentResponse
	 * @property {Number} ref_block_num Number of the block in which the transaction occurred
	 * @property {Number} ref_block_prefix First 4 bytes of the block hash
	 * @property {String} expiration The time at which the block has entered the network
	 * @property {[['comment',CommentOperationResponse]]} operations Operations info
	 * operation[0][0] - 'commit' string
	 * operation[0][1] - CommentOperationResponse
	 * @todo Find out what data is stored in `extensions`
	 * @property {[]} extensions X3 the meaning of the array
	 * @property {[String]} signatures Hashes of operations
	 */

	/**
	 * @private
	 * @return {Promise<CommentResponse>}
	 */
	async _createDRE() {
		return await golos.broadcast.comment(
			this._postingKey, '', 'opensource', this._username,
			Session._getNewPermlink(), 'Graphigram Post-DialogReceiver',
			Session._getBodyForDRE(), {
				// TODO: think about metadata
				tags: ["source-code", "fit4code", 'graphigram'],
				app: "golos.io/0.1",
				format: "html",
			},
		);
	}

	/**
	 * @private
	 * @static
	 * @param {String} body
	 * @return {boolean}
	 */
	static _dreIsValid(body) {
		return body === Session._getBodyForDRE();
	}

	/**
	 * @private
	 * @static
	 * @return {String}
	 */
	static _getBodyForDRE() {
		return '<html><i>private chat post</i></html>';
	}

	/**
	 * @private
	 * @static
	 * @param {String} username
	 * @param {[CommentOperationResponse]} posts
	 * @return {Promise<String>}
	 */
	static async _findDREInPosts(username, posts) {
		for (const post of posts) {
			const content = await golos.api.getContent(username, post.permlink);
			if (Session._dreIsValid(content.body)) return content.permlink;
		}
		throw DRE_NOT_FOUND_ERROR;
	};

	/**
	 * @static
	 * Returns permlink of DRE or throws DRE_NOT_FOUND_ERROR if DRE not found
	 * @param {String} username
	 * @param {Number} start
	 * @param {String} lastCheckedPermlink
	 * @return {Promise<String>}
	 */
	async getDRE(username) {
		if (this._dres[username]) return this._dres[username];
		let lastCheckedPermlink = '';
		let start = RECEIVING_POSTS_COUNT - 1;
		while (true) {
			const postsInfo = await golos.api.getBlog(username, start, RECEIVING_POSTS_COUNT);
			start += RECEIVING_POSTS_COUNT;
			if (postsInfo.length === 0) throw DRE_NOT_FOUND_ERROR;
			const DREPosts = postsInfo
				.map(({ comment: post }) => post)
				.filter((post) => post.permlink.indexOf(DRE_PERMLINK_PREFIX) === 0);
			if (DREPosts.length === 0) continue;
			if (DREPosts[0].permlink === lastCheckedPermlink) throw DRE_NOT_FOUND_ERROR;
			try {
				const result = await Session._findDREInPosts(username, [...DREPosts].reverse());
				this._dres[username] = result;
				lastCheckedPermlink = DREPosts[0].permlink;
				return result;
			} catch (err) {
				if (err === DRE_NOT_FOUND_ERROR) continue;
				throw err;
			}
		}
	}

	async _initChannel(withUser, hisPublicKey) {
		const privateKey = this._keys[withUser] = getPrivateKey(this._postingKey, withUser);
		const publicKey = getPublicKey(privateKey);
		this._keys[withUser] = getCryptoKey(hisPublicKey, privateKey);
		return await this._sendPublicKey(publicKey, withUser);
	}

	async createChannel(withUser) {
		if (await this.isConnectionExists(withUser)) throw 'channel already created';
		return await this._initChannel(withUser);
	}

	async isConnectionExists(from, to) {
		if (this._keys[to]) return true;
		const comments = await golos.api.getAllContentReplies(
			from, await this.getDRE(from),
		);
		for (const comment of comments) {
			if (comment.author !== to) continue;
			const anotherPublicKey = (/START_DIALOG.+PUBLIC_KEY: (\d+)/.exec(comment.body) || [null, null])[1];
			if (!anotherPublicKey) continue;
			if (from === this._username) await this._initChannel(to, anotherPublicKey);
			return true;
		}
		return false;
	}

	static _getNewPermlink() {
		return `${DRE_PERMLINK_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
	}

	async _sendPublicKey(publicKey, toUser) {
		const dre = await this.getDRE(toUser);
		const result = await golos.broadcast.comment(
			this._postingKey, toUser, dre, this._username,
			Session._getNewPermlink(), 'CHANNEL_CREATION',
			`START_DIALOG.\nPUBLIC_KEY: ${publicKey}`, {
				// TODO: think about metadata
				tags: ["source-code", "fit4code", 'graphigram'],
				app: "golos.io/0.1",
				format: "html",
			},
		);
		console.log(`public key ${publicKey} has been sent to ${toUser}`);
		return result;
	}
}
