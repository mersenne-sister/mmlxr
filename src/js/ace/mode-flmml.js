/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2012, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */



ace.define("ace/mode/folding/flmml",["require","exports","module","ace/lib/oop","ace/range","ace/mode/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var Range = acequire("../../range").Range;
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function() {};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
	
	this.foldingMacroStartMarker = /^\s*(\$[a-zA-Z_][\w\+\#\(\)]*\s*)(\{[^\}]*\})?\s*=/;
	this.foldingCommentStartMarker = /^\s*\/\*/;
	this.foldingCommentStopMarker = /\*\//;
	/*
		^\s*
		(
			\$[a-zA-Z_][\w\+\#\(\)]*\s*
		)
		(
			\{[^\}]*\}
		)?
		\s*=
	*/

	this.getFoldWidget = function(session, foldStyle, row) {
		var line = session.getLine(row);
		if (this.foldingMacroStartMarker.test(line) || this.foldingCommentStartMarker.test(line)) return "start";
		return '';
	};

	this.getFoldWidgetRange = function(session, foldStyle, row) {
		var line = session.getLine(row);
		var startColumn = line.length;
		var maxRow = session.getLength();
		var startRow = row;
		var endRow = row;
		if (line.match(this.foldingMacroStartMarker)) {
			var tokens;
			while (row < maxRow && (tokens = session.getTokens(row))) {
				var types = tokens.map(function(t){ return t.type; });
				if (0 <= types.indexOf('punctuation.end')) break;
				row++;
			}
			endRow = row;
		}
		else if (line.match(this.foldingCommentStartMarker)) {
			line = line.replace(this.foldingCommentStartMarker, '');
			while (!this.foldingCommentStopMarker.test(line)) {
				if (maxRow-1 <= row) break;
				line = session.getLine(++row);
			}
			endRow = row;
		}
		if (startRow < endRow) {
			var endColumn = session.getLine(endRow).length;
			return new Range(startRow, startColumn, endRow, endColumn);
		}
	};

}).call(FoldMode.prototype);

});



