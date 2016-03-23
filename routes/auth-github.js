var express = require('express');
var router = express.Router();
var config = module.parent.exports.get('config');

var Github = require('github');
var OAuth2 = require('oauth').OAuth2;

function githubOAuth() {
	return new OAuth2(
		config.github.clientId,
		config.github._clientSecret,
		'https://github.com/',
		'login/oauth/authorize',
		'login/oauth/access_token'
	);
}

router.get('/oauth', function (req, res) {
	if (!req.query.nonce) {
		res.status(400);
		var e = {
			error: 'Parameter "nonce" must be specified'
		};
		res.send(JSON.stringify(e));
		return;
	}
	var oauth = githubOAuth();
	res.redirect(oauth.getAuthorizeUrl({
		redirect_uri: config.urlRoot + '/auth/github/callback',
		scope: 'gist',
		state: req.query.nonce
	}));
});

router.get('/callback', function (req, res) {
	var oauth = githubOAuth();
	oauth.getOAuthAccessToken(
		req.query.code,
		{},
		function (err, access_token, refresh_token) {
			if (err) {
				console.log(err);
				res.send(err);
				return;
			}
			if (access_token) {
				var c = {
					token: access_token,
					nonce: req.query.state
				};
				res.cookie('access_token', JSON.stringify(c), {
					maxAge: 60000,
					httpOnly: false,
					secure: config.urlRoot.match(/^https:/)
				});
			}
			res.redirect(config.urlRoot);
		}
	);
});

module.exports = router;
