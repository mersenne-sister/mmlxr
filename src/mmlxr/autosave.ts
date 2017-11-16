/// <reference path="interfaces.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {App} from './app';
import {MMLEditor} from './mml_editor';
import {PianoRoll} from './piano_roll';
import {NdxdbConnection, NdxdbStore} from './ndxdb';
import {UI} from './ui';
import {FlmmlAnalyzer} from './flmml_analyzer';
import {L} from './language';
import * as Utils from './utils';

import hotkeys = require('hotkeys');
import JSZip = require('jszip');
import moment = require('moment');

const STORAGE_AUTOSAVE_KEY = 'mmlxr:autosave';
const STORAGE_EDITING_KEY = 'mmlxr:editing';

export class AutosaveStatic implements LazySingleton {

	AUTOSAVE_DELAY: number = 500;
	AUTOSAVE_KEEP_COUNT: number = 5;
	ONELINE_PREVIEW_LENGTH: number = 32;

	ready: boolean;
	db: NdxdbConnection;
	ace: AceAjax.Editor;
	private lazyStoreTimeout;

	constructor() {
		this.lazyStoreTimeout = null;
		$(()=>this.init());
	}

	lazyStore() {
		this.cancelLazyStore();
		this.lazyStoreTimeout = setTimeout(() => {
			this.lazyStoreTimeout = null;
			this.store(true);
		}, this.AUTOSAVE_DELAY);
	}

	cancelLazyStore() {
		if (this.lazyStoreTimeout != null) clearTimeout(this.lazyStoreTimeout);
		this.lazyStoreTimeout = null;
	}

	private init() {
		Utils.registerSubscribers({
			'cmd.file.new'              : () => this.newFile(),
			'cmd.file.backup.autosave'  : () => this.downloadBackup(),
			'cmd.file.open.autosave'    : () => this.openLoader(),
			'cmd.file.toggle.protect'   : () => this.toggleProtect(),
		});

		// Initialize database
		this.db = new NdxdbConnection('mmlxr', 2);
		this.db.upgrade = (db:IDBDatabase, oldVersion:number)=>{
			if (oldVersion <= 1) {
				UI.alert($('#template-welcome'));
				var store = db.createObjectStore('autosave', { keyPath: 'id' });
				store.createIndex('updatedAt', 'updatedAt', { unique: false });
				console.log('DB schema upgraded');
			}
		};
		this.db.blocked = ()=>{
			toastr.warning('Could not connect to the database. Check if there are the other tabs or windows opening this page.');
		};

		// Read-only editor for preview 
		this.ace = ace.edit('editor-autosave-preview');
		this.ace.setTheme('ace/theme/flmml');
		this.ace.getSession().setMode('ace/mode/flmml');
		this.ace.getSession().setUseWrapMode(true);
		this.ace.setShowPrintMargin(false);
		this.ace.setHighlightActiveLine(false);
		this.ace.setReadOnly(true);
		this.ace.renderer.setShowGutter(false);
		
		// Modal keybindings
		var $modal = $('#modal-autosaveselector');
		var dispatcher = new hotkeys.Dispatcher(document.getElementById('modal-autosaveselector'));
		dispatcher.on('enter', ()=>$modal.find('.right.button').trigger('click'));
		dispatcher.on('up', ()=>{
			var $tr = $modal.find('table tr.active').prev();
			1 == $tr.length && $tr.trigger('click');
		});
		dispatcher.on('down', ()=>{
			var $tr = $modal.find('table tr.active').next();
			1 == $tr.length && $tr.trigger('click');
		});

		// Autosave at unload
		$(window).on('unload', () => {
			this.store();
			localStorage.removeItem(`${STORAGE_EDITING_KEY}:${this.autosaveId}`);
		});

		this.ready = true;
	}

	confirmUnprotected(): Promise<void> {
		return this.store()
			.then((entry:IAutosaveEntry)=>{
				if (entry.isProtected || !entry.mml.match(/\S/)) {
					return Promise.resolve(false);
				}
				return UI.confirm(
					L('Confirm'),
					L('Your current MML is autosaved but not protected.'),
					L('Protect'),
					L('Leave')
				);
			})
			.then((protect:boolean)=>{
				if (!protect) return null;
				this.autosaveProtected = true;
				return this.store();
			})
			.catch(()=>{
				console.log('Leave unprotected autosave');
			});
	}

