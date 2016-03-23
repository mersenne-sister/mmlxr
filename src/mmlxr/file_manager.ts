/// <reference path="../../typings/browser.d.ts" />
/// <reference path="../vendor/dropbox.d.ts" />
/// <reference path="../vendor/octokat.d.ts" />
/// <reference path="interfaces.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {App} from './app';
import {Autosave} from './autosave';
import {MMLEditor} from './mml_editor';
import {WaveGenerator} from './wave_generator';
import {UI} from './ui';
import {L} from './language';
import * as Utils from './utils';

import toastr = require('toastr');

export class FileManagerStatic implements LazySingleton {

	ready: boolean;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		Utils.registerSubscribers({
			'cmd.file.save.download'    : () => this.saveInDownloadFolder(),
			// 'cmd.file.import.local'     : () => this.importLocalFile(),
			'cmd.file.import.dropbox'   : () => this.openDropboxChooser(),
			'cmd.file.import.pikokakiko': () => this.openPikokakikoImporter()
		});

		$('#ctrl-local-file').on('change', (evt) => {
			this.importLocalFile(evt.target['files']);
		});

		// DnD
		document.body.addEventListener('dragover', (evt:DragEvent)=>{
			evt.stopPropagation();
			evt.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		}, false);
		document.body.addEventListener('drop', (evt:DragEvent)=>{
			evt.stopPropagation();
			evt.preventDefault();
			var files: FileList = evt.dataTransfer.files;
			if (!files || files.length == 0) return;
			var file = files[0];
			if (file.name.match(/\.(mml|flmml|txt)$/i)) {
				this.importLocalFile(files);
			}
			else if (file.name.match(/\.(wav|dmc)$/i)) {
				WaveGenerator.importWav9FromFile(files);
			}
		}, false);

		this.ready = true;
	}

	saveInDownloadFolder() {
		var url = URL.createObjectURL(new Blob([ MMLEditor.mml ]));
		Utils.doDownload(url, MMLEditor.analyze().fsTitle + '.flmml');
	}

	importLocalFile(files: FileList) {
		if (!files || files.length == 0) return;
		var file = files[0];
		var title = files[0].name.replace(/\.(mml|flmml|txt)$/i, '');
		var reader = new FileReader();
		reader.onload = (evt) => {
			var mml = evt.target['result'];
			Utils.resetFileInput('ctrl-local-file');
			Autosave.confirmUnprotected()
				.then(()=> {
					Autosave.newAutosaveId();
					MMLEditor.load(mml);
					MMLEditor.showSuccessToast(title);
				})
				.catch(error=> {
					if (error=='cancel') console.log('Canceled'); else throw error;
				});
		};
		reader.readAsText(file, 'UTF-8');
	}

	openDropboxChooser() {
		App.stop();
		App.resetTimediff(true);
		Autosave.confirmUnprotected()
			.then(()=>{
				Dropbox.choose({
					success: (files)=>{
						$.ajax({ url: files[0].link })
							.done((data)=>{
								var title = files[0].name.replace(/\.(mml|flmml|txt)$/i, '');
								Autosave.newAutosaveId();
								MMLEditor.load(data);
								MMLEditor.showSuccessToast(title);
							})
							.fail((xhr, type)=>{
								toastr.error(L('Failed to import MML'));
							});
					},
					cancel: ()=>{
					},
					linkType: 'direct',
					extensions: ['.mml', '.flmml', '.txt'],
				});
			})
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
	}

	openPikokakikoImporter() {
		App.stop();
		App.resetTimediff(true);
		var regex1 = /^\s*(\d+)\s*$/;
		var regex2 = /^\s*((https?:)?\/\/)?dic\.nicovideo\.jp\/mml(_id)?\/(\d+)\/?\s*$/;
		var regex3 = /<\s*img[^>]*\s+alt\s*=\s*['"](\d+)['"][^>]*>/;
		var p: any; // workaround to avoid type mismatch
		p=Autosave.confirmUnprotected()
			.then(()=>{
				return UI.prompt(
					L('Import MML from Pikokakiko'),
					$('#template-pikokakikoselector'),
					L('Import'),
					L('Cancel'),
					(s) => !!(s.match(regex1) || s.match(regex2) || s.match(regex3))
				);
			})
			.catch(error=>{
				if (error=='cancel') console.log('Canceled'); else throw error;
			});
			p=p.then((s: string)=>{
				var id = '';
				var m;
				if (s==null||s.match(/^\s*$/)) return;
				if (m = s.match(regex1)) id = m[1];
				if (m = s.match(regex2)) id = m[4];
				if (m = s.match(regex3)) id = m[1];
				id = id.replace(/^\s+|\s+$/g, '');
				if (!id.match(/^\d+$/)) return;
				UI.block('Importing');
				return $.ajax({
					url: `nicovideo/mml/${id}`,
					dataType: 'json'
				});
			})
			.then(data=>{
				if (!data) return;
				UI.unblock();
				var comment = [
					`/*`,
					` * ${L('Title')}: ${data.title}`,
					` * ${L('MML Author')}: ${data.author}`,
					` *`,
					` * ${L('This MML is imported from Pikokakiko #%s', data.id)}`,
					` * http://dic.nicovideo.jp/mml_id/${data.id}`,
					` */`
				].join("\n") + "\n\n";
				Autosave.newAutosaveId();
				MMLEditor.load(comment + data.mml);
				MMLEditor.showSuccessToast(data.title, data.author);
			})
			.catch(error=>{
				UI.unblock();
				toastr.error(L('Failed to import MML'));
			});
	}

}

