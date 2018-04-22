import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62 } from './crypto/Encryption';
import { getPrivateKey, getPublicKey } from './crypto/DiffieHellman';

const DRE_PERMLINK_PREFIX = 'graphigram-receiver';
// TODO: set RECEIVING_POSTS_COUNT to average user posts count
const RECEIVING_POSTS_COUNT = 100;
// const

export const DRE_NOT_FOUND_ERROR = 'dialog receiver entry not found';

export default class Session {
	constructor() {
		this._clearPrivateData = this._clearPrivateData.bind(this);
	}

	/**
	 * @param {String} username
	 * @param {String} postingKey
	 * @param {String} password
	 * @return {Promise<undefined>}
	 */
	signUp(username, postingKey, password) {
		return new Promise((resolve, reject) => {
			this._username = username;
			// this._password = sha256(password);
			// this._encryptedPostingKey = encryptKey(postingKey, this._password);
			this._postingKey = postingKey;
			this._keys = {};
			// this._startClearingPrivateDataTimeout();
			console.log('Start DRE searching...');
			Session.findDRE(this._username).then((permlink) => {
				console.log(`DRE has been found: ${permlink}`);
				this._drePermlink = permlink;
				resolve();
			}).catch((error) => {
				if (error === DRE_NOT_FOUND_ERROR) {
					console.log('DRE not found, creating...');
					this._createDRE()
						.then((res) => {
							console.log('DRE has been created: ' + res);
							this._drePermlink = res.operations[0][1].permlink;
							resolve();
						})
						.catch(reject);
					return;
				}
				reject(error);
			});
		});
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
	_createDRE() {
		return new Promise((resolve, reject) => {
			const date = new Date();
			golos.broadcast.comment(
				this._postingKey, '', 'opensource', this._username,
				Session._getNewPermlink(), 'Graphigram Post-DialogReceiver',
				Session._getBodyForDRE(), {
					// TODO: think about metadata
					tags: ["source-code", "fit4code", 'graphigram'],
					app: "golos.io/0.1",
					format: "html",
				}, (err, res) => {
					if (err) return reject(err);
					resolve(res);
				},
			);
		});
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
	 * @param {Number?} index
	 * @return {Promise<any>}
	 */
	static _findDREInPosts(username, posts, index = 0) {
		return new Promise((resolve, reject) => {
			if (index === posts.length) return reject(DRE_NOT_FOUND_ERROR);
			const nextStep = () => Session._findDREInPosts(username, posts, index + 1).then(resolve).catch(reject);
			const permlink = posts[index].permlink;
			golos.api.getContent(username, permlink)
				.then((post) => {
					if (Session._dreIsValid(post.body)) return resolve(permlink);
					return nextStep();
				})
				.catch(reject);
		});
	};

	/**
	 * @static
	 * Returns permlink of DRE or throws DRE_NOT_FOUND_ERROR if DRE not found
	 * @param {String} username
	 * @param {Number} start
	 * @param {String} lastCheckedPermlink
	 * @return {Promise<String>}
	 */
	static findDRE(username, start = RECEIVING_POSTS_COUNT - 1, lastCheckedPermlink = '') {
		return new Promise((resolve, reject) => {
			golos.api.getBlog(username, start, RECEIVING_POSTS_COUNT)
				.catch(reject)
				.then((postsInfo) => {
					if (postsInfo.length === 0) return reject(DRE_NOT_FOUND_ERROR);
					const DREPosts = postsInfo
						.map(({ comment: post }) => post)
						.filter((post) => post.permlink.indexOf(DRE_PERMLINK_PREFIX) === 0);
					const nextStep = (lastCheckedPermlink) => Session
						.findDRE(username, start + RECEIVING_POSTS_COUNT, lastCheckedPermlink)
						.then(resolve)
						.catch(reject);
					if (DREPosts.length === 0) return nextStep(lastCheckedPermlink);
					if (DREPosts[0].permlink === lastCheckedPermlink) return reject(DRE_NOT_FOUND_ERROR);
					Session._findDREInPosts(username, [...DREPosts].reverse())
						.then(resolve)
						.catch((error) => (error === DRE_NOT_FOUND_ERROR ?
							nextStep(DREPosts[0].permlink) : reject(error)));
				});
		});
	}

	/** @private */
	_startClearingPrivateDataTimeout() {
		if (this._clearPrivateDataTimeout) throw new Error('clearing private data timeout has already been started');
		this._clearPrivateDataTimeout = setTimeout(this._clearPrivateData, 30 * 60 * 1000);
	}

	/** @private */
	_clearPrivateData() {
		if (this._clearPrivateDataTimeout) {
			clearTimeout(this._clearPrivateDataTimeout);
			this._clearPrivateDataTimeout = null;
		}
		this._password = null;
	}

	/**
	 * @private
	 * @param {String} hash
	 * @return {Buffer}
	 */
	_getPostingKeyByPasswordHash(hash) {
		return encryptKey(this._encryptedPostingKey, hash);
	}

	/**
	 * @private
	 * @param {String} password
	 * @return {Buffer}
	 */
	_getPostingKeyByPassword(password) {
		const passwordSha256 = sha256(password);
		return this._getPostingKeyByPasswordHash(passwordSha256);
	}

	/**
	 * @private
	 * @param {String} interlocutorName
	 * @return {Promise<Buffer>}
	 */
	_getCryptoKey(interlocutorName) {
		return new Promise((resolve, reject) => {
		});
	}

	async _initChannel(withUser) {
		const privateKey = this._keys[withUser] = getPrivateKey(this._postingKey, withUser);
		const publicKey = getPublicKey(privateKey);
		return await this._sendPublicKey(publicKey, withUser);
	}

	createChannel(withUser) {
		return new Promise(async (resolve, reject) => {
			try {
				if (await this.hasConnectionWithUser(withUser)) return reject('channel already created');
				resolve(await this._initChannel(withUser));
			} catch (err) {
				reject(err);
			}
		});
	}

	async hasConnectionWithUser(username) {
		if (this._keys[username]) return true;
		for (const comment of await golos.api.getAllContentReplies(this._username, this._drePermlink)) {
			if (comment.author !== username) continue;
			const anotherPublicKey = (/START_DIALOG.+PUBLIC_KEY: (\d+)/.exec(comment.body) || [null, null])[1];
			if (!anotherPublicKey) continue;
			await this._initChannel(username);
			return true;
		}
		return false;
	}

	static _getNewPermlink() {
		return `${DRE_PERMLINK_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
	}

	_sendPublicKey(publicKey, toUser) {
		return new Promise((resolve, reject) => {
			Session.findDRE(toUser)
				.then((permlink) => {
					const drePermlink = permlink;
					golos.broadcast.comment(
						this._postingKey, toUser, drePermlink, this._username,
						Session._getNewPermlink(), 'CHANNEL_CREATION',
						`START_DIALOG.\nPUBLIC_KEY: ${publicKey}`, {
							// TODO: think about metadata
							tags: ["source-code", "fit4code", 'graphigram'],
							app: "golos.io/0.1",
							format: "html",
						}, (err, res) => {
							if (err) return reject(err);
							console.log('public key has been sent');
							resolve(res);
						},
					);
				});
		});
	}

	send(username, message) {
		return new Promise((resolve, reject) => {
		});
	}

	/**
	 * @todo check posting key
	 * @param {String} password
	 * @return {Promise<undefined>}
	 */
	signIn(password) {
		return new Promise((resolve, reject) => {
			const passwordSha256 = sha256(password);
			// const postingKey = this._getPostingKeyByPasswordHash(passwordSha256);
			this._clearPrivateData();
			this._password = passwordSha256;
			this._startClearingPrivateDataTimeout();
			return resolve();
		});
	}

	close() {
		this._clearPrivateData();
	}
}