	private _autosaveId: string = null;
	get autosaveId(): string {
		if (this._autosaveId == null) this.newAutosaveId();
		return this._autosaveId;
	}
	
	private setAutosaveId(id: string) {
		if (this._autosaveId != null) {
			localStorage.removeItem(`${STORAGE_EDITING_KEY}:${this._autosaveId}`);
		}
		this._autosaveId = id;
		localStorage.setItem(`${STORAGE_EDITING_KEY}:${id}`, '1');
		this.redrawFileInfo();
	}
	
	newAutosaveId() {
		this.setAutosaveId(Utils.randomHex(24));
		this.autosaveProtected = false;
		PianoRoll.history = [];
	}
	
	private _autosaveProtected: boolean = false;
	get autosaveProtected(): boolean {
		return this._autosaveProtected;
	}
	set autosaveProtected(protect: boolean) {
		this._autosaveProtected = protect;
		this.redrawFileInfo();
	}
	
	toggleProtect(protect?: boolean) {
		if (arguments.length == 0) protect = !this.autosaveProtected;
		if (protect) {
			toastr.success(L('Autosave protection is enabled.'));
			this.autosaveProtected = true;
		}
		else {
			toastr.warning(L('Autosave protection is disabled.'));
			this.autosaveProtected = false;
		}
	}
	
	redrawFileInfo() {
		$('#file-info').text('Autosave ' + this.autosaveId.substr(0,8) );
		var $check = $('a.item[data-value="trigger.global.file.toggle.protect"] .check.icon');
		if (this.autosaveProtected) {
			$('#file-info').addClass('protected')
				.prepend('<i class="ui lock icon"></i>');
			$check.show();
		}
		else {
			$('#file-info').removeClass('protected');
			$check.hide();
		}
		MMLEditor.onEditorChange();
	}

	newFile() {
		App.stop();
		App.resetTimediff(true);
		Autosave.confirmUnprotected()
			.then(()=>{
				MMLEditor.load('');
				Autosave.newAutosaveId();
			})
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
	}

	downloadBackup() {
		this.collectEntries()
			.then((entries:IAutosaveEntry[])=>{
				if (entries.length == 0) {
					toastr.warning(L('No autosave stored'));
					return;
				}
				var zip = new JSZip();
				for (var entry of entries) {
					if (entry.isProtected) zip.file(entry.id+'.flmml', entry.mml);
				}
				return zip.generateAsync({ type: "blob" });
			})
			.then((out)=>{
				var url = URL.createObjectURL(out);
				var now = moment().format('YYYYMMDD-HHmmss');
				UI.download(url, `MMLxr-${now}.zip`);
				toastr.info(L('All PROTECTED files are included in the backed up archive. Please validate the contents just to be sure.'));
			});
	}

	private recoverByLocalStorage() {
		return new Promise((resolve, reject)=>{
			var lsKeys = Object.keys(localStorage);
			var lsEntries: IAutosaveEntry[] = [];
			for (var lsKey of lsKeys) {
				if (lsKey.substr(0, STORAGE_AUTOSAVE_KEY.length+1) != STORAGE_AUTOSAVE_KEY+':') continue;
				var lsStored = localStorage.getItem(lsKey);
				var lsEntry: IAutosaveEntry = null;
				if (lsStored != null) {
					try { lsEntry = JSON.parse(lsStored); } catch (ex) {}
				}
				if (lsEntry == null) {
					localStorage.removeItem(lsKey);
				}
				else {
					lsEntries.push(lsEntry);
				}
			}
			
			this.db.tx('autosave')
				.then((autosave: NdxdbStore)=>{
					var fn = ()=>{
						if (lsEntries.length == 0) {
							resolve();
							return;
						}
						var lsEntry = lsEntries.shift();
						autosave.get(lsEntry.id)
							.then(entry=>{
								if (entry==null || lsEntry.id==entry.id && entry.updatedAt < lsEntry.updatedAt) {
									return autosave.put(lsEntry);
								}
								else {
									return null;
								}
							})
							.then(id=>{
								localStorage.removeItem(`${STORAGE_AUTOSAVE_KEY}:${lsEntry.id}`);
								fn();
							});
					};
					fn();
				});
		});
	}

