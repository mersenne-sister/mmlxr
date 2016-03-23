/// <reference path="../vendor/semantic-ui.d.ts" />

export class ErrorTabStatic {

	constructor() {
	}

	show() {
		$('a.item[data-tab="region-pianoroll-error"]').tab('change tab', 'region-pianoroll-error');
	}

}

export var ErrorTab: ErrorTabStatic = new ErrorTabStatic();
