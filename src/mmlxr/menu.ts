/// <reference path="../../typings/browser.d.ts" />
/// <reference path="../vendor/semantic-ui.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {Keyboard} from './keyboard';
import * as Utils from './utils';

import PubSub = require('pubsub-js');

const keySymbols = {
	win: {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	},
	mac: {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		cmd: '&#8984;',
		shift: '&#8679;',
		alt: '&#8997;'
	}
};

export class MenuStatic implements LazySingleton {

	DROPDOWN_DURATION: number = 150;

	ready: boolean;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		Utils.registerSubscribers({
			'cmd.menu.open' : ()=>this.openMenu()
		});

		// Workaround for the bug about tapping submenu
		$('.ui.dropdown .menu .item .menu .item')
			.each((i, e)=>{
				var $e = $(e);
				$e.attr('data-desc-value', $e.attr('data-value'));
				$e.removeAttr('data-value');
				$e.hammer().on('tap', function(evt){
					var key = $(this).attr('data-desc-value');
					var msg = { key: key, by: 'menu' };
					PubSub.publish(key, msg, true, null);
					$(() => $('#ctrl-menu').dropdown('hide'));
				});
			});
		
		$('.ui.dropdown').dropdown({
			allowTab: true,
			action: 'hide',
			transition: 'fade',
			duration: this.DROPDOWN_DURATION,
			onShow: function() {
				if (event['shiftKey'])
					$('.beta', this).show();
				else
					$('.beta', this).hide();
			},
			onChange: function(key){
				var msg = { key: key, by: 'menu' };
				PubSub.publish(key, msg, true, null);
				$(() => $('#ctrl-menu').dropdown('hide'));
			}
		});

		$('a.ui.button.item').each((i, e)=>{
			$(e).hammer().on('tap', function(evt){
				var key = $(this).attr('data-value');
				var msg = { key: key, by: 'menu' };
				PubSub.publish(key, msg, true, null);
			});
		});

		PubSub.subscribe('trigger', (key, msg)=>{
			if (0 < $('.ui.modal.active, .ui.dropdown.active').length) return;
			key = key.replace(/^trigger\.\w+\./, 'cmd.');
			PubSub.publish(key, msg, true, null);
		});

		Utils.watchVar(Keyboard, 'ready')
			.then(()=>{
				$('.item[data-value^="trigger"], .item[data-desc-value^="trigger"]').each((i, e)=>{
					var $e = $(e);
					var os = $.browser.mac ? 'mac' : 'win';
					var routingKey = $e.attr('data-desc-value') || $e.attr('data-value');
					var keyCombis = Keyboard.keymapReversed[routingKey];
					if (!keyCombis) return;
					var keyCombisHTML = keyCombis.map((keyCombi)=>{
						return keyCombi.split(/ +/).map((key) => {
							return keySymbols[os][key] || key.replace(/^\w/, (c)=>c.toUpperCase());
						}).join($.browser.mac ? '' : '+');
					}).join(' | ');
					
					if ($e.hasClass('icon') && $e.attr('title')) {
						var title = $e.attr('title');
						var keyCombisText = $('<textarea></textarea>').html(keyCombisHTML).val();
						title = title.replace(/\s+\([^\)]+\)$/, '');
						title += ` (${keyCombisText})`;
						$e.attr('title', title);
					}
					else {
						$('<span class="description"></span>')
							.html(keyCombisHTML)
							.insertBefore($e.find('span.text'));
					}
				});
			});

		this.ready = true;
	}

	openMenu() {
		$('#ctrl-menu').dropdown('show').focus();
	}

	isButtonEnable(id: string): boolean {
		var $e = $(`#${id}`);
		return $e.is(':visible') && !$e.hasClass('disabled');
	}

	get isCompileButtonEnable(): boolean { return this.isButtonEnable('ctrl-compile'); }
	get isPlayButtonEnable(): boolean { return this.isButtonEnable('ctrl-play'); }
	get isStopButtonEnable(): boolean { return this.isButtonEnable('ctrl-stop'); }
	get isPauseButtonEnable(): boolean { return this.isButtonEnable('ctrl-pause'); }

	updateMenuStatePlaying() {
		$('#ctrl-stop').show().removeClass('disabled');
		$('#ctrl-play').hide();
		$('#ctrl-pause').removeClass('disabled');
		$('#ctrl-compile').removeClass('disabled');
	}

	updateMenuStateStopped() {
		$('#ctrl-stop').hide();
		$('#ctrl-play').show().removeClass('disabled');
		$('#ctrl-pause').addClass('disabled');
		$('#ctrl-compile').removeClass('disabled');
	}

	updateMenuStateCompiling() {
		$('#ctrl-stop').addClass('disabled');
		$('#ctrl-play').addClass('disabled');
		$('#ctrl-pause').addClass('disabled');
		$('#ctrl-compile').addClass('disabled');
	}

}

export var Menu = new MenuStatic();
