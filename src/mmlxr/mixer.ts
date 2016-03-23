/// <reference path="../../typings/browser.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {App} from './app';
import * as Utils from './utils';

export class MixerStatic implements LazySingleton {

	ready: boolean;
	gain: GainNode;

	constructor() {
		$(()=>this.init());
	}

	private init() {
		$('#ctrl-volume').on('input', ()=>{
			this.updateVolumeControl();
			this.applyVolume();
		});
		Utils.registerSubscribers({
			'cmd.mixer.master.volume.up'  : () => this.addMasterVolume( 10),
			'cmd.mixer.master.volume.down': () => this.addMasterVolume(-10)
		});
		this.ready = true;
	}

	connect(): void {
		if (this.gain) return;
		this.gain = App.audioCtx.createGain();
		this.gain.gain.value = this.masterVolume / 127.0;
		this.gain.connect(App.audioCtx.destination);
	}

	disconnect(): void {
		if (!this.gain) return;
		this.gain.disconnect();
		this.gain = null;
	}

	get masterVolume(): number {
		return parseInt($('#ctrl-volume').val());
	}
	set masterVolume(vol: number) {
		this.updateVolumeControl(vol, true);
		this.applyVolume();
	}

	applyVolume(): void {
		if (this.gain) this.gain.gain.value = this.masterVolume / 127.0;
	}

	addMasterVolume(d: number): void {
		var vol = this.masterVolume;
		if (d<0) vol = (Math.ceil(vol/10)-1) * 10;
		if (0<d) vol = (Math.floor(vol/10)+1) * 10;
		this.masterVolume = vol;
	}

	private updateVolumeControl(vol: number=null, focus: boolean=false): void {
		var vol0 = this.masterVolume;
		if (vol===null) vol = vol0;
		vol = Math.max(0, Math.min(vol, 127));
		$('#transport-volume-icon')
			.removeClass('up')
			.removeClass('down')
			.removeClass('off')
			.addClass(vol<=0 ? 'off' : vol<=42 ? 'down' : vol<=84 ? 'up' : 'up');
		$('#transport-volume-display').text(vol.toString(10));
		if (vol != vol0) $('#ctrl-volume').val(vol.toString(10));
		if (focus) $('#ctrl-volume').focus();
	}

}

export var Mixer = new MixerStatic();
