/// <reference path="../vendor/jquery-plugins.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {selectLanguage} from './language';

const STORAGE_KEY = 'mmlxr:editor.profile';

export class ProfileManagerStatic implements LazySingleton {

	ready: boolean;

	constructor() {
		$(() => this.init());
	}

	private init() {
		selectLanguage();
		this.load();
		$(window).on('unload', () => this.save());
		this.ready = true;
	}

	private load(): boolean {
		var item = localStorage.getItem(STORAGE_KEY);
		if (item == null) return false;
		var data = JSON.parse(item);
		if (data == null) return false;
		if (data.splitters) {
			for (var id of Object.keys(data.splitters)) {
				$(`#${id}.uix.splitter`).splitter('set', data.splitters[id]);
			}
		}
		return true;
	}

	private save() {
		var data = {
			deploy: {version: config.version},
			splitters: {}
		};
		$('.uix.splitter').each((i, e)=>{
			data.splitters[e.id] = $(e).splitter('get');
		});
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}

	get bufferMultiple(): number {
		return 2;
	}

}

export var ProfileManager = new ProfileManagerStatic();
