var express = require('express');
var router = express.Router();
var config = module.parent.exports.get('config');
var request = require('request-promise');
var cheerio = require('cheerio');

function scrapeTitleFromComment(id) {
	return new Promise(function(resolve, reject){
		request({
			resolveWithFullResponse: true,
			method: 'GET',
			url: 'http://dic.nicovideo.jp/mml_id/' + id,
			encoding: 'UTF-8'
		})
			.catch(function(r){
				console.log('rejected');
				reject(r);
			})
			.then(function(r){
				// Scrape title from the comment
				if (!r || !r.body) reject({ name: 'Request Failed' });
				var resid = (((r.request||{}).uri||{}).href||'').replace(/^.+#/, '');
				if (!resid) reject({ name: 'Request failed' });
				var $ = cheerio.load(r.body);
				var $head = $('a[name='+resid+']').parent('.reshead');
				var $body = $head.next('.resbody');
				var author = $head.find('span.name').text().replace(/^\s+|\s+$/g, '');
				var contents = $body.contents();
				var i=0;
				for (; i<contents.length; i++) {
					var $n = contents[i];
					if ($n.type == 'tag' && $n.name == 'img') break;
				}
				i++;
				for (; i<contents.length; i++) {
					var $n = contents[i];
					if ($n.type != 'text') continue;
					var m = $n.data.match(/^\s*タイトル\s*[:：]\s*([^\n]+?)\s*(\n|$)/);
					if (!m || m[1]=='') continue;
					resolve({ id:id, author:author, title:m[1] });
					return;
				}
				reject({ name: 'Scraping failed' });
			});
	});
}

router.get('/mml/:id(\\d+)/meta', function (req, res) {
	var id = req.params.id;
	scrapeTitleFromComment(id)
		.then(function(meta){
			res.set('Content-Type', 'text/plain; charset=UTF-8');
			res.send(JSON.stringify(meta));
		})
		.catch(function(r){
			res.status(r.statusCode || 500);
			var e = {
				error: r ? r.statusCode || r.cause && r.cause.code || r.name : 'unknown'
			};
			res.send(JSON.stringify(e));
		});
});

router.get('/mml/:id(\\d+)', function (req, res) {
	var id = req.params.id;
	var result = {};
	scrapeTitleFromComment(id)
		.catch(function(){
			// Ignore errors
		})
		.then(function(result_){
			result = result_;
			return request({
				resolveWithFullResponse: true,
				method: 'GET',
				url: 'http://dic.nicovideo.jp/mml/' + id,
				encoding: 'UTF-8'
			});
		})
		.then(function(r){
			res.status(r.statusCode);
			res.set('Content-Type', 'text/plain; charset=UTF-8');
			result.mml = r.body;
			res.send(JSON.stringify(result));
		})
		.catch(function(r){
			res.status(r.statusCode || 500);
			var e = {
				error: r ? r.statusCode || r.cause && r.cause.code || r.name : 'unknown'
			};
			res.send(JSON.stringify(e));
		});
});

module.exports = router;
