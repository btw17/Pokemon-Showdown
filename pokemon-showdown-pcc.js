#!/usr/bin/env node

// Before running, ensure that the Typescript files have been compiled.
//
// Simply doing `require('../build')` here doesn't work because the `replace`
// step of the build is asynchronous and we can't wait for it to finish easily
// unless we shell out and use `execSync`. However, the heuristic of simply
// checking for the presence of  './.sim-dist/dex' to determine whether a build
// is required is somewhat risky as it only is valid from a clean repository -
// if you make edits or have previous build artifacts lying arround, this
// script could potentially be missing additional sources or the compiled output
// may be out of date.
//
// We're OK with risking being stale here unless we're starting the server
// because we want to keep this script as fast as possible to be usable as a way
// of interfacing with the simulator from non-JS languages. Otherwise we error
// on the side of caution and run `node build` to ensure we're always running
// with the latest code.
let built = false;
function build() {
	require('child_process').execSync('node build', { stdio: 'inherit', cwd: __dirname });
	built = true;
}

try {
	require.resolve('./.sim-dist/dex');
} catch (err) {
	if (err.code !== 'MODULE_NOT_FOUND') throw err; // should never happen
	build();
}

if (!process.argv[2] || /^[0-9]+$/.test(process.argv[2])) {
	// Start the server.
	//
	// The port the server should host on can be passed using the second argument
	// when launching with this file the same way app.js normally allows, e.g. to
	// host on port 9000:
	// $ ./pokemon-showdown 9000

	if (!built) build();
	require('module')._load('./server', module, true);
} else switch (process.argv[2]) {
	case 'help':
	case 'h':
	case '?':
	case '-h':
	case '--help':
	case '-?':
		console.log('pokemon-showdown start [PORT]');
		console.log('');
		console.log('  Starts a PS server on the specified port');
		console.log('  (Defaults to the port setting in config/config.js)');
		console.log('  (The port setting in config/config.js defaults to 8000)');
		console.log('');
		console.log('pokemon-showdown generate-team [FORMAT-ID [RANDOM-SEED]]');
		console.log('');
		console.log('  Generates a random team, and writes it to stdout in packed team format');
		console.log('  (Format defaults to "gen7randombattle")');
		console.log('');
		console.log('pokemon-showdown validate-team [FORMAT-ID]');
		console.log('');
		console.log('  Reads a team from stdin, and validates it');
		console.log('  If valid: exits with code 0');
		console.log('  If invalid: writes errors to stderr, exits with code 1');
		console.log('');
		console.log('pokemon-showdown simulate-battle');
		console.log('');
		console.log('  Simulates a battle, taking input to stdin and writing output to stdout');
		console.log('  Protocol is documented in ./.sim-dist/README.md');
		console.log('');
		console.log('pokemon-showdown unpack-team');
		console.log('');
		console.log('  Reads a team from stdin, writes the unpacked JSON to stdout');
		console.log('');
		console.log('pokemon-showdown pack-team');
		console.log('');
		console.log('  Reads a JSON team from stdin, writes the packed team to stdout');
		console.log('  NOTE for all team-processing functions: We can only handle JSON teams');
		console.log('  and packed teams; the PS server is incapable of processing exported');
		console.log('  teams.');
		console.log('');
		console.log('pokemon-showdown help');
		console.log('');
		console.log('  Displays this reference');
		break;
	case 'start':
		{
			console.log("Starting PCC Pokemon Build!");
			process.argv[2] = process.argv[3];
			if (!built) build();
			require('module')._load('./server', module, true);
			break;
		}
	case 'generate-team':
		{
			let Dex = require('./.sim-dist/dex').Dex;
			global.toID = Dex.getId;
			let seed = process.argv[4] ? process.argv[4].split(',').map(Number) : undefined;
			console.log(Dex.packTeam(Dex.generateTeam(process.argv[3], { seed })));
		}
		break;
	case 'validate-team':
		{
			let Dex = require('./.sim-dist/dex').Dex;
			let TeamValidator = require('./.sim-dist/team-validator').TeamValidator;
			let validator = TeamValidator.get(process.argv[3]);
			let Streams = require('./.lib-dist/streams');
			let stdin = new Streams.ReadStream(process.stdin);

			stdin.readLine().then(function (textTeam) {
				try {
					let team = Dex.fastUnpackTeam(textTeam);
					let result = validator.validateTeam(team);
					if (result) {
						console.error(result.join('\n'));
						process.exit(1);
					}
					process.exit(0);
				} catch (e) {
					console.error(e);
					process.exit(1);
				}
			});
		}
		break;
	case 'simulate-battle':
		{
			let BattleTextStream = require('./.sim-dist/battle-stream').BattleTextStream;
			let Streams = require('./.lib-dist/streams');
			let stdin = new Streams.ReadStream(process.stdin);
			let stdout = new Streams.WriteStream(process.stdout);

			let battleStream = new BattleTextStream({
				debug: process.argv[3] === '--debug'
			});
			battleStream.start();
			stdin.pipeTo(battleStream);
			battleStream.pipeTo(stdout);
		}
		break;
	case 'unpack-team':
		{
			let Dex = require('./.sim-dist/dex').Dex;
			let Streams = require('./.lib-dist/streams');
			let stdin = new Streams.ReadStream(process.stdin);

			stdin.readLine().then(function (packedTeam) {
				try {
					let unpackedTeam = Dex.fastUnpackTeam(packedTeam);
					console.log(JSON.stringify(unpackedTeam));
					process.exit(0);
				} catch (e) {
					console.error(e);
					process.exit(1);
				}
			});
		}
		break;
	case 'pack-team':
		{
			let Dex = require('./.sim-dist/dex').Dex;
			let Streams = require('./.lib-dist/streams');
			let stdin = new Streams.ReadStream(process.stdin);

			stdin.readLine().then(function (unpackedTeam) {
				try {
					let packedTeam = Dex.packTeam(JSON.parse(unpackedTeam));
					console.log(packedTeam);
					process.exit(0);
				} catch (e) {
					console.error(e);
					process.exit(1);
				}
			});
		}
		break;
	default:
		console.error('Unrecognized command: ' + process.argv[2]);
		console.error('Use `pokemon-showdown help` for help');
		process.exit(1);
}
