/// <reference path="../vendor/jquery-plugins.d.ts" />
/// <reference path="interfaces.d.ts" />

import {App} from './app';
import {Autosave} from './autosave';
import {MMLEditor} from './mml_editor';
import {UI} from './ui';
import {L} from './language';
import * as Utils from './utils';

import moment = require('moment');
import Cookies = require('js-cookie');
import Octokat = require('octokat');

const NONCE_EXPIRE_MSEC = 60000;

export class GistStatic implements LazySingleton {

	ready: boolean;
	octo: Octokat;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		if (this.receiveToken()) App.startups.push({
			priority: 10,
			callback: ()=>this.openImporter()
		});
		Utils.registerSubscribers({
			'cmd.file.import.gist' : () => this.openImporter()
		});
		
		this.ready = true;
	}

	private receiveToken(): boolean {
		var token = JSON.parse(Cookies.get('access_token') || 'null');
		Cookies.remove('access_token', { path: '' });
		if (!token) return false;
		do {
			if (!token.token || !token.nonce) break;
			var nonce = JSON.parse(sessionStorage.getItem('mmlxr:auth.github.nonce') || 'null');
			sessionStorage.removeItem('mmlxr:auth.github.nonce');
			if (!nonce || !nonce.at || !nonce.nonce) break;
			if (token.nonce != nonce.nonce) break;
			if (nonce.at < (new Date()).getTime() - NONCE_EXPIRE_MSEC) break;
			sessionStorage.setItem('mmlxr:auth.github.token', token.token);
			return true;
		} while (false);
		toastr.error(L('Invalid token was found. The operation was aborted.'));
		return false;
	}

	requestGithub(): Promise<Octokat> {
		return new Promise((resolve, reject)=>{
			if (this.octo) {
				$(()=>resolve(this.octo));
				return;
			}
			var token = sessionStorage.getItem('mmlxr:auth.github.token');
			if (token) {
				this.octo = new Octokat({ token: token });
				$(()=>resolve(this.octo));
				return;
			}
			UI.block('Transferring');
			var nonce = {
				at: (new Date()).getTime(),
				nonce: Utils.randomHex(16)
			};
			sessionStorage.setItem('mmlxr:auth.github.nonce', JSON.stringify(nonce));
			location.href = `auth/github/oauth?nonce=${nonce.nonce}`;
		});
	}

	openImporter() {
		App.stop();
		App.resetTimediff(true);
		var selectedGist;
		var p: any; // workaround to avoid type mismatch
		p=Autosave.confirmUnprotected()
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
			p=p.then(()=>{
				UI.block('Loading');
				return this.requestGithub()
			})
			.then(octo=>{
				if (!octo) return null;
				console.log(this, this.octo);
				return octo.gists.fetch();
			})
			.catch(error=>{
				UI.unblock();
				toastr.error(L('Failed to authenticate'));
			});
			p=p.then(gists=>{
				if (!gists) return null;
				console.log(gists);
				UI.unblock();
				return this.createSelector(gists);
			})
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
			p=p.then(gist=>{
				if (!gist) return null;
				console.log(gist);
				selectedGist = gist;
				return this.octo.gists(gist.id).fetch();
			})
			.then(data=>{
				if (!data) return null;
				var mml = data.files[selectedGist.selected_file].content;
				var title = selectedGist.selected_file.replace(/\.(mml|flmml|txt)$/i, '');
				Autosave.newAutosaveId();
				MMLEditor.load(mml);
				MMLEditor.showSuccessToast(title);
			})
			.catch(error=>{
				if (error==null) return;
				toastr.error(L('Failed to import MML'));
			});
	}

	// updateGist(id: string, fileName: string) {
	// 	UI.block('Exporting');
	// 	var data = { files: {} };
	// 	data.files[fileName] = { content: MMLEditor.mml };
	// 	this.requestGithub()
	// 		.then(octo=>{
	// 			return octo.gists(id).update(data);
	// 		})
	// 		.then(result=>{
	// 			UI.unblock();
	// 			toastr.success(L('Export succeeded'));
	// 		})
	// 		.catch(error=>{
	// 			if (error==null) return;
	// 			toastr.error(L('Failed to export MML'));
	// 		});
	// }

	createSelector(gists: any[]): Promise<any> {
		if (gists.length == 0) {
			return UI.alert('No file found');
		}
		return new Promise((resolve, reject)=>{
			var modal = $('#modal-gistselector');
			var tbody = modal.find('tbody').empty();
			var onClick = (evt)=>{
				var $e = $(evt.target);
				var fileName = $e.data('file');
				var gist = $e.closest('tr.gist').data('gist');
				gist.selected_file = fileName;
				reject = null;
				modal.modal('hide');
				resolve(gist);
			};
			
			for (var gist of gists) {
				var tr = $('<tr class="gist"></tr>')
					.data('gist', gist)
					.appendTo(tbody);
				if (gist.description != null && gist.description != '') {
					tr.attr('data-title', Object.keys(gist.files).join(', '))
					  .attr('data-content', gist.description)
					  .attr('data-variation', 'wide');
				}
				var files = $('<td></td>').appendTo(tr);
				for (var fileName of Object.keys(gist.files)) {
					$('<a class="file"></a>')
						.appendTo(files)
						.data('file', fileName)
						.text(fileName)
						.on('click', onClick);
				}
				files.find('a:not(:first-child)').before('<span>, </span>');
				if (!gist.public) $('<div class="ui horizontal mini label">SECRET</div>').appendTo(files);
				$('<td style="white-space:nowrap"></td>')
					.text(moment(gist.updatedAt).format('YYYY/MM/DD hh:mm'))
					.appendTo(tr);
			}
			
			modal
				.modal({
					onHide: ()=>{
						if (reject) reject(null);
					}
				})
				.modal('show');
			
			$(()=>{
				modal.find('table').tablesort();
				modal.find('[data-content]').popup();
			});
		});
	}

}

export var Gist = new GistStatic();
