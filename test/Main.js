import golos from 'golos-js';
import { Session } from '../lib';
import config from 'config';

const username = config.test.username;
const postingKey = config.test.postingKey;

const session = new Session();

describe('connection to graphigram', () => {
	after(() => {
		session.close();
	});
	it('successful', (done) => {
		session.signUp(username, postingKey, 'qweasd').catch((err) => {
			throw err;
		}).then(() => done());
	}).timeout(15000);
});
