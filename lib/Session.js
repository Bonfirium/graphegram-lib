import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62 } from './MathUtils';

const GET_BLOCK_ENTRIES_INTERVAL = 20;
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

	/**
	 * @static
	 * Returns permlink of DRE or throws DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR if DRE not found
	 * @param {String} username
	 * @return {Promise<String>}
	 */
	static findDialogReceiverEntry(username) {
		return new Promise((resolve, reject) => {
			let lastPermLink = '';
			const checkOneEntry = (entries, index = 0) => new Promise((resolve, reject) => {
				if (index === entries.length) return reject(DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR);
				const permlink = entries[index].permlink;
				if (permlink === lastPermLink) return reject(ALL_ENTRIES_ARE_CHECKED);
				if (index === 0) {
					lastPermLink = permlink;
				}
				golos.api.getContent(username, permlink, (err, res) => {
					if (Session._dialogReceiverEntryIsValid(res.body)) return resolve(permlink);
					checkOneEntry(entries, index + 1).then(resolve).catch(reject);
				});
			});
			const checkEntries = (start = GET_BLOCK_ENTRIES_INTERVAL) => new Promise((resolve, reject) => {
				golos.api.getBlogEntries(username, start, GET_BLOCK_ENTRIES_INTERVAL, (err, res) => {
					if (err) return reject(err);
					const graphigramReceiverEntries =
						res.filter((entry) => entry.permlink.indexOf(DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX) === 0);
					if (graphigramReceiverEntries.length === 0) {
						const permlink = res[0].permlink;
						if (lastPermLink === permlink) return reject(DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR);
						lastPermLink = permlink;
						return checkEntries(start + GET_BLOCK_ENTRIES_INTERVAL).then(resolve).catch(reject);
					}
					res = graphigramReceiverEntries;
					checkOneEntry(res).then(resolve).catch((error) => {
						switch (error) {
							case DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR:
								return checkEntries(start + GET_BLOCK_ENTRIES_INTERVAL).then(resolve).catch(reject);
							case ALL_ENTRIES_ARE_CHECKED:
								return reject(DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR);
							default:
								return reject(error);
						}
					});
				});
			});
			checkEntries().then(resolve).catch(reject);
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