export var FileManager = new FileManagerStatic();



// // Google Picker test
// (function(){

// 	var pickerApiLoaded = false;
// 	var oauthToken = null;

// 	function pickerCallback(data) {
// 		var url = 'nothing';
// 		if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
// 			var doc = data[google.picker.Response.DOCUMENTS][0];
// 			url = doc[google.picker.Document.URL];
// 		}
// 		console.log(url, data);
// 	}

// 	function createPicker() {
// 		console.log('createPicker', pickerApiLoaded, oauthToken);
// 		if (pickerApiLoaded && oauthToken) {
// 			console.log('createPicker');
// 			var picker = new google.picker.PickerBuilder()
// 				// .addView(google.picker.ViewId.DOCUMENTS)
// 				// .addView(google.picker.ViewId.FOLDERS)
// 				.addView(new google.picker.DocsView())
// 				.setOAuthToken(oauthToken)
// 				// .setDeveloperKey(config.googleDrive.browserKey)
// 				.setCallback(pickerCallback)
// 				.build()
// 				.setVisible(true);
// 			console.log(picker);
// 		}
// 	}

// 	window.onGoogleApiLoad = function() {
// 		console.log('onGoogleApiLoad');

// 		gapi.load('auth', {'callback': function(){
// 			console.log('auth');
// 			gapi.auth.authorize(
// 				{
// 					client_id: config.googleDrive.clientId,
// 					scope: config.googleDrive.scope,
// 					immediate: true
// 				},
// 				function(authResult){
// 					console.log('authResult', authResult);
// 					if (authResult && !authResult.error) {
// 						oauthToken = authResult.access_token;
// 						createPicker();
// 					}
// 					else {
// 						console.log(authResult);
// 					}
// 				}
// 			);
// 		}});

// 		gapi.load('picker', {'callback': function(){
// 			console.log('picker');
// 			pickerApiLoaded = true;
// 			createPicker();
// 		}});

// 	}

// 	// onAuthApiLoad(function(){
// 	// 	$('<button type="button"><i class="fa fa-lg fa-fw fa-google"></i>Google Drive Picker</button>')
// 	// 		.appendTo('#region-pianoroll-file')
// 	// 		.on('click', function(){

// 	// 			var onPicked = function(data) {
// 	// 				if (data.action !== 'picked') return;
// 	// 				console.log(data);
// 	// 				// var k, v, picked, li;
// 	// 				// $('#picked').empty();
// 	// 				// for (k in data.docs) {
// 	// 				// 	picked = data[google.picker.Response.DOCUMENTS][k];
// 	// 				// 	li = $('<li></li>').appendTo('#picked');
// 	// 				// 	$('<img>', {src:picked.iconUrl}).appendTo(li);
// 	// 				// 	$('<a></a>', {href:picked.url}).text(picked.name).appendTo(li);
// 	// 				// }
// 	// 			}

// 	// 			var viewGroup = new google.picker.ViewGroup(google.picker.ViewId.DOCS)
// 	// 				.addView(google.picker.ViewId.DOCUMENTS)
// 	// 				.addView(google.picker.ViewId.SPREADSHEETS)
// 	// 				.addView(google.picker.ViewId.PRESENTATIONS)
// 	// 				.addView(google.picker.ViewId.FOLDERS)
// 	// 				.addView(google.picker.ViewId.FORMS)
// 	// 				.addView(google.picker.ViewId.PDFS);

// 	// 			new google.picker.PickerBuilder()
// 	// 				.addViewGroup(viewGroup)
// 	// 				.addView(google.picker.ViewId.MAPS)
// 	// 				.addView(google.picker.ViewId.IMAGE_SEARCH)
// 	// 				.addView(new google.picker.DocsUploadView())
// 	// 				.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
// 	// 				.setCallback(onPicked)
// 	// 				.build().setVisible(true);

// 	// 		});
// 	// });

// });//();