	private collectEntries(removeOld: boolean=false): Promise<IAutosaveEntry[]> {
		var autosave: NdxdbStore = null;
		var result = [];
		return this.recoverByLocalStorage()
			.then(()=>{
				return this.db.tx('autosave');
			}) 
			.then((autosave_:NdxdbStore)=>{
				autosave = autosave_;
				return autosave.each();
			})
			.then((entries:IAutosaveEntry[])=>{
				entries.sort((a:IAutosaveEntry, b:IAutosaveEntry)=>{
					var p = (b.isProtected ? 1 : 0) - (a.isProtected ? 1 : 0);
					if (p != 0) return p;
					return Utils.sign(b.updatedAt - a.updatedAt);
				});
				var toDelete = [];
				
				var count = this.AUTOSAVE_KEEP_COUNT;
				for (var entry of entries) {
					// Delete old unprotected autosaves
					if (!entry.isProtected) {
						if (--count < 0) {
							if (removeOld) toDelete.push(entry.id);
							continue;
						}
					}
					
					result.push(entry);
				}
				
				return this.deleteEntries(toDelete);
			})
			.then(ok=>{
				return result;
			});
	}

	deleteEntries(ids: string[]): Promise<boolean> {
		return new Promise((resolve, reject)=>{
			this.db.tx('autosave')
				.then((autosave: NdxdbStore)=>{
					var fn = ()=>{
						if (ids.length == 0) {
							resolve(true);
							return;
						}
						console.log(`Deleting autosave ${ids[0]}`);
						localStorage.removeItem(`${STORAGE_AUTOSAVE_KEY}:${ids[0]}`);
						autosave.delete(ids.shift())
							.then(fn)
							.catch((ex)=>reject(ex));
					};
					fn();
				})
				.catch((ex)=>{
					reject(ex);
				});
		});
	}

	updateEntry(id: string, entryDiff: any): Promise<IAutosaveEntry> {
		return this.recoverByLocalStorage()
			.then(()=>{
				return this.db.tx('autosave');
			})
			.then((autosave:NdxdbStore)=>{
				return autosave.update(id, entryDiff);
			});
	}

	store(rescue: boolean = false): Promise<IAutosaveEntry> {
		this.cancelLazyStore();
		
		var entry: IAutosaveEntry = {
			id: this.autosaveId,
			updatedAt: (new Date()).getTime(),
			rescue: rescue,
			isProtected: this.autosaveProtected,
			mml: MMLEditor.mml,
			history: PianoRoll.history
		};
		
		if (!entry.mml.match(/\S/)) return Promise.resolve(entry);
		
		var lsKey = `${STORAGE_AUTOSAVE_KEY}:${entry.id}`;
		localStorage.setItem(lsKey, JSON.stringify(entry));
		
		return this.db.tx('autosave')
			.then((autosave:NdxdbStore)=>{
				console.log('autosaving', rescue ? 'as rescue' : undefined);
				return entry.mml.match(/\S/) || entry.isProtected ?
					autosave.put(entry) :
					autosave.delete(entry.id);
			})
			.then(()=>{
				localStorage.removeItem(lsKey);
				if (rescue) return Promise.resolve();
				return this.collectEntries();
			})
			.then(()=>{
				return Promise.resolve(entry);
			});
	}

	isEditing(id: string) {
		return localStorage.getItem(`${STORAGE_EDITING_KEY}:${id}`) != null;
	}

	openLoader(ignoreEmpty: boolean = false): void {
		App.stop();
		App.resetTimediff(true);

		$('#caution-autosave-keep span').text(L('Unprotected MMLs are kept upto %s and the others will be removed from older ones.', this.AUTOSAVE_KEEP_COUNT));
		$('#caution-autosave-backup span').text(L('Please "Backup Autosaves" from menu on a regular basis.'));
	
		var data: IAutosaveEntry[];
		this.confirmUnprotected()
			.then(()=>{
				return this.collectEntries(true);
			})
			.then((entries:IAutosaveEntry[])=>{
				if (entries.length == 0) {
					if (!ignoreEmpty) toastr.warning(L('No autosave stored'));
					return;
				}
				return this.createSelector(entries);
			})
			.then((entry:IAutosaveEntry)=>{
				if (!entry) return;
				MMLEditor.load(entry.mml);
				PianoRoll.history = entry.history || [];
				this.setAutosaveId(entry.id);
				this.autosaveProtected = entry.isProtected;
				toastr.success(L('Autosave loaded'));
			})
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
	}

