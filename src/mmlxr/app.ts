/// <reference path="../../FlMMLonHTML5/dist/dts/messenger/ICompCompMessage.d.ts" />
/// <reference path="../../FlMMLonHTML5/dist/dts/messenger/ISyncInfoMessage.d.ts" />

import {Autosave} from './autosave';
import {PianoRoll, PianoRollStatic} from './piano_roll';
import {Menu} from './menu';
import {Mixer} from './mixer';
import {MMLEditor} from './mml_editor';
import {TrackTab} from './track_tab';
import {ProfileManager} from './profile_manager';
import {L} from './language';
import * as Consts from './consts';
import * as Utils from './utils';

import Cookies = require('js-cookie');
import {sprintf} from 'sprintf-js';

var BUFFER_SIZE = 16384;
var compileTimestamp = 0;

var emptyBuffer = new Float32Array(BUFFER_SIZE);

var divDebug;

function debug(str: string) {
	if (!divDebug) {
		divDebug = document.createElement("div");
		document.body.appendChild(divDebug);
	}
	var div = document.createElement("div");
	div.appendChild(document.createTextNode(str));
	divDebug.appendChild(div);

	var divs = divDebug.getElementsByTagName("div");
	if (divs.length > 10) divDebug.removeChild(divDebug.firstChild);
}

function extend(target: any, object: any): any {
	for (var name in object) {
		// console.log('[extend]', name, object[name]);
		target[name] = object[name];
	}
	return target;
}



export var PlayerWorker: Worker;

export class AppStatic {

	WORKER_URL: string = 'js/flmmlworker.js';
	
	EMPTY_TIMES_TO_WARNING: number = 30;

	bufferReady: boolean;
	buffer: Float32Array[];

	scrProc: ScriptProcessorNode;
	oscDmy: OscillatorNode;
	audioCtxTimeAtStart: number;

	mmlInfo: messenger.ICompCompMessage_Info;
	syncInfo: messenger.ISyncInfoMessage_Info;

	audioCtx: AudioContext;
	playedEmpty: number;
	timeDiff: number;
	pausedTimeMSec: number;
	adjustScroll: boolean;
	initialScroll: number;

	startups: { priority: number; callback: ()=>void; }[] = [];

	constructor() {
		this.startups.push({
			priority: 1,
			callback: ()=>Autosave.openLoader(true)
		});
	}

	boot() {
		if (!$.browser.msie) this.init();
	}

	private init() {
		this.audioCtx = new AudioContext();
		PlayerWorker = new Worker(this.WORKER_URL);
		PlayerWorker.addEventListener('message', this.onMessage.bind(this));

		this.mmlInfo = {
			totalMSec: 0,
			totalTimeStr: '00:00',
			warnings: [],
			metaTitle: '',
			metaComment: '',
			metaArtist: '',
			metaCoding: ''
		};
		this.syncInfo = {
			_isPlaying: false,
			_isPaused: false,
			nowMSec: 0,
			nowTimeStr: '00:00',
			voiceCount: 0
		};

		this.bufferReady = false;
		this.timeDiff = 0;
		this.playedEmpty = 0;
		this.adjustScroll = true;
		this.initialScroll = null;

		PlayerWorker.postMessage({
			type: Consts.message.COM_BOOT,
			sampleRate: this.audioCtx.sampleRate,
			bufferSize: BUFFER_SIZE,
			bufferMultiple: ProfileManager.bufferMultiple
		});
		this.setInfoInterval(1000 / 20);

		Utils.registerSubscribers({
			'cmd.transport.compile'    : () => Menu.isCompileButtonEnable && this.play(MMLEditor.mml, true),
			'cmd.transport.play'       : () => Menu.isPlayButtonEnable && this.play(MMLEditor.mml),
			'cmd.transport.pause'      : () => Menu.isPauseButtonEnable && this.pause(),
			'cmd.transport.playOrStop' : () => this.playOrStop(MMLEditor.mml),
			'cmd.transport.stop'       : () => Menu.isStopButtonEnable && this.stop(),
			'cmd.help.editor.keybind'  : () => MMLEditor.ace.execCommand('showKeyboardShortcuts')
		});
	}

	startup() {
		this.startups.sort((a, b) => Utils.sign(b.priority - a.priority));
		this.startups[0].callback();
	}

	resetTimediff(withLocator: boolean=false) {
		this.timeDiff = 0;
		this.syncInfo._isPaused = false;
		this.syncInfo._isPlaying = false;
		this.syncInfo.nowMSec = 0;
		this.syncInfo.nowTimeStr = '00:00';
		this.syncInfo.voiceCount = 0;
		if (withLocator) {
			Utils.watchVar(PianoRoll, 'ready')
				.then(() => {
					PianoRoll.syncLocator(0);
				});
		}
	}

