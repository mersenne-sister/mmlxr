/// <reference path="../vendor/semantic-ui.d.ts" />

import {PlayerWorker} from './app';
import {PianoRoll} from './piano_roll';
import * as Consts from './consts';

export class TrackTabStatic {

	constructor() {
	}

	show() {
		$('a.item[data-tab="region-pianoroll-track"]').tab('change tab', 'region-pianoroll-track');
	}

	/**
	 * @returns List of muted track numbers
	 */
	listMutedTracks(): number[] {
		var $region = $('#region-pianoroll-track');
		var muted = [];
		$region.find('.track-row button[data-action="mute"][data-track].active').each((i, e)=>{
			var track = parseInt($(e).attr('data-track'));
			muted.push(track);
		});
		return muted;
	}
	
	render(trackCount: number): number[] {
		var muted = this.listMutedTracks();
		var $region = $('#region-pianoroll-track');
		$region.empty();
		for (let i = 1; i < trackCount; i++) { // skip tempo track
			this.renderRow(
				i,
				0 <= muted.indexOf(i),
				muted.indexOf(i) < 0 && trackCount - 2 <= muted.length
			);
		}
		return muted;
	}

	private renderRow(iTrack: number, mute: boolean=false, solo: boolean=false): void {
		var $row = $(`
			<div class="track-row">
				<button class="ui tiny track-bgcolored disabled button" data-track="${iTrack}">
					${iTrack}
				</button>
				<button class="ui tiny toggle button" data-action="solo" data-track="${iTrack}">
					Solo
				</button>
				<button class="ui tiny toggle button" data-action="mute" data-track="${iTrack}">
					Mute
				</button>
			</div>
		`).appendTo('#region-pianoroll-track');
		
		$('button', $row).on('click', (evt)=>{
			var $e = $(evt.target).toggleClass('active');
			var action = $e.data('action');
			var iTrack = parseInt($e.data('track'));
			var isDown = $e.hasClass('active');
			if (action=='solo') this.soloTrack(iTrack, isDown);
			if (action=='mute') this.muteTrack(iTrack, isDown);
		});
		
		if (mute) $row.find('button[data-action="mute"]').addClass('active');
		if (solo) $row.find('button[data-action="solo"]').addClass('active');
	}
	
	soloTrack(iTrack:number, solo:boolean) {
		if (solo) {
			PianoRoll.showTrackOnly(iTrack);
			var panel = $('#region-pianoroll-track');
			$(`button[data-action="mute"][data-track=${iTrack}]`, panel).removeClass('active');
			$(`button[data-action="mute"]:not([data-track=${iTrack}])`, panel).addClass('active');
			$(`button[data-action="solo"]:not([data-track=${iTrack}])`, panel).removeClass('active');
		}
		else {
			PianoRoll.showTrackAll();
			$('button[data-action="mute"]', panel).removeClass('active');
			$('button[data-action="solo"]', panel).removeClass('active');
		}
		$('button[data-action="mute"]', panel).each((i, e)=>{
			var $e = $(e);
			var iTrack = $e.data('track');
			var isDown = $e.hasClass('active');
			PlayerWorker.postMessage({ type: Consts.message.COM_MUTE, track: iTrack, mute: isDown });
		});
	}
	
	muteTrack(iTrack:number, mute:boolean) {
		if (mute) PianoRoll.hideTrack(iTrack); else PianoRoll.showTrack(iTrack);
		var panel = $('#region-pianoroll-track');
		var inactiveButtons = $('button[data-action="mute"]:not(.active)', panel);
		$('button[data-action="solo"]', panel).removeClass('active');
		if (inactiveButtons.length == 1) {
			var t = inactiveButtons.data('track');
			$(`button[data-action="solo"][data-track="${t}"]`, panel).addClass('active');
		}
		PlayerWorker.postMessage({ type: Consts.message.COM_MUTE, track: iTrack, mute: mute });
	}

}

export var TrackTab = new TrackTabStatic();
