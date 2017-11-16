var express = require('express');
var router = express.Router();
var config = module.parent.exports.get('config');

var google = require('googleapis');

function googleDriveOAuth() {
	return new google.auth.OAuth2(
		config.googleDrive.clientId,
		config.googleDrive._clientSecret,
		config.urlRoot + '/auth/google-drive/callback'
	);
}

router.get('/oauth', function (req, res) {
	var auth = googleDriveOAuth();
	var url = auth.generateAuthUrl({ scope: config.googleDrive.scope });
	res.redirect(url);
});

router.get('/callback', function (req, res) {
	var auth = googleDriveOAuth();
	auth.getToken(req.query.code, function(err, tokens) {
		if (err) {
			console.log('Error while trying to retrieve access token', err);
			return;
		}
		res.redirect(config.urlRoot + '?' + querystring.stringify(tokens));
		// access_token=...&token_type=Bearer&expiry_date=1454053703763
		
		// auth.credentials = tokens;
		// var drive = google.drive({ version: 'v2', auth: auth });
		// drive.files.insert({
		// 	resource: {
		// 		title: 'My Document',
		// 		mimeType: 'text/plain'
		// 	},
		// 	media: {
		// 		mimeType: 'text/plain',
		// 		body: 'Hello World!'
		// 	}
		// }, console.log);

	});
});

module.exports = router;