	createSelector(entries: IAutosaveEntry[]): Promise<any> {
		return new Promise((resolve, reject)=>{
			var $modal = $('#modal-autosaveselector');
			var tbody = $modal.find('tbody').empty();
			var selectedEntry = null;
			var onClick = (evt)=>{
				var $e = $(evt.target);
				var $tr = $e.hasClass('autosave') ? $e : $e.closest('tr.autosave');
				$modal.find('tr.autosave').removeClass('active');
				$tr.addClass('active');
				selectedEntry = $tr.data('autosave');
				this.ace.getSession().setValue(selectedEntry.mml);
				$modal.find('.right.button').removeClass('disabled');
			};
			var onDblclick = (evt)=>{
				$modal.find('.right.button').trigger('click');
			};
			
			if (entries.length == 0) {
				$(()=>reject(null));
				return;
			}
			
			var $first = null;
			for (var entry of entries) {
				var $tr = $('<tr class="autosave"></tr>')
					.data('autosave', entry)
					.on('click', onClick)
					.on('dblclick', onDblclick)
					.appendTo(tbody);
				
				// Protected
				var $protect = $(`
					<td>
						<button class="ui icon button">
							<i class="unlock icon"></i>
							<i class="lock icon"></i>
						</button>
					</td>
				`)
					.attr('data-sort-value', entry.isProtected ? 1 : 0)
					.appendTo($tr);
				var $protectBtn = $protect.find('button');
				if (entry.isProtected) {
					$protectBtn.addClass('protected');
				}
				else {
					$protectBtn.addClass('unprotected');
				}
				$protectBtn.on('click', (evt)=>{
					var $e = $(evt.target);
					if (!$e.hasClass('button')) $e = $e.closest('.button');
					var $td = $e.closest('td');
					var $tr = $e.closest('tr');
					var entry = $tr.data('autosave');
					if ($e.hasClass('protected')) {
						this.updateEntry(entry.id, {isProtected:false})
							.then(entry=>{
								console.log(entry);
								$e.removeClass('protected').addClass('unprotected');
								$tr.find('.red.button').removeClass('disabled');
								$td.attr('data-sort-value', 0);
								$tr.data('autosave', entry);
								toastr.warning(L('Autosave protection is disabled.'));
							});
					}
					else if ($e.hasClass('unprotected')) {
						this.updateEntry(entry.id, {isProtected:true})
							.then(entry=>{
								console.log(entry);
								$e.removeClass('unprotected').addClass('protected');
								$tr.find('.red.button').addClass('disabled');
								$td.attr('data-sort-value', 1);
								$tr.data('autosave', entry);
								toastr.success(L('Autosave protection is enabled.'));
							});
					}
				});
				
				// Title/Preview
				$('<td></td>')
					.text(entry.id.substr(0, 8))
					.attr('title', entry.id)
					.appendTo($tr);
				if (!$first && entry.id != this.autosaveId) $first = $tr;
				var $preview = $('<td></td>').appendTo($tr);
				var preview = [];
				try {
					var analyzer = new FlmmlAnalyzer(entry.mml);
					if (analyzer.artist != null && analyzer.artist != '') preview.push(analyzer.artist);
					if (analyzer.title != null && analyzer.title != '') preview.push(analyzer.title);
				}
				catch (ex) {
				}
				if (0 < preview.length) {
					$preview.text(preview.join(' - '));
				}
				else {
					$preview.text(
						entry.mml
							.replace(/\s+/g, ' ')
							.replace(/^ | $/, '')
							.substr(0, this.ONELINE_PREVIEW_LENGTH)
					);
				}
				if (entry.id == this.autosaveId) {
					$('<div class="ui horizontal mini label">CURRENT</div>').appendTo($preview);
					$tr.addClass('disabled');
				}
				else if (this.isEditing(entry.id)) {
					$('<div class="ui horizontal mini label">EDITING</div>').appendTo($preview);
				}
				else if (entry.rescue) {
					$('<div class="ui horizontal mini label">RESCUED</div>').appendTo($preview);
				}
				
				// Updated At
				$('<td style="white-space:nowrap"></td>')
					.attr('data-sort-value', entry.updatedAt)
					.text(moment(entry.updatedAt).format('YYYY/MM/DD HH:mm'))
					.appendTo($tr);
				
				// Trash button
				var $trash = $('<td style="white-space:nowrap"></td>').appendTo($tr);
				var $trashBtn = $('<button class="ui red icon button"><i class="trash icon"></icon></button>').appendTo($trash);
				if (entry.isProtected) $trashBtn.addClass('disabled');
				$trashBtn.on('click', (evt)=>{
					var $btn = $(evt.target);
					if (!$btn.hasClass('button')) $btn = $btn.closest('.button'); 
					if ($btn.hasClass('disabled')) return;
					var $tr = $btn.closest('tr');
					var entry = $tr.data('autosave');
					var $msg = $('<div></div>');
					$('<p></p>').appendTo($msg).text(L('Are you sure to delete this item?'));
					var $table = $(`
						<table class="ui celled small table">
							<thead>
								<tr><th></th><th></th><th></th></tr>
							</thead>
							<tbody>
								<tr><td></td><td></td><td></td></tr>
							</tbody>
						</table>
					`).appendTo($msg);
					$table.find('thead tr th:nth-child(1)').text(L('Slot ID'));
					$table.find('thead tr th:nth-child(2)').text(L('Title/Preview'));
					$table.find('thead tr th:nth-child(3)').text(L('Updated At'));
					$table.find('tbody tr td:nth-child(1)').text(entry.id.substr(0, 8));
					$table.find('tbody tr td:nth-child(2)').text($tr.find('td:nth-child(3)').text());
					$table.find('tbody tr td:nth-child(3)').text($tr.find('td:nth-child(4)').text());
					UI.confirm(
						L('Confirm'),
						$msg,
						L('Delete'),
						L('Cancel'),
						true
					)
						.then(ok=>{
							if (!ok) return null;
							return this.deleteEntries([ entry.id ]);
						})
						.then(ok=>{
							console.log(ok);
							if (!ok) return null;
							toastr.success(L('The item in slot %s was successfully removed.', entry.id.substr(0, 8)));
							$tr.remove();
							$modal.modal('show');
						})
						.catch(()=>{
							console.log('Canceled');
							$modal.modal('show');
						});
				});
			}
			
			$modal
				.modal({
					onHide: ()=>{
						if (reject) reject('cancel');
					},
					onApprove: ()=>{
						console.log('onApprove');
						if (selectedEntry.id == this.autosaveId) {
							return false; // Prevent modal closing
						}
						if (!this.isEditing(selectedEntry.id)) {
							resolve(selectedEntry);
							return;
						}
						var reject_ = reject;
						reject = null;
						UI.confirm(
							L('Confirm'),
							L('This MML might be in use by another tab or window. Do you open this anyway?'),
							L('Open'),
							L('Cancel'),
							true
						)
							.then(ok=>{
								console.log(selectedEntry, resolve, reject);
								reject = null;
								resolve(selectedEntry);
								$modal.modal('hide');
							})
							.catch(error=>{
								console.log('caught', error);
								if (error=='cancel') {
									console.log('Canceled');
									reject_('cancel');
								}
								else {
									throw error;
								}
							});
					}
				})
				.modal('show');
			
			$(()=>{
				$modal.find('table').tablesort({
					sortList: [ [0,0], [3,0] ],
					textExtraction: (node:HTMLElement)=>{
						var v = node.getAttribute('data-sort-value');
						return v == null ? node.innerHTML : v;
					}
				});
				$modal.find('[data-content]').popup();
				if ($first)
					$(()=>$first.trigger('click'));
				else
					$modal.find('.right.button').addClass('disabled');
			});
		});
	}
	
}

export var Autosave = new AutosaveStatic();
