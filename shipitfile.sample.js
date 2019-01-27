module.exports = function (shipit) {

	require('shipit-deploy')(shipit);
	require('shipit-submodule')(shipit);
	require('shipit-npm')(shipit);

	var fs = require('fs');
	var path = require('path');
	var shellescape = require('shell-escape');

	shipit.initConfig({
		default: {
			servers: 'foo@mersenne-sister.net:port', // your server
			workspace: '/tmp/github-monitor',
			repositoryUrl: 'https://github.com/mersenne-sister/mmlxr.git', // your fork repository
			ignores: ['.git', 'node_modules'],
			keepReleases: 5,
			rsync: ['--del'],
			deleteOnRollback: false,
			shallowClone: false,
			submodules: true
		},
		staging: {
			deployTo: '/home/foo/shipit/mmlxr-st', // target directory to deploy
			branch: 'develop'
		},
		production: {
			deployTo: '/home/foo/shipit/mmlxr', // target directory to deploy
			branch: 'master'
		}
	});

	shipit.blTask('rebuild', function(){
		var dir = path.join(shipit.releasesPath, shipit.releaseDirname);
		return shipit.remote([
			shellescape(['cd', dir]),
			'gulp rebuild',
			shellescape(['cd', shipit.config.deployTo]),
			'cd \\$( readlink current )',
			'( pm2 stop mmlxr.' + shipit.environment + '; exit 0 )'
		].join(' && '));
	});

	shipit.blTask('stop', function(){
		let id = 'mmlxr.' + shipit.environment;
		return shipit.remote(`pm2 stop ${id}`);
	});

	shipit.blTask('start', function(){
		let id = 'mmlxr.' + shipit.environment;
		let cmd = shellescape(['pm2', 'start', '--name', id, shipit.currentPath + '/app/app.js']);
		return shipit.remote(`pm2 restart ${id} || ${cmd}`);
	});

	shipit.blTask('ls', function(){
		return shipit.remote('pm2 ls');
	});

	shipit.on('npm_installed', function(){
		return shipit.start('rebuild');
	});

	shipit.on('published', function(){
		return shipit.start('start');
	});

	shipit.on('deployed', function(){
		return shipit.start('ls');
	});

	shipit.on('fetched', function(){
		fs.createReadStream(path.join(__dirname, 'config.yml'))
			.pipe(fs.createWriteStream(path.join(shipit.config.workspace, 'config.yml')));
		return shipit.local(
			[
				'git log remotes/shipit/'+shipit.config.branch+' -1 --format=%H > .deploy-hash',
				'git describe --tags --abbrev=0 > .deploy-version',
				shellescape(['echo', shipit.environment]) + ' > .deploy-env'
			].join(' && '),
			{
				cwd: shipit.config.workspace
			}
		);
	});

};
