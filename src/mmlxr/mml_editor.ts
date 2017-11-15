/// <reference path="../vendor/jquery-plugins.d.ts" />
/// <reference path="../vendor/brace.d.ts" />
/// <reference path="config.d.ts" />
/// <reference path="interfaces.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {App} from './app';
import {UI} from './ui';
import {Autosave} from './autosave';
import {PianoRoll} from './piano_roll';
import {FlmmlAnalyzer} from './flmml_analyzer';
import {L} from './language';
import * as Utils from './utils';
import toastr = require('toastr');

var Range = ace['acequire']('ace/range').Range;
var language_tools = ace['acequire']('ace/ext/language_tools');
var keybinding_menu = ace['acequire']('ace/ext/keybinding_menu');

interface IWAV9Entry {
	id: number;
	start: number;
	loop: boolean;
	base64: string;
}

export class MMLEditorStatic implements LazySingleton {

	ready: boolean;
	ace: AceAjax.Editor;
	
	private confirmNeededBefore: boolean = false;

	constructor() {
		$(() => this.init());
	}

	private init() {
		// var snippetManager = ace['acequire']('ace/snippets').snippetManager;
		var config = ace['acequire']('ace/config');

		// config.set('modePath', 'ace');
		// config.set('themePath', 'ace');

		this.ace = ace.edit('editor-mml');
		this.ace.$blockScrolling = Infinity;
		this.ace['setAnimatedScroll'](true);
		this.ace.setTheme('ace/theme/flmml');
		this.ace.getSession().setMode('ace/mode/flmml');
		this.ace.getSession().setUseWrapMode(false);//true);
		this.ace.setShowPrintMargin(false);
		// this.ace.setKeyboardHandler('ace/keyboard/vim');
		this.ace.setOptions({
			enableBasicAutocompletion: true,
			enableSnippets: true,
			enableLiveAutocompletion: false
		});
		
		// Prevent focusing by tab key during modal is shown
		this.ace['textInput'].getElement().tabIndex = -1;
		
		// Disable textCompleter (ignore local text)
		language_tools.setCompleters(this.ace['completers'] = [ace['acequire']('ace/mode/flmml').Mode.prototype.completer]);
		
		// Override autocomplete popup width
		var autocomplete = ace['acequire']('ace/autocomplete').Autocomplete;
		var fn = autocomplete.startCommand.exec;
		autocomplete.startCommand.exec = (editor)=>{
			fn(editor);
			var popup = editor.completer.getPopup();
			popup.container.style.width = '30em';
			popup.resize();
		};
		
		// Enable keyboard shortcut help
		this.ace.commands.addCommand({
			name: "showKeyboardShortcuts",
			bindKey: { win: "Ctrl-Alt-h", mac: "Command-Alt-h" },
			exec: (editor)=>{
				keybinding_menu.init(editor);
				editor.showKeyboardShortcuts();
			}
		});

		// Autosave (as Rescue) for every time type text
		this.ace['on']('change', ()=>this.onEditorChange());

		this.ready = true;
	}

	onEditorChange() {
		var confirmNeeded = !Autosave.autosaveProtected && !!this.mml.match(/\S/);
		if (confirmNeeded) this.enableConfirm(); else this.disableConfirm();
		Autosave.lazyStore();
	}

	private enableConfirm() {
		if (this.confirmNeededBefore) return;
		this.confirmNeededBefore = true;
		$(window).on('beforeunload', ()=>{
			$(()=>{
				setTimeout(()=>{
					toastr.info(L('Please select "Protect at autosaving" from the Menu to protect your current MML.'));
				}, 500);
			});
			return L('Your current MML is autosaved but not protected.');
		});
	}

	private disableConfirm(force?: boolean) {
		if (!this.confirmNeededBefore && !force) return;
		this.confirmNeededBefore = false;
		$(window).off('beforeunload');
	}

	get mml(): string {
		return this.ace.getSession().getValue().replace(/\r\n/g, "\n");
	}

