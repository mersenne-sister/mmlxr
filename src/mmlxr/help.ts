/// <reference path="lazy_singleton.d.ts" />

import * as Utils from './utils';

export class HelpStatic implements LazySingleton {

	ready: boolean;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		Utils.registerSubscribers({
			'cmd.help.manual': () => window.open('./manual'),
			'cmd.help.flmml.toc': () => window.open('https://web.archive.org/web/20171224104922/http://flmml.codeplex.com/documentation'),
			'cmd.help.about': () => $('#modal-about').modal('show')
		});
		this.ready = true;
	}

}

export var Help = new HelpStatic();
