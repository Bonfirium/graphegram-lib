import { Session } from '../lib';
import config from 'config';

const { users } = config.test;

const session = new Session();

describe('connection to graphigram', () => {
	it('successful', (done) => {
		session.signUp(users[0].username, users[0].postingKey, 'qweasd')
			.then(() => done())
			.catch(done);
	}).timeout(15000);
	it('hasConnection', (done) => {
		session.isConnectionExists(users[0].username, users[1].username)
			.then(() => done())
			.catch(done);
	}).timeout(15000);
	it('channel creation', (done) => {
		session.createChannel(users[1].username)
			.then(() => done())
			.catch(done);
	})
});
