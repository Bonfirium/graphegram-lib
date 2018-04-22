import { Session } from '../lib';
import config from 'config';

const { users } = config.test;

const session = new Session();

describe('connection to graphigram', () => {
	after(() => {
		session.close();
	});
	it('successful', (done) => {
		session.signUp(users[0].username, users[0].postingKey, 'qweasd').catch((err) => {
			throw err;
		}).then(() => done());
	}).timeout(15000);
	it('hasConnection', (done) => {
		session.hasConnectionWithUser(users[1].username)
			.then(console.log)
			.then(() => done())
			.catch((err) => {
				throw err;
			});
	}).timeout(15000);
	it('channel creation', (done) => {
		session.createChannel(users[1].username)
			.then(console.log)
			.then(() => done());
	})
});
