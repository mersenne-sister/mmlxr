/// <reference path="lazy_singleton.d.ts" />

import {App} from './app';
import {MMLEditor} from './mml_editor';
import {UI} from './ui';
import {L} from './language';
import * as Consts from './consts';
import * as Utils from './utils';

export interface IWavFileFormat {
	sampleRate: number;
	numberOfChannels: number;
	sampleLength: number;
	startSilence: number;
	endSilence: number;
	preview: {
		max: Float32Array;
		min: Float32Array;
	}[];
}

export interface IDPCMOptions {
	stereoMix?: boolean;
	stereoLeft?: boolean;
	normalizeCheck?: boolean;
	inputVolumeCb?: number;
	dpcmSampleRateCb?: number;
	dmcAlignCheck?: boolean;
	startPosition?: number;
	endPosition?: number;
	previewSize?: number;
	loop?: boolean;
	id?: number;
}

export interface IDPCMResult {
	preview: Float32Array;
	mml: string;
}

const DMC_TABLE = [
	0xD60, 0xBE0, 0xAA0, 0xA00, 0x8F0, 0x7F0, 0x710, 0x6B0,
	0x5F0, 0x500, 0x470, 0x400, 0x350, 0x2A0, 0x240, 0x1B0,
];

const DPCM_WORKER_URL: string = 'js/dpcm-worker.js';

export class WaveGeneratorStatic implements LazySingleton {

	ready: boolean;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		Utils.registerSubscribers({
			'cmd.generate.wav': () => this.generate('wav'),
			'cmd.generate.mp3': () => this.generate('mp3')
			// 'cmd.file.insert.wav9': () => this.importWav9FromFile(),
		});
		$('#ctrl-wav9-file').on('change', (evt) => {
			this.importWav9FromFile(evt.target['files']);
		});
		
