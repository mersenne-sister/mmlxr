ace.define("ace/autocomplete/util",["require","exports","module"], function(acequire, exports, module) {
"use strict";

exports.parForEach = function(array, fn, callback) {
	var completed = 0;
	var arLength = array.length;
	if (arLength === 0)
		callback();
	for (var i = 0; i < arLength; i++) {
		fn(array[i], function(result, err) {
			completed++;
			if (completed === arLength)
				callback(result, err);
		});
	}
};

var ID_REGEX = /[a-zA-Z_0-9\$\@\#]/;
var ID_TOKEN_REGEX = /^(@(\d+(-\d*)?|[a-zA-Z]+\d*|'[aeiou]?'?)?|#?([a-zA-Z]\w*(\s+[a-zA-Z]\w*)*)?)$/;
/*
	^(
		@(
			\d+(-\d*)?
			|
			[a-zA-Z]+\d*
			|
			'[aeiou]?'?
		)?
		|
		#?(
			[a-zA-Z]\w*
			(
				\s+[a-zA-Z]\w*
			)*
		)?
	)$
*/

exports.retrievePrecedingIdentifier = function(text, pos, regex) {
	console.log('retrievePrecedingIdentifier', text, pos, regex);
	if (regex) {
		var buf = [];
		for (var i = pos-1; i >= 0; i--) {
			if (regex.test(text[i]))
				buf.push(text[i]);
			else
				break;
		}
		return buf.reverse().join("");
	}
	else {
		var token = '';
		for (var i = pos-1; i >= 0; i--) {
			var t = text.substr(i, pos-i);
			console.log(t, ID_TOKEN_REGEX.test(t));
			if (ID_TOKEN_REGEX.test(t)) {
				token = t;
			}
			else {
				if (token != '') return token;
			}
		}
		return token;
	}
};

exports.retrieveFollowingIdentifier = function(text, pos, regex) {
	console.log('retrieveFollowingIdentifier', text, pos, regex);
	regex = regex || ID_REGEX;
	var buf = [];
	for (var i = pos; i < text.length; i++) {
		if (regex.test(text[i]))
			buf.push(text[i]);
		else
			break;
	}
	return buf;
};

});
