import golos from 'golos-js';
import { Session } from '../lib';
import config from 'config';

const username = config.test.username;
const postingKey = config.test.postingKey;

const session = new Session();
session.auth(username, postingKey, 'qweasd').catch((err) => {
	console.log(`Error: ${err}`);
	session.close();
}).then(() => {
	session.close();
});


// golos.auth.verify(username, password)
