var express = require('express');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var stylus = require('stylus');
var nib = require('nib');
var yaml = require('js-yaml');
var basicAuth = require('basic-auth-connect');
var favicon = require('serve-favicon');
var app = module.exports = express();

function P(filePath) {
	var p = filePath.split('/');
	p.unshift(__dirname);
	return path.resolve.apply(path, p);
}

function loadText(filePath) {
	var result = null;
	try {
		result = fs.readFileSync(P(filePath), 'utf8');
	}
	catch (ex){
		result = null;
	}
	return result;
}

var deploy = {
	environment: (
		loadText('.deploy-env') ||
		'develop'
	).replace(/\s+$/, ''),
	commitHash: (
		loadText('.deploy-hash') ||
		child_process.execSync('git log -1 --format=%H', {cwd:__dirname}).toString()
	).replace(/\s+$/, ''),
	version: (
		loadText('.deploy-version') ||
		child_process.execSync('git describe --tags --abbrev=0', {cwd:__dirname}).toString()
	).replace(/\s+$/, '')
};

console.log(deploy);

var config = yaml.safeLoad(loadText('config.yml'))[deploy.environment];
if (!config) throw 'Invalid Environment';
config.deploy = deploy;
app.set('config', config);

var language = { en:{} };
fs.readdirSync(P('language')).forEach(function(file){
	if (!file.match(/\.yml$/i)) return;
	var l = yaml.safeLoad(loadText('language/' + file));
	language[file.replace(/\.yml$/i, '')] = l;
});
app.set('language', language);

app.set('port', config._port);
if (config._basicAuth) app.use(basicAuth(config._basicAuth._user, config._basicAuth._pass));
app.set('view engine', 'jade');
app.set('views', P('src/views'));
app.use(stylus.middleware({
	src: P('src/style'),
	dest: P('build/css'),
	debug: true,
	force: true,
	compile: function(str, path) {
		return stylus(str)
			.set('filename', path)
			.set('compress', false)
			.use(nib());
	}
}));

if (deploy.environment == 'develop') {
	app.use(express.static(P('static')));
	app.use('/js/flmmlworker.js', express.static(P('FlMMLonHTML5/flmmlworker.js')));
	app.use('/js/flmmlworker.map.js', express.static(P('FlMMLonHTML5/flmmlworker.map.js')));
	app.use('/js/dpcm-worker.js', express.static(P('dpcm-worker/dist/dpcm-worker.js')));
	app.use('/js/dpcm-worker.map.js', express.static(P('dpcm-worker/dist/dpcm-worker.map.js')));
	app.use('/js', express.static(P('libmp3lame-js/dist')));
	app.use('/components/semantic-ui', express.static(P('Semantic-UI/dist')));
}

app.use('/components/jquery', express.static(P('node_modules/jquery/dist')));
app.use(favicon(P('static/favicon.ico')));
app.use(express.static(P('build')));

if (config.enableDemo) app.use('/_mmlref', express.static(P('_mmlref')));

app.use('/', require('./routes/index'));
app.use('/auth/google', require('./routes/auth-google'));
app.use('/nicovideo', require('./routes/nicovideo'));

app.listen(config._port, function() {
	console.log('Node app is running on port', config._port);
});

