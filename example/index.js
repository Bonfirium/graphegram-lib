import Session from '../lib/Session';
import readline from 'readline';
import config from 'config';

const users = config.test.users;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: true,
});

rl.stdoutMuted = false;

rl._writeToOutput = function _writeToOutput(stringToWrite) {
	if (rl.stdoutMuted) {
		rl.output.write("\x1B[2K\x1B[200D" + rl.query + ": [" + (['|', '/', '-', '\\'][rl.line.length % 4]) + "]");
	} else rl.output.write(stringToWrite);
};

const question = (query) => new Promise((resolve) => {
	rl.question(query, resolve);
});

(async () => {
	const session = new Session();
	await session.signUp(users[0].username, users[0].postingKey);
	console.log('commands:');
	console.log('\tgetAllInterlocutors');
	while (true) {
		const command = await question('\nEnter command: ');
		switch (command) {
			case 'getAllInterlocutors':
				console.log(await session.getAllInterlocutors());
				break;
		}
	}
})().catch((err) => {
	console.error(err);
	process.exit(1);
}).finally(() => {
	rl.close();
	process.exit(0);
});