ace.define("ace/mode/mml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var MMLHighlightRules = function() {

	this.$rules = {
		comment: [
			{
				token: "comment",
				regex: /\*\//,
				next: "start"
			},
			{
				defaultToken: "comment",
				caseInsensitive: true
			}
		],

		fmtonedata: [
			{
				token: "data.parameter",
				regex: /\}/,
				next: "start"
			},
			{
				defaultToken: "data.parameter",
				caseInsensitive: true
			}
		],
		 
		start: [
			{
				token: "comment",
				regex: /\/\*/,
				next: "comment"
			},
			{
				token: ["paren.repeat.begin", "paren.parameter"],
				regex: /(\/:)(\d*)/
			},
			{
				token: "paren.repeat.break",
				regex: /\//
			},
			{
				token: "paren.repeat.end",
				regex: /:\//
			},
			{
				token: "paren.group",
				regex: /[{}]/
			},
			{
				token: "paren.poly",
				regex: /[\[\]]/
			},
			{
				token: ["definition", "definition.parameter", "punctuation.begin"],
				regex: /(\$[a-zA-Z_][\w\+\#\(\)]*\s*)(\{[^\}]*\})?(\s*=)/
			},
			{
				token: "punctuation.end",
				regex: /;/
			},
			{
				token: "command.tune.octave",
				regex: /[<>]/
			},
			{
				token: "command.character.velocity",
				regex: /[()]/
			},
			{
				token: ["variable", "variable.parameter"],
				regex: /(\$[a-zA-Z_][\w\+\#\(\)]*\s*)(\{[^\}]*\})?/
			},
			{
				token: "variable.placeholder",
				regex: /\%[a-zA-Z_][\w\+\#\(\)]*/
			},
			{
				token: ["command.tune.octave", "command.tune.octave.parameter"],
				regex: /([oO])(\s*\-?\s*[0-9]+)?/
			},
			{
				token: ["command.tune.detune", "command.tune.detune.parameter"],
				regex: /(@[dD])(\s*\-?\s*[0-9]+)?/
			},
			{
				token: ["command.tune.noteshift", "command.tune.noteshift.parameter"],
				regex: /(@?\s*[nN][sS])(\s*\-?\s*[0-9]+)?/
			},
			{
				token: ["command.tune.midiportament", "command.tune.midiportament.parameter", "hidden"],
				regex: /(@[uU][0-3])((\s*,\s*[oO]\d+\s*[a-gA-G]\s*[#+-]?|\s*,\s*\d+|\s*,)*)?/
			},
			{
				token: "command.tune.octavereverse",
				regex: /#[oO][cC][tT][aA][vV][eE]\s+[rR][eE][vV][eE][rR][sS][eE]/
			},
			{
				token: ["command.tune.lfo", "command.tune.lfo.parameter", "hidden"],
				regex: /(@[lL])(\s*-?\s*\d*\s*(,\s*-?\s*\d*\s*){1,5})?/
			},
			{
				token: ["command.time.tempo", "command.time.tempo.parameter"],
				regex: /([tT])(\s*[\d\.]+)/
			},
			{
				token: ["command.time.length", "command.time.length.parameter"],
				regex: /([lL])(\s*\d+\.*)?/
			},
			{
				token: ["command.time.quantity", "command.time.quantity.parameter"],
				regex: /(@?\s*[qQ])(\s*\d+)?/
			},
			{
				token: ["command.time.usingpoly", "command.time.usingpoly.parameter", "command.time.usingpoly.parameter"],
				regex: /(#[uU][sS][iI][nN][gG]\s+[pP][oO][lL][yY])(\s+\d+)?(\s+\w+)?/
			},
			{
				token: ["command.time.poly", "command.time.poly.parameter"],
				regex: /(@[pP][lL])(\d+)?/
			},
			{
				token: ["command.character.velocity", "command.character.velocity.parameter"],
				regex: /(@?[vV])(\d+)?/
			},
			{
				token: ["command.character.expression", "command.character.expression.parameter"],
				regex: /(@?[xX])(\d+)?/
			},
			{
				token: ["command.character.envelope", "command.character.envelope.parameter", "hidden"],
				regex: /(@[eE])(\s*\d+\s*(,\s*\d*\s*)*)?/
			},
			{
				token: ["command.character.filter", "command.character.filter.parameter", "hidden"],
				regex: /(@[fF])(\s*[\+\-]?\s*\d+\s*(,\s*[\+\-]?\s*\d*\s*)*)?/
			},
			{
				token: ["command.character.pulsewidth", "command.character.pulsewidth.parameter"],
				regex: /(@[wW])(\s*[\+\-]?\s*\d*)?/
			},
			{
				token: ["command.character.noisefreq", "command.character.noisefreq.parameter"],
				regex: /(@[nN])(\s*\d*)?/
			},
			{
				token: ["command.character.pan", "command.character.pan.parameter"],
				regex: /(@[pP])(\s*\d*)?/
			},
			{
				token: ["command.character.formant", "command.character.formant.parameter", "command.character.formant"],
				regex: /(@\s*')(\s*[aAiIuUeEoO]?\s*)?(')?/
			},
			{
				token: ["command.character.trackmodulation", "command.character.trackmodulation.parameter", "command.character.trackmodulation.parameter"],
				regex: /(@[oOiIrRsS])(\s*\d+\s*)?(,\s*\d+)?/
			},
			{
				token: ["command.character.program", "command.character.program.parameter", "hidden"],
				regex: /(@)(\s*\d+(\s*-\s*\d*)*)/
			},
			{
				token: "command.character.velocityreverse",
				regex: /#[vV][eE][lL][oO][cC][iI][tT][yY]\s+[rR][eE][vV][eE][rR][sS][eE]/
			},
			{
				token: "command.character.fmgain",
				regex: /#[fF][mM][gG][aA][iI][nN]\s+[\-\+]?\s*[0-9]*/
			},
			{
				token: ["command.character.fmlfo", "command.character.fmlfo.parameter", "hidden"],
				regex: /(@[mM][hH])(\s*\d+\s*(,\s*\d*\s*)*)/
			},
			{
				token: ["data", "data.parameter"],
				regex: /(#[oO][pP][mMnN])(\s*@\s*\d+\s*\{)/,
				next: "fmtonedata"
			},
			{
				token: ["data.wav9", "data.wav9.parameter", "data.wav9.parameter", "data.wav9.parameter", "data.wav9.parameter"],
				regex: /(#[wW][aA][vV]9)(\s+[0-9]+\s*,)(\s*[0-9]+\s*,)(\s*[0-9]+\s*,)(\s*[0-9a-zA-Z\+\/\=]*)/
			},
			{
				token: ["data.wav10", "data.wav10.parameter", "data.wav10.parameter"],
				regex: /(#[wW][aA][vV]10)(\s+[0-9]+\s*,)([0-9a-fA-F\s]*)/
			},
			{
				token: ["data.wav13", "data.wav13.parameter", "data.wav13.parameter"],
				regex: /(#[wW][aA][vV]13)(\s+[0-9]+\s*,)([0-9a-fA-F\s]*)/
			},
			{
				token: ["data", "data.parameter"],
				regex: /^(\s*#[a-zA-Z]+)(.*)/
			},
			{
				token: ["entity", "entity.suffix", "entity.parameter"],
				regex: /([a-gA-G])([\#\-\+]*)([\d\.]*)/
			},
			{
				token: ["entity.rest", "entity.rest.suffix", "entity.rest.parameter"],
				regex: /([rR])([\#\-\+]*)([\d\.]*)/
			},
			{
				token: "command.parameter",
				regex: /[\d\.\,]+/
			},
			{
				token: "command.time.tie",
				regex: /&/
			},
			{
				token: "space",
				regex: /\s+/
			}
		]
	};
	
	this.normalizeRules();
};

MMLHighlightRules.metaData = {
	fileTypes: ["mml", "flmml"],
	foldingStartMarker: "/\\*",
	foldingStopMarker: "\\*/",
	// keyEquivalent: "^~M",
	name: "FlMML",
	scopeName: "song.flmml"
}


oop.inherits(MMLHighlightRules, TextHighlightRules);

exports.MMLHighlightRules = MMLHighlightRules;
});



ace.define("ace/mode/flmml",["require","exports","module","ace/lib/oop","ace/mode/text","ace/snippets","ace/lib/lang","ace/mode/mml_highlight_rules","ace/mode/folding/flmml","ace/snippets/flmml"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var MMLHighlightRules = acequire("./mml_highlight_rules").MMLHighlightRules;
var FoldMode = acequire("./folding/flmml").FoldMode;
var snippetManager = acequire("../snippets").snippetManager;
var lang = acequire("../lib/lang");
var docHTML = acequire("../snippets/flmml").docHTML;

var Mode = function() {
	this.HighlightRules = MMLHighlightRules;
	this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {

	this.blockComment = {start: "/*", end: "*/"};

	// this.getNextLineIndent = function(state, line, tab) {
	//     return this.$getIndent(line);
	// };

	// this.checkOutdent = function(state, line, input) {
	//     return false;
	// };

	// // Example https://github.com/ajaxorg/ace-builds/blob/master/src/mode-php.js
	// // Comment out "langTools.setCompleters(...)" in MMLEditor.ts to enable this
	// this.getCompletions = function(state, session, pos, prefix) {
	// 	var token = session.getTokenAt(pos.row, pos.column);
	// 	if (!token) return [];
	// 	var line = session.getLine(pos.row).substr(0, pos.column);
	// 	console.log(token.type, line);
	// 	return [];
	// };

	// this.toggleCommentLines = function(){
	// 	console.log(arguments);
	// };

	this.completer = {
		getCompletions: function(editor, session, pos, prefix, callback) {
			var snippetMap = snippetManager.snippetMap;
			var completions = [];
			snippetManager.getActiveScopes(editor).forEach(function(scope) {
				var snippets = snippetMap[scope] || [];
				for (var i = snippets.length; i--;) {
					var s = snippets[i];
					var caption = s.name || s.tabTrigger;
					if (!caption) continue;
					completions.push({
						caption: caption,
						snippet: s.content,
						meta: s.tabTrigger && !s.name ? s.tabTrigger + "\u21E5 " : "snippet",
						type: "snippet"
					});
				}
			}, this);
			callback(null, completions);
		},
		getDocTooltip: function(item) {
			if (item.type == "snippet" && !item.docHTML) {
				var doc = docHTML[item.caption] || {};
				if (typeof doc == 'string') {
					doc = docHTML[doc] || {};
				}
				var d = doc[window.selectedLanguage];
				if (!d) d = doc['ja'];
				item.docHTML = [
					"<b>", lang.escapeHTML(item.caption), "</b>", "<hr></hr>",
					d || 'Press <b>F1</b> to open FlMML Document'
				].join("");
			}
		}
	};

	// this.getCompletions = function(editor, session, pos, prefix, callback) {
	// 	var wordScore = wordDistance(session, pos, prefix);
	// 	var wordList = Object.keys(wordScore);
	// 	callback(null, wordList.map(function(word) {
	// 		return {
	// 			caption: word,
	// 			value: word,
	// 			score: wordScore[word],
	// 			meta: "local",
	// 			identifierRegex: /@\d+/
	// 		};
	// 	}));
	// };

	this.$id = "ace/mode/flmml";
}).call(Mode.prototype);

exports.Mode = Mode;
});
