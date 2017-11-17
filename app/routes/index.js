var express = require('express');
var router = express.Router();
var config = module.parent.exports.get('config');
var language = module.parent.exports.get('language');

var path = require('path');
var fs = require('fs');
var deepfilter = require('deep-filter');

var publicConfig = deepfilter(config, function(value, prop, subject){
	return prop[0] != '_';
});

var vars = {
	config: publicConfig,
	language: language,
	licenses: {
		brace              : 'node_modules/brace/LICENSE',
		express            : 'node_modules/express/LICENSE',
		FlMMLonHTML5       : 'FlMMLonHTML5/LICENSE',
		googleMaterialColor: 'node_modules/google-material-color/LICENSE',
		gulp               : 'node_modules/gulp/LICENSE',
		jade               : 'node_modules/jade/LICENSE',
		jquery             : 'node_modules/jquery/LICENSE.txt',
		moment             : 'node_modules/moment/LICENSE',
		stylus             : 'node_modules/stylus/LICENSE',
		typescript         : 'node_modules/typescript/LICENSE.txt',
		webpack            : 'node_modules/webpack/LICENSE'
	}
};
for (var k of Object.keys(vars.licenses)) {
	var p = vars.licenses[k].split(/\//);
	p.unshift(path.dirname(path.dirname(__dirname)));
	vars.licenses[k] = fs.readFileSync(path.resolve.apply(path, p), 'utf8');
}

router.get('/', function (req, res) {
	res.render('index', vars);
});

router.get('/manual', function (req, res) {
	res.render('manual', vars);
});

module.exports = router;