	onMessage(e: any): void {
		var data = e.data,
			type = data.type;

		//console.log("Main received " + type);
		switch (type) {

			case Consts.message.COM_BUFFER:
				this.buffer = data.buffer;
				this.bufferReady = true;
				break;

			case Consts.message.COM_COMPSTART:
				PianoRollStatic.block('Compiling');
				Menu.updateMenuStateCompiling();
				break;
				
			case Consts.message.COM_COMPCOMP:
				{
					PianoRollStatic.unblock();
					Menu.updateMenuStateStopped();
					let msg = <messenger.ICompCompMessage>data;
					msg.mml = msg.mml.replace(/\r\n/g, "\n");
					var compileTimeMs = (new Date()).getTime() - compileTimestamp;
					console.log('compilation completed in ' + compileTimeMs + ' ms');
					console.log(msg.events);
					this.mmlInfo = msg.info;
					PianoRollStatic.load(msg.mml, msg.events, msg.info.totalMSec, TrackTab.listMutedTracks(), this.adjustScroll, this.initialScroll);
					PianoRoll.renderWarnings(msg.info.warnings, true);
					if (0 < msg.info.warnings.length) {
						toastr.warning(L('The MML contains errors.'));
					}
					this.adjustScroll = false;
					this.initialScroll = null;
					this.refreshTransportTime(0);
					this.resetTimediff();
				}
				break;

			case Consts.message.COM_BUFRING:
				if (data.progress === 100) {
					Mixer.applyVolume();
				}
				else {
					let s = sprintf('%-25s', `Buffering ${data.progress}%`);
					$('#transport-time').html(s.replace(/ /g, '&nbsp;'));
				}
				break;

			case Consts.message.COM_COMPLETE:
				break;

			case Consts.message.COM_SYNCINFO:
				{
					// // console.log(this.audioCtx.currentTime);
					let msg = <messenger.ISyncInfoMessage>data;
					extend(this.syncInfo, msg.info);
					// var diff = Math.round(this.syncInfo.nowMSec - this.getPlayingTimeMSec());
					// console.log('[COM_SYNCINFO]', diff);
					// if (PianoRoll) PianoRoll.syncLocator(this.getPlayingTimeMSec());
					// this.refreshTransportTime();
				}
				break;

			case Consts.message.COM_PLAYSOUND:
				console.log('[COM_PLAYSOUND]');
				Menu.updateMenuStatePlaying();
				this.playSound();
				break;

			case Consts.message.COM_STOPSOUND:
				// console.log('[#M:3-1] App received COM_STOPSOUND');
				this.audioCtxTimeAtStart = null;
				this.playedEmpty = 0;
				this.stopSound(data.isFlushBuf);
				// console.log('[#M:3-4] sending COM_STOPSOUND to WORKER THREAD');
				PlayerWorker.postMessage({ type: Consts.message.COM_STOPSOUND });
				break;

			case Consts.message.COM_DEBUG:
				debug(data.str);
				break;

			case Consts.message.COM_TRACE:
				PianoRoll.showTrace(data);
				break;

			case Consts.message.COM_LOG:
				// console.log.apply(console, data.args);
				break;
		}
	}

	playSound(): void {
		if (Mixer.gain || this.scrProc || this.oscDmy) return;

		Mixer.connect();

		// this.audioCtxTimeAtStart = null;
		this.scrProc = this.audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 2);
		if (!this.onAudioProcess_binded) this.onAudioProcess_binded = this.onAudioProcess.bind(this);
		this.scrProc.addEventListener('audioprocess', this.onAudioProcess_binded);
		this.scrProc.connect(Mixer.gain);

		// iOS Safari対策
		this.oscDmy = this.audioCtx.createOscillator();
		this.oscDmy.connect(this.scrProc);
		this.oscDmy.start(0);

		this.playedEmpty = 0;

