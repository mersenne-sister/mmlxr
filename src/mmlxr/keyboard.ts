/// <reference path="../../typings/browser.d.ts" />
/// <reference path="../vendor/hotkeys.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {MMLEditor} from './mml_editor';

import hotkeys = require('hotkeys');
import PubSub = require('pubsub-js');

export type Keymap = {[keyCombination:string]: string};
export type KeymapReversed = {[routingKey:string]: string[]};

// f2: used by Ace
// @todo f8: disable in production (prevent to stop by Chrome debugger)
// f11: used by browser (to toggle fullscreen mode on Windows)
// @todo f12: disable in production (prevent to open Windows Chrome devtools)

var defaultKeymap: string[][] = [
	//Windows             Mac                 PubSub routing key
	[ 'ctrl s'          , 'cmd s'          , 'trigger.dummy'                           ],
	[ 'ctrl shift s'    , 'cmd shift s'    , 'trigger.global.file.save.download'       ],
	[ 'ctrl shift b'    , 'cmd shift b'    , 'trigger.global.file.backup.autosave'     ],
	[ 'ctrl o'          , 'cmd o'          , 'trigger.global.file.open.autosave'       ],
	[ 'ctrl alt h'      , 'cmd alt h'      , 'trigger.global.help.editor.keybind'      ], // Ace's default
	[ 'ctrl enter'      , 'cmd enter'      , 'trigger.global.transport.playOrStop'     ],
	[ 'ctrl shift enter', 'cmd shift enter', 'trigger.global.transport.pause'          ],
	[ 'ctrl r'          , 'cmd r'          , 'trigger.global.transport.compile'        ],
	[ 'f1'              , 'f1'             , 'trigger.global.menu.open'                ],
	[ 'shift f1'        , 'shift f1'       , 'trigger.global.help.flmml.toc'           ],
	[ 'f3'              , 'f3'             , 'trigger.global.mixer.master.volume.down' ],
	[ 'f4'              , 'f4'             , 'trigger.global.mixer.master.volume.up'   ],
	[ 'f5'              , 'f5'             , 'trigger.global.transport.playOrStop'     ],
	[ 'f6'              , 'f6'             , 'trigger.global.transport.pause'          ],
	[ 'f7'              , 'f7'             , 'trigger.global.transport.compile'        ]
];

export class KeyboardStatic implements LazySingleton {

	ready: boolean;
	dispatcher: hotkeys.Dispatcher;
	keymap: Keymap;
	keymapReversed: KeymapReversed;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		var keymap: Keymap = {};
		for (var m of defaultKeymap) {
			var k = m[$.browser.mac ? 1 : 0];
			keymap[k] = m[2];
		}
		this.register(keymap);
		this.ready = true;
	}

	register(keymap: Keymap) {
		this.keymap = $.extend({}, keymap);
		if (!this.dispatcher) this.dispatcher = new hotkeys.Dispatcher();
		this.keymapReversed = {};
		Object.keys(this.keymap).forEach((key) => {
			var routingKey = this.keymap[key];
			this.dispatcher.on(key, ()=>{
				var msg = { key: key, by: 'hotkey' };
				PubSub.publish(routingKey, msg, true, null);
			});
			this.keymapReversed[routingKey] = this.keymapReversed[routingKey] || [];
			this.keymapReversed[routingKey].push(key);
		});
		
		document.body.addEventListener('keydown', (evt)=>{
			switch (evt.keyCode) {
				case 9: // tab
					if (0 < $('.ui.modal.active, .ui.dropdown.active').length) return;
					if (MMLEditor.ace.isFocused()) return;
					evt.stopPropagation();
					evt.preventDefault();
					MMLEditor.ace.focus();
					break;
			}
		});
	}

	// parseKey(evt: KeyboardEvent): string {
	// 	return this.dispatcher.getKeymap()._keycodes.keyIdForCode(evt.keyCode);
	// }

}

export var Keyboard = new KeyboardStatic();