	get mmlSanitized(): string {
		return this.mml
			.replace(/\/\*.*?\*\//g, '')
			.replace(/`.*?`/g, '');
	}

	analyze(): FlmmlAnalyzer {
		return new FlmmlAnalyzer(this.mml);
	}

	searchWAV9(): IWAV9Entry[] {
		var regex = new RegExp(<any>/^#WAV9\s+([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*(.+?)\s*$/gm);
		var result = [];
		var mml = this.mmlSanitized;
		var m;
		while ((m = regex.exec(mml)) != null) {
			console.log(m);
			var id = parseInt(m[1]);
			if (isNaN(id)) continue;
			result.push({
				id: id,
				start: parseInt(m[2]),
				loop: !!parseInt(m[3]),
				base64: m[4]
			});
		}
		return result;
	}

	load(mml: string): void {
		var regex = new RegExp(<any>/^(\s*)(\$LOOP|\$REPEAT)(\s*=\s*)(\d+)(\s*;)/mi);
		var p: any; // workaround to avoid type mismatch
		var select: any;
		p=Utils.watchVar(this, 'ready')
			.then(()=>{
				var m = mml.match(regex);
				if (!m) return Promise.resolve(false);
				var cnt = parseInt(m[4]);
				if (cnt < 5) return Promise.resolve(false);
				return UI.confirm(
					L('Loop variable detected'),
					L('The variable %s = %s seems to be used as the loop count. Do you want to override the smaller value in order to reduce the compile time?', m[2], m[4]),
					L('Set to 1'),
					L('Ignore')
				);
			})
			.then(()=>{
				mml = mml.replace(regex, '$1$2$31$5');
				var m = regex.exec(mml);
				var i = m.index + m[1].length + m[2].length + m[3].length;
				var n = m[4].length;
				var s = mml.substr(0, i);
				select = {
					r: s.match(/\n/g).length,
					c: s.replace(/^[\s\S]*\n/, '').length,
					n: n
				};
			})
			.catch(()=>{
				console.log('Loop variable is not modified');
			});
			p=p.then(()=>{
				this.ace.clearSelection();
				this.ace.getSession().setValue(mml);
				if (select) {
					var range: AceAjax.Range = new Range(select.r, select.c, select.r, select.c + select.n);
					this.ace.getSession().getSelection().setSelectionRange(range);
				}
				this.ace.focus();
				this.disableConfirm(true);
				PianoRoll.syncLocator(0);
				App.resetTimediff(true);
				App.play(mml, true, true);
				this.onEditorChange();
			});
	}

	showSuccessToast(title?: string, author?: string) {
		var $msg = $('<div></div>');
		var analyzer = this.analyze();
		if (title==null) title = analyzer.title;
		if (author==null) author = analyzer.author;
		if (title != null) $('<div></div>').text(title).appendTo($msg);
		if (author != null) $('<div></div>').text('by ' + author).appendTo($msg);
		toastr.success($msg.html(), L('Import succeeded'));
	}

	scrollToLine(row: number) {
		this.ace.focus();
		this.ace.clearSelection();
		this.ace.resize(true);
		this.ace.scrollToLine(row, true, true, $.noop);
	}

	scrollHCenter() {
		var cursor = this.ace.renderer['$cursorLayer'].getPixelPosition(0).left;
		var scrollerWidth = this.ace.renderer['$size'].scrollerWidth;
		this.ace.renderer.scrollToX(Math.max(0, cursor - scrollerWidth/2));
	}

	selectRange(row: number, col: number, len: number): void {
		this.scrollToLine(row);
		var range: AceAjax.Range = new Range(row, col, row, col + len);
		this.ace.getSession().getSelection().setSelectionRange(range);
		this.scrollHCenter();
	}

	moveTo(row: number, col: number): void {
		this.scrollToLine(row);
		this.ace.moveCursorTo(row, col);
		this.scrollHCenter();
	}

	private get endPos(): AceAjax.Position {
		var r = this.ace.getSession().getLength() - 1;
		return {
			row: r,
			column: this.ace.getSession().getLine(r).length
		};
	}
	
	private forceLastEmptyLine(): AceAjax.Position {
		var pos = this.endPos;
		if (0 < pos.column) {
			this.ace.getSession().insert(pos, "\n");
			pos = this.endPos;
		}
		return pos;
	}

	appendLine(text: string, dontMove: boolean=false): AceAjax.Position {
		var pos0: AceAjax.Position = this.ace.getCursorPosition();
		var pos = this.forceLastEmptyLine();
		this.ace.getSession().insert(pos, text.replace(/\n?$/, "\n"));
		if (dontMove) this.moveTo(pos0.row, pos0.column);
		return pos;
	}

	appendAndSelect(text: string, index: number, len: number): void {
		var pos = this.appendLine(text);
		this.selectRange(pos.row, index, len);
	}

}

export var MMLEditor = window['MMLEditor'] = new MMLEditorStatic();