		Menu.updateMenuStatePlaying();
	}

	stopSound(isFlushBuf?: boolean): void {
		// console.log('[#M:3-2] App#stopSound called');
		if (isFlushBuf) this.bufferReady = false;
		if (Mixer.gain || this.scrProc || this.oscDmy) {
			// console.log('[#M:3-3] App#stopSound disconnecting audio nodes');
			this.scrProc.removeEventListener('audioprocess', this.onAudioProcess_binded);
			Mixer.disconnect();
			if (this.scrProc) { this.scrProc.disconnect(); this.scrProc = null; }
			if (this.oscDmy) { this.oscDmy.disconnect(); this.oscDmy = null; }
		}
		Menu.updateMenuStateStopped();
	}
	
	get bufferLengthMsec(): number {
		return 1000 * BUFFER_SIZE / this.audioCtx.sampleRate;
	}

	getPlayingTimeMSec(): number {
		if (this.audioCtxTimeAtStart == null) {
			if (this.syncInfo._isPaused) return this.pausedTimeMSec;
			return this.pausedTimeMSec = null;
		}
		var t = (this.audioCtx.currentTime - this.audioCtxTimeAtStart) * 1000;
		t += this.timeDiff;
		t -= (this.playedEmpty + 1) * this.bufferLengthMsec;
		if (t < 0) t = 0;
		this.pausedTimeMSec = t;
		return t;
	}

	private onAudioProcess_binded;
	onAudioProcess(e: AudioProcessingEvent): void {
		var outBuf = e.outputBuffer;

		if (this.bufferReady) {
			if (this.audioCtxTimeAtStart == null) {
				this.audioCtxTimeAtStart = this.audioCtx.currentTime;
				this.playedEmpty = 0;
				requestAnimationFrame(this.onAnimationFrame.bind(this));
			}
			outBuf.getChannelData(0).set(this.buffer[0]);
			outBuf.getChannelData(1).set(this.buffer[1]);
			this.bufferReady = false;
			PlayerWorker.postMessage({ type: Consts.message.COM_BUFFER, retBuf: this.buffer }, [this.buffer[0].buffer, this.buffer[1].buffer]);
		} else {
			if (++this.playedEmpty == this.EMPTY_TIMES_TO_WARNING) {
				var warnings = [];
				if (PianoRoll.source.match(/#USING\s+POLY/i) && PianoRoll.source.match(/@14\-\d+/)) {
					warnings.push(L('#USING POLY for FM Synth is not recommended.'));
				}
				if (600000 <= this.mmlInfo.totalMSec) {
					warnings.push(L('Total play time might be too long.'));
				}
				if (warnings.length == 0) {
					warnings.push(L('Computing resource seems to be not enough.'));
				}
				toastr.warning(
					'<ul>' + warnings.map((v)=>`<li>${v}</li>`).join('') + '</ul>',
					L('Processing aborted forcibly')
				);
				$(()=>this.stop());
			}
			console.log('Buffer underrun %s times', this.playedEmpty);
			outBuf.getChannelData(0).set(emptyBuffer);
			outBuf.getChannelData(1).set(emptyBuffer);
			PlayerWorker.postMessage({ type: Consts.message.COM_BUFFER, retBuf: null });
		}
	}

	onAnimationFrame() {
		var ms = this.getPlayingTimeMSec();
		PianoRoll.syncLocator(ms, this.bufferLengthMsec * 2 <= ms);
		this.refreshTransportTime(ms);
		requestAnimationFrame(this.onAnimationFrame.bind(this));
	}

	refreshTransportTime(msec?: number): void {
		// var now = this.getNowTimeStr();
		// if (now == null) now = '00:00';
		if (msec == null) msec = this.getPlayingTimeMSec();
		var now = '--:--.---';
		if (msec != null) {
			msec = Math.floor(msec);
			var sec = Math.floor(msec / 1000);
			msec %= 1000;
			var min = Math.floor(sec / 60);
			sec %= 60;
			now = `${Utils.trimNumber(min, 2)}:${Utils.trimNumber(sec, 2)}.${Utils.trimNumber(msec, 3)}`;
		}
		var total = this.mmlInfo.totalTimeStr;
		var status = this.syncInfo._isPaused ? 'PAUSED' :
		             this.syncInfo._isPlaying ? 'PLAYING' : 'STOPPED';
		document.getElementById('transport-time').textContent = `${status} ${now} / ${total}`;
	}

	playOrStop(mml: string) {
		if (Menu.isStopButtonEnable) this.stop();
		else if (Menu.isPlayButtonEnable) this.play(mml);
	}

	play(mml: string, compileOnly: boolean=false, adjustScroll: boolean=false): void {
		compileTimestamp = (new Date()).getTime();
		if (adjustScroll)
			this.adjustScroll = true;
		else
			this.initialScroll = PianoRoll.container.scrollLeft;
		PlayerWorker.postMessage({
			type: Consts.message.COM_PLAY,
			mml: mml,
			mutedTracks: TrackTab.listMutedTracks(),
			compileOnly: compileOnly
		});
		if (compileOnly) {
			this.timeDiff = 0;
			Menu.updateMenuStateStopped();
		}
		else {
			this.timeDiff = this.syncInfo.nowMSec || 0;
			if (this.syncInfo._isPaused)
				Menu.updateMenuStateStopped();
			else
				Menu.updateMenuStatePlaying();
		}
	}

	stop(): void {
		this.audioCtxTimeAtStart = null;
		this.playedEmpty = 0;
		PlayerWorker.postMessage({ type: Consts.message.COM_STOP });
		Menu.updateMenuStateStopped();
		Utils.watchVar(PianoRoll, 'ready')
			.then(() => {
				PianoRoll.syncLocator(0);
			});
	}

	pause(): void {
		PlayerWorker.postMessage({ type: Consts.message.COM_PAUSE });
		Menu.updateMenuStateStopped();
	}

	setInfoInterval(interval: number): void {
		PlayerWorker.postMessage({ type: Consts.message.COM_SYNCINFO, interval: interval });
	}

	release(): void {
		this.stopSound();
		PlayerWorker.terminate();
	}

}

export var App: AppStatic;
window['App'] = App = new AppStatic();
