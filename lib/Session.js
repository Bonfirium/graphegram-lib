import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62, encryptMessage, decryptMessage } from './crypto/Encryption';
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
		this._mainKeys = {};
		this._pubKeys = {};
		this._dres = {};
		this._dialogs = {};
		this._receivers = {};
		console.log('Start DRE searching...');
		try {
			console.log(`DRE has been found: ${this._dres[this._username] = await this.getDRE(this._username)}`);
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
	 * @param {String?} username default - current user
	 * @return {Promise<String>}
	 */
	async getDRE(username = this._username) {
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
		const privateKey = this._mainKeys[withUser] = getPrivateKey(this._postingKey, withUser);
		const publicKey = getPublicKey(privateKey);
		this._mainKeys[withUser] = getCryptoKey(hisPublicKey, privateKey);
		return await this._sendPublicKey(publicKey, withUser);
	}

	async _getKey(forUser) {
		if (this._mainKeys[forUser]) return this._mainKeys[forUser];
		const privateKey = getPrivateKey(this._postingKey, forUser);
		const result = this._mainKeys[forUser] = getCryptoKey(await this._getPubKey(forUser), privateKey);
		console.log('mainKey: ' + result);
		return result;
	}

	async _getPubKey(username) {
		if (this._pubKeys[username]) return this._pubKeys[username];
		if (!await this.isConnectionExists(username)) throw 'connection not established';
		return this._pubKeys[username];
	}

	async createChannel(withUser) {
		if (await this.isConnectionExists(withUser)) throw 'channel already created';
		return await this._initChannel(withUser);
	}

	async isConnectionExists(to) {
		if (this._mainKeys[to]) return true;
		const comments = await golos.api.getAllContentReplies(
			this._username, await this.getDRE(),
		);
		for (const comment of comments) {
			if (comment.author !== to) continue;
			console.log(comment.body);
			const anotherPublicKey = (/START_DIALOG[\s.]+PUBLIC_KEY: (\d+)/.exec(comment.body) || [null, null])[1];
			console.log("PubKey: " + anotherPublicKey);
			if (!anotherPublicKey) continue;
			this._pubKeys[to] = anotherPublicKey;
			// if (from === this._username) await this._initChannel(to, anotherPublicKey);
			return true;
		}
		return false;
	}

	static _getNewPermlink() {
		return `${DRE_PERMLINK_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
	}

	async getAllInterlocutors() {
		const result = new Set();
		const comments = await golos.api.getAllContentReplies(this._username, await this.getDRE());
		for (const comment of comments) {
			if (/START_DIALOG[\s.]+PUBLIC_KEY: (\d+)/.test(comment.body)
				&& comment.author !== this._username) {
				result.add(comment.author);
			}
		}
		return Array.from(result);
	}

	async getDialog(toUser) {
		if (this._dialogs[toUser]) return this._dialogs[toUser];
		const comments = await golos.api.getAllContentReplies(toUser, await this.getDRE(toUser));
		for (const comment of comments) {
			if (comment.author === this._username
				&& /START_DIALOG[\s.]+PUBLIC_KEY: \d+/.test(comment.body)) {
				this._dialogs[toUser] = comment.permlink;
				return comment.permlink;
			}
		}
		throw 'can\'t get dialog';
	}

	async getReceiver(fromUser) {
		if (this._receivers[fromUser]) return this._receivers[fromUser];
		const comments = await golos.api.getAllContentReplies(this._username, await this.getDRE());
		for (const comment of comments) {
			if (comment.author === fromUser
				&& /START_DIALOG[\s.]+PUBLIC_KEY: \d+/.test(comment.body)) {
				return (this._receivers[fromUser] = comment.permlink);
			}
		}
		throw 'can\'t get receiver';
	}

	_comment(toUser = '', parentPermlink, permlink, title, body) {
		return new Promise((resolve, reject) => {
			golos.broadcast.comment(
				this._postingKey, toUser, parentPermlink, this._username, permlink, title, body, {
					// TODO: think about metadata
					tags: ["source-code", "fit4code", 'graphigram'],
					app: "golos.io/0.1",
					format: "html",
				}, (err, res) => {
					if (err) {
						return reject(err);
					}
					resolve(res);
				});
		});
	}

	async receiveMessages(fromUser) {
		const result = [];
		const receiver = await this.getReceiver(fromUser);
		console.log(await golos.api.getAllContentReplies(
			this._username, await this.getDRE(),
		));
		const messagesInformation = (await golos.api.getAllContentReplies(
			this._username, await this.getDRE(),
		)).filter((messageInfo) =>
			messageInfo.parent_permlink === receiver
			&& messageInfo.title === 'MESSAGE'
			&& messageInfo.author === fromUser,
		);
		for (let messageInfo of messagesInformation) {
			result.push(decryptMessage(messageInfo.body, await this._getKey(fromUser)));
		}
		return result;
	}

	async sendMessage(toUser, message) {
		const dialog = await this.getDialog(toUser);
		await this._comment(
			this._username,
			dialog,
			dialog + Session._getNewPermlink(),
			'MESSAGE', encryptMessage(message, await this._getKey(toUser)),
		);
		console.log('message has been sent');
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
