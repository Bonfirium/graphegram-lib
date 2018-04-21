import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62 } from './MathUtils';

const POSTS_INTERVAL = 5;
const ALL_ENTRIES_ARE_CHECKED = 'all entries are checked';
const DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX = 'graphigram-receiver';

export const DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR = 'dialog receiver entry not found';

export default class Session {
	constructor() {
		this._clearPrivateData = this._clearPrivateData.bind(this);
	}

	/**
	 * @param {String} username
	 * @param {String} postingPrivateKey
	 * @param {String} password
	 * @return {Promise<undefined>}
	 */
	signUp(username, postingPrivateKey, password) {
		return new Promise((resolve, reject) => {
			this._username = username;
			this._password = sha256(password);
			this._encryptedPostingKey = encryptKey(postingPrivateKey, this._password);
			this._startClearingPrivateDataTimeout();
			console.log('Start DRE searching...');
			Session.findDialogReceiverEntry(this._username).then((permlink) => {
				console.log(`DRE has been found: ${permlink}`);
				this._dialogReceiverEntryPermlink = permlink;
				resolve();
			}).catch((error) => {
				if (error === DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR) {
					console.log('DRE not found, creating...');
					this._createDialogReceiverEntry()
						.then((res) => {
							console.log('DRE has been created: ' + res);
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
	_createDialogReceiverEntry() {
		return new Promise((resolve, reject) => {
			const date = new Date();
			const permlinkPostfix = date.toISOString().replace(/[:.]/g, '-').toLowerCase();
			golos.broadcast.comment(
				base62.encode(encryptKey(this._encryptedPostingKey, this._password)), '', 'opensource', this._username,
				`${DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX}-${permlinkPostfix}`, 'Graphigram Post-DialogReceiver',
				Session._getBodyForDialogReceiverEntry(), {
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
	static _dialogReceiverEntryIsValid(body) {
		return body === Session._getBodyForDialogReceiverEntry();
	}

	/**
	 * @private
	 * @static
	 * @return {String}
	 */
	static _getBodyForDialogReceiverEntry() {
		return '<html><i>private chat post</i></html>';
	}

	static _findDialogInPosts(username, posts, index = 0) {
		return new Promise((resolve, reject) => {
			if (index === posts.length) return reject(DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR);
			const nextStep = () => Session._findDialogInPosts(username, posts, index + 1).then(resolve).catch(reject);
			const permlink = posts[index].permlink;
			golos.api.getContent(username, permlink)
				.then((post) => {
					if (Session._dialogReceiverEntryIsValid(post.body)) return resolve(permlink);
					return nextStep();
				})
				.catch(reject);
		});
	};

	/**
	 * @static
	 * Returns permlink of DRE or throws DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR if DRE not found
	 * @param {String} username
	 * @param {Number} start
	 * @param {String} lastCheckedPermlink
	 * @return {Promise<String>}
	 */
	static findDialogReceiverEntry(username, start = POSTS_INTERVAL - 1, lastCheckedPermlink = '') {
		return new Promise((resolve, reject) => {
			golos.api.getBlog(username, start, POSTS_INTERVAL)
				.catch(reject)
				.then((postsInfo) => {
					console.log(postsInfo.map((postInfo) => postInfo.comment.permlink));
					const DREPosts = postsInfo
						.map(({ comment: post }) => post)
						.filter((post) => post.permlink.indexOf(DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX) === 0);
					const nextStep = (lastCheckedPermlink) => Session
						.findDialogReceiverEntry(username, start + POSTS_INTERVAL, lastCheckedPermlink)
						.then(resolve)
						.catch(reject);
					if (DREPosts.length === 0) return nextStep(lastCheckedPermlink);
					if (DREPosts[0].permlink === lastCheckedPermlink) return reject(DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR);
					Session._findDialogInPosts(username, [...DREPosts].reverse())
						.then(resolve)
						.catch((error) => (error === DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR ?
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
	 * @param {String} passwordSha256
	 * @return {Buffer}
	 */
	_getPostingKeyByPasswordHash(passwordSha256) {
		return encryptKey(this._encryptedPostingKey, passwordSha256);
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

	send(username, message) {
		return new Promise((resolve, reject) => {
			golos.api.getAllContentRepliesAsync(this._username, this._dialogReceiverEntryPermlink, (err, res) => {
				if (err) return reject(err);
				console.log(res.map((a) => a.body));
				resolve(res);
			});
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
