import sha256 from 'js-sha256';
import golos from 'golos-js';
import { encryptKey, base62 } from './MathUtils';

const GET_BLOCK_ENTRIES_INTERVAL = 20;
const DIALOG_RECEIVER_ENTRY_NOT_FOUND_ERROR = 'dialog receiver entry not found';
const ALL_ENTRIES_ARE_CHECKED = 'all entries are checked';
const DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX = 'graphigram-receiver';

export default class Session {
	constructor() {
		this.clearPrivateData = this.clearPrivateData.bind(this);
	}

	auth(username, postingPrivateKey, password) {
		return new Promise((resolve, reject) => {
			this._username = username;
			this._password = sha256(password);
			this._encryptedPostingKey = encryptKey(postingPrivateKey, this._password);
			this.startClearingPrivateDataTimer();
			console.log('Start DRE searching...');
			this.findDialogReceiverEntry(this._username).then((permlink) => {
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

	_createDialogReceiverEntry() {
		return new Promise((resolve, reject) => {
			const date = new Date();
			const permlinkPostfix = date.toISOString().replace(/[:.]/g, '-').toLowerCase();
			golos.broadcast.comment(
				base62.encode(encryptKey(this._encryptedPostingKey, this._password)), '', 'opensource', this._username,
				`${DIALOG_RECEIVER_ENTRY_PERMLINK_PREFIX}-${permlinkPostfix}`, 'Graphigram Post-DialogReceiver',
				this._getBodyForDialogReceiverEntry(), {
					tags: ["source-code", "fit4code", 'graphigram'],
					app: "golos.io/0.1",
					format: "html",
				}, (err, res) => {
					console.log('---');
					console.log(err, res);
					if (err) return reject(err);
					resolve(res);
				},
			);
		});
	}

	_dialogReceiverEntryIsValid(body) {
		return body === this._getBodyForDialogReceiverEntry();
	}

	_getBodyForDialogReceiverEntry() {
		return '<html><i>private chat post</i></html>';
	}

	findDialogReceiverEntry(username) {
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
					if (this._dialogReceiverEntryIsValid(res.body)) return resolve(permlink);
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

	startClearingPrivateDataTimer() {
		this._clearPrivateDataTimeout = setTimeout(this.clearPrivateData, 30 * 60 * 1000);
	}

	clearPrivateData() {
		if (this._clearPrivateDataTimeout) {
			clearTimeout(this._clearPrivateDataTimeout);
			this._clearPrivateDataTimeout = null;
		}
		this._password = null;
	}

	_getPostingKeyByPasswordHash(passwordSha256) {
		return encryptKey(this._encryptedPostingKey, passwordSha256);
	}

	_getPostingKeyByPassword(password) {
		const passwordSha256 = sha256(password);
		return this._getPostingKeyByPasswordHash(passwordSha256);
	}

	validate(password) {
		return new Promise((resolve, reject) => {
			const passwordSha256 = sha256(password);
			// TODO: check posting key
			// const postingKey = this._getPostingKeyByPasswordHash(passwordSha256);
			this.clearPrivateData();
			this._password = passwordSha256;
			this.startClearingPrivateDataTimer();
			return resolve();
		});
	}

	close() {
		this.clearPrivateData();
	}
}
