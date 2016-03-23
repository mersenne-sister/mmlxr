/// <reference path="../vendor/semantic-ui.d.ts" />

export class NoteTabStatic {

	constructor() {
	}

	show() {
		$('a.item[data-tab="region-pianoroll-note"]').tab('change tab', 'region-pianoroll-note');
	}

}

export var NoteTab = new NoteTabStatic();
