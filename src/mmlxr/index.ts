/// <reference path="../vendor/jquery-plugins.d.ts" />

// require('css-loader!semantic-ui-css');
// require('css-loader!toastr-css');
require('script-loader!jquery');
require('script-loader!hammerjs');
require('script-loader!jquery-hammerjs');
require('script-loader!jquery-splitter');
require('script-loader!jquery-tablesort');
require('script-loader!jquery.browser');
require('script-loader!semantic-ui');
require('brace');
require('brace/ext/language_tools');
require('brace/ext/keybinding_menu');
require('brace/ext/searchbox');
require('ace/theme/flmml');
require('ace/mode/flmml');
require('ace/snippets/flmml');

const SPLASH_MIN_TIME_MSEC = 3500;

var __ready = $.fn.ready;
$.fn.ready = function(fn){
	return __ready(function(h){
		try {
			fn(h);
		}
		catch (ex) {
			setTimeout(function(){
				if (UI)
					UI.alert(ex.toString());
				else
					alert(ex);
			});
			throw ex;
		}
	});
};

// @todo: Hook errors in PubSub.subscribe
// @todo: Hook errors in setTimeout (make wrapper)
// @todo: Hook errors in Promise.prototype.constructor (make wrapper)

import {App} from './app';
import {ProfileManager} from './profile_manager';
import {FileManager} from './file_manager';
import {Autosave} from './autosave';
import {Help} from './help';
import {Keyboard} from './keyboard';
import {Menu} from './menu';
import {Mixer} from './mixer';
import {MMLEditor} from './mml_editor';
import {UI} from './ui';
import {WaveGenerator} from './wave_generator';
import {L} from './language';

var modules: LazySingleton[] = [
	ProfileManager,
	FileManager,
	Autosave,
	Help,
	Keyboard,
	Menu,
	Mixer,
	MMLEditor,
	UI,
	WaveGenerator
];

var start = (new Date()).getTime();
var retryCount = 0;
var fn = ()=>{
	var readyCount = modules.filter((m)=>m.ready).length;
	// console.log(readyCount, modules.length);
	if (modules.length <= readyCount) {
		var t = SPLASH_MIN_TIME_MSEC - ((new Date()).getTime() - start);
		if (config.browserRecommended) setTimeout(()=>{
			$('#initial-loader').css('opacity', 0.0);
			setTimeout(()=>$('#initial-loader').remove(), 1000);
			App.startup();
		}, Math.max(0, t));
		return;
	}
	if (100 <= ++retryCount)
		alert('Unable to boot');
	else
		setTimeout(fn, 50);
};

$(()=>{
	if (config.browserSupported) {
		fn();
		$(() => App.boot());
		$('#region').css('visibility', 'visible');
	}
});