		this.ready = true;
	}

	generate(format: string, rate: number = 44100): void {
		App.stop();
		UI.openProgressModal('Preparing...');

		var complete = (format: string, url: string)=>{
			UI.updateProgress(1.0, L('Complete'));
			setTimeout(()=>{
				UI.closeProgressModal();
				UI.download(url, MMLEditor.analyze().fsTitle + '.' + format);
			}, 200);
		};
		
		var worker = new Worker(App.WORKER_URL);
		var genProgressTotal = format=='mp3' ? .2 : .99;
		var encProgressTotal = 1.0 - genProgressTotal;
		worker.addEventListener('message', (e: any) => {
			var data = e.data;
			var type = data.type;
			switch (type) {

				case Consts.message.COM_STOPSOUND:
					worker.postMessage({ type: Consts.message.COM_STOPSOUND });
					break;

				case Consts.message.COM_BUFRING:
					UI.updateProgress(
						data.progress/100.0 * genProgressTotal,
						data.progress < 100 ? L('Generating Wave Data') : L('Encoding')
					);
					break;

				case Consts.message.COM_GENWAV:
					UI.updateProgress(null, L('Encoding'));
					if (data.format == 'raw') {
						var encoder = new Worker('js/encoder.js');
						encoder.postMessage({
							type: 'init',
							config: {
								mono: false,
								sampleRate: rate,
								bitRate: 224
							}
						});
						encoder.postMessage({
							type: 'encode',
							buf: data.data
						});
						encoder.postMessage({
							type: 'finish'
						});
						encoder.onmessage = (e)=>{
							switch (e.data.type) {
								case 'progress':
									let p = e.data.progress / e.data.total;
									UI.updateProgress(genProgressTotal + encProgressTotal * p);
									break;
								case 'data':
									let url = URL.createObjectURL(new Blob([e.data.buf]));
									complete(format, url);
									break;
								case 'end':
									encoder = null;
									break;
							}
						};
					}
					else {
						var url = URL.createObjectURL(new Blob([data.data]));
						complete(data.format, url);
					}
					worker.postMessage({ type: Consts.message.COM_TERMINATE });
					worker = null;
					break;
			}
		});

		worker.postMessage({
			type: Consts.message.COM_BOOT,
			sampleRate: rate,
			bufferSize: Math.ceil(rate * App.mmlInfo.totalMSec / 1000.0),
			offlineFormat: format||'raw',
			mml: MMLEditor.mml
		});
	}

	wavFormat(wav: ArrayBuffer, previewSize: number=512): Promise<IWavFileFormat> {
		return new Promise((resolve, reject)=>{
			var worker = new Worker(DPCM_WORKER_URL);
			
			worker.addEventListener('message', (msg)=>{
				switch (msg.data.type) {
					
					case 'format':
						console.log(msg.data.result);
						resolve(msg.data.result);
						worker.terminate();
						worker = null;
						break;
					
					case 'error':
					default:
						reject((msg.data||{}).error);
						worker.terminate();
						worker = null;
						break;
					
				}
			});
			
			worker.postMessage({
				type: 'format',
				buffer: wav,
				previewSize: previewSize
			});
			console.log('Inspecting wav file');
		});
	}

	wav2dpcm(wav: ArrayBuffer, opts?: IDPCMOptions): Promise<IDPCMResult> {
		return new Promise((resolve, reject)=>{
			var worker = new Worker(DPCM_WORKER_URL);
			
			worker.addEventListener('message', (msg)=>{
				switch (msg.data.type) {
					
					case 'convert':
						resolve(msg.data.result);
						worker.terminate();
						worker = null;
						break;
					
					default:
					case 'error':
						reject((msg.data||{}).error);
						worker.terminate();
						worker = null;
						break;
					
				}
			});
			
			worker.postMessage({
				type: 'convert',
				buffer: wav,
				options: opts
			});
		});
	}
	
	private form2Wav9EncodingOpts(values: any): IDPCMOptions {
		return {
			stereoMix: values.channelToUse=='both',
			stereoLeft: values.channelToUse=='left',
			normalizeCheck: true,
			inputVolumeCb: 1.0,
			dpcmSampleRateCb: parseInt(values.dpcmSampleRateCb),
			dmcAlignCheck: false,
			startPosition: parseInt(values.startPosition),
			endPosition: parseInt(values.endPosition),
			loop: !!values.loop
		};
	}

	private renderWaveform(canvas: HTMLCanvasElement, format: IWavFileFormat) {
		var w = canvas.width = format.preview[0].max.length;
		var h = canvas.height = $(canvas).height();
		var amp = h / (2 * format.numberOfChannels);
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = '#222';
		ctx.fillRect(0, 0, w, h);
		for (var ch=0; ch<format.numberOfChannels; ch++) {
			var yOffset = h * ch / format.numberOfChannels;
			ctx.fillStyle = '#111';
			ctx.fillRect(0, yOffset, w, amp);
			ctx.fillStyle = '#999';
			for (var x=0; x<w; x++) {
				var vp = format.preview[ch].max[x];
				var vn = format.preview[ch].min[x];
				var yp = (1.0-vp) * amp + yOffset;
				var yn = (1.0-vn) * amp + yOffset;
				ctx.fillRect(x, yp, 1, yn-yp);
			}
		}
	}

	private setupWav9ConvertModal($modal: JQuery, id: number, format: IWavFileFormat, wavData: ArrayBuffer) {
		$modal.find('.originalSampleRate')
			.text(Utils.numberFormat(format.sampleRate));
		$modal.find('.originalSampleLength')
			.text(Utils.numberFormat(format.sampleLength));
		
		var updateClipArea, $startPos, $endPos;
		
		$startPos = $modal.find('[name="startPosition"]')
			.val(format.startSilence)
			.forceIntegerInput(0, ()=>parseInt($endPos.val())-1)
			.on('change', ()=>updateClipArea());
		
		$endPos = $modal.find('[name="endPosition"]')
			.val(format.sampleLength - format.endSilence)
			.forceIntegerInput(()=>parseInt($startPos.val())+1, format.sampleLength)
			.on('change', ()=>updateClipArea());
		
		updateClipArea = ()=>{
			var l = parseInt($startPos.val()) * 100.0 / format.sampleLength;
			var r = parseInt($endPos.val()) * 100.0 / format.sampleLength;
			var $e = $modal.find('.clipArea');
			$e.css({
				left: `${l}%`,
				width: `${r-l}%`
			});
		};
		$(updateClipArea);
		
		var movingStart = false;
		var panOnClipArea = (evt)=>{
			var $p = $(evt.target).parent();
			var w = $p.width();
			var x = evt.gesture.center.x - $p.offset().left;
			var i = Math.round(format.sampleLength * x / w);
			if (movingStart) {
				i = Math.max(0, Math.min(i, parseInt($endPos.val())-1));
				$startPos.val(i);
			}
			else {
				i = Math.max(parseInt($startPos.val())+1, Math.min(i, format.sampleLength));
				$endPos.val(i);
			}
			updateClipArea();
		};
		var panStartOnClipArea = (evt) => {
			var $p = $(evt.target).parent();
			var w = $p.width();
			var x = evt.gesture.center.x - $p.offset().left;
			var i = Math.round(format.sampleLength * x / w);
			var i0 = parseInt($startPos.val());
			var i1 = parseInt($endPos.val());
			movingStart = i < (i0 + i1) / 2;
			panOnClipArea(evt);
		};

		if (2 <= format.numberOfChannels) {
			$modal.find('.channelToUse').removeClass('disabled');
			$modal.find('.originalChannels').text('Stereo');
		}
		else {
			$modal.find('.channelToUse').addClass('disabled');
			$modal.find('.originalChannels').text('Mono');
		}
		
		var rates = [];
		$modal.find('[name="dpcmSampleRateCb"] ~ .menu .item').each((i, e)=>{
			var id = parseInt($(e).attr('data-value'));
			if (0 <= id) {
				var rate = (1789772.5 * 8) / DMC_TABLE[id];
				rates.push({
					id: id,
					rate: rate,
					distance: Math.abs(Math.log(format.sampleRate) - Math.log(rate))
				});
			}
		});
		rates.sort((a, b)=>a.distance-b.distance);
		console.log(rates);
		$modal.find('[name="dpcmSampleRateCb"]').parent('.dropdown')
			.dropdown('set selected', rates[0].id);
		
		var $previewMML = $modal.find('[name="previewMML"]');
		$previewMML.val(`@9-${id} ` + $previewMML.val());
		
		var canvas = <HTMLCanvasElement>$modal.find('canvas')[0];
		this.renderWaveform(canvas, format);
		var hammer = <HammerManager>$modal.find('.clipArea, canvas').hammer()
			.on('panstart', panStartOnClipArea)
			.on('pan', panOnClipArea)
			.data('hammer');
		hammer.get('pan').set({ threshold: 1, direction: Hammer.DIRECTION_HORIZONTAL });
		
		var blob = new Blob([wavData], {type: "audio/wav"});
		var audioSrc = <HTMLAudioElement>$modal.find('audio.preview-source')[0];
		audioSrc.src = URL.createObjectURL(blob);
		audioSrc.preload = 'auto';
		$modal.find('.preview-source.button').hammer().on('tap', ()=>audioSrc.play());
		
		var audioDpcm = <HTMLAudioElement>$modal.find('audio.preview-dpcm')[0];
		var $buttonDpcm = $modal.find('.preview-dpcm.button');
		$buttonDpcm.hammer().on('tap', ()=>{
			var values = $modal.find('.ui.form').form('get values');
			var opts = this.form2Wav9EncodingOpts(values);
			$buttonDpcm.addClass('disabled');
			WaveGenerator.wav2dpcm(wavData, opts)
				.then(result=>{
					if (!result) return Promise.resolve(null);
					var mml = $previewMML.val() + "\n";
					mml += result.mml.replace(/\$id/, `${id}`);
					App.play(mml);
					$buttonDpcm.removeClass('disabled');
				})
				.catch(error=>{
					toastr.error(L(error), L('Convert failed'));
				});
		});
	}

	importWav9FromFile(files: FileList) {
		if (!files || files.length == 0) return;
		App.stop();
		App.resetTimediff(true);
		var file = files[0];
		var filename = file.name;
		var title = filename.replace(/\.(wav|dmc)$/i, '');
		var ext = filename.replace(/^.*\./, '').toLowerCase();
		var reader = new FileReader();
		reader.onload = (evt) => {
			var wavData = evt.target['result'];
			Utils.resetFileInput('ctrl-wav9-file');
			
			// Search unused ID
			var id = -1;
			for (var wav9 of MMLEditor.searchWAV9()) {
				id = Math.max(id, wav9.id);
			}
			id++;
			
			if (ext == 'dmc') {
				UI.unblock();
				if (0x0ff1 < wavData.length) {
					toastr.warning(L('File too large'));
				}
				else {
					MMLEditor.appendLine(`/* ${filename} */`);
					MMLEditor.appendAndSelect(`#WAV9 ${id},0,0/*or 1(loop)*/,${btoa(wavData)}`, 6, 17);
					toastr.success(L('The inserted wave data can be used as %s.', `<code>@9-${id}</code>`), L('Import succeeded'));
				}
			}
			if (ext == 'wav') {
				var p: any; // workaround to avoid type mismatch
				p = WaveGenerator.wavFormat(wavData, 2048)
					.then(format => {
						UI.unblock();
						var this_ = this;
						return UI.formModal(
							L('DPCM Encoding Options'),
							$('#template-dpcmoptionselector'),
							L('Import'),
							L('Cancel'),
							{
								onShow: function() {
									this_.setupWav9ConvertModal($(this), id, format, wavData);
									this_ = null;
								},
								onHide: ()=>{
									App.play(MMLEditor.mml, true);
								}
							}
						);
					})
					.then(values=> {
						if (!values) return Promise.resolve(null);
						var opts = this.form2Wav9EncodingOpts(values);
						opts.id = id;
						console.log(opts);
						return WaveGenerator.wav2dpcm(wavData, opts);
					})
					.then(result=>{
						if (!result) return Promise.resolve(null);
						MMLEditor.appendLine(`/* ${filename} */`);
						MMLEditor.appendLine(result.mml);
						toastr.success(L('The inserted wave data can be used as %s.', `<code>@9-${id}</code>`), L('Import succeeded'));
					})
					.catch(error=>{
						toastr.error(L(error), L('Convert failed'));
					});
			}
		};
		
		reader.onerror = reader.onabort = ()=>{
			UI.unblock();
			toastr.error(L('Failed to load the file'));
		};
		
		switch (ext) {
			case 'wav':
				UI.block('Loading');
				reader.readAsArrayBuffer(file);
				break;
			case 'dmc':
				UI.block('Loading');
				reader.readAsBinaryString(file);
				break;
			default:
				toastr.warning(L('Please select a file with .wav or .dmc extension.'), L('Unsupported format'));
		}
	}

}

export var WaveGenerator = new WaveGeneratorStatic();
