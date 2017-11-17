/// <reference path="../../FlMMLonHTML5/dist/dts/messenger/Messenger.d.ts" />
/// <reference path="../vendor/binary-search-tree.d.ts" />
/// <reference path="../vendor/fraction.d.ts" />

import {PlayerWorker} from './app';
import {TempoCalc} from './tempo_calc';
import {Mixer} from './mixer';
import {MMLEditor} from './mml_editor';
import {NoteTab} from './note_tab';
import {ErrorTab} from './error_tab';
import {TrackTab} from './track_tab';
import {App} from './app';
import {L} from './language';
import * as Consts from './consts';
import * as Utils from './utils';

import {AVLTree} from 'binary-search-tree';
import Fraction = require('fraction.js');
import * as _ from 'lodash';

interface ITrackState {
	visible: boolean;
	volume: number;
	expression: number;
	form: number;
	formParam: number;
}

interface IMMLEvent {
	id:     number;
	tick:   number;
	duration: number;
	status: number;
	data0:  number;
	data1:  number;
	slurFrom: number;
	volume: number;
	expression: number;
	form: number;
	formParam: number;
}

interface INodeInfo {
	domCreator: (node:INodeInfo)=>void;
	parent: HTMLElement;
	track: number;
	e0 : IMMLEvent;
	e1?: IMMLEvent;
	x0 : number;
	x1?: number;
	dom?: HTMLElement;
}

const HISTORY_MAX: number = 5;

export class PianoRollStatic {

	NOTE_MOUSEOVER_MOD_KEY: string = 'shiftKey';
	DURBASE: number = 384;
	VIEWPORT_MARGIN: number = 0.1;//-0.2;

	container: HTMLDivElement;
	info: HTMLDivElement;
	grid: HTMLDivElement;
	hruler: HTMLDivElement;
	vruler: HTMLDivElement;
	locator: HTMLDivElement;
	gridTextureURL: string;
	
	rightMost: number;
	topMost: number;
	bottomMost: number;
	opts = {
		barWidth: 384,
		noteOffsetY: -1,
		notePitch: 6,
		noteHeight: 7,
		locatorPosition: 0.2,
		opacityByVelocity: 0.85,
		renderWaitMsec: 20,
		renderAtOnceMsec: 10
	};
	source: string;
	tracks: any[][];
	totalTimeMs: number;
	eventById: { [id:string]: IMMLEvent };
	trackState: ITrackState[];
	noteState: any[];
	lastNote: number[];
	startTimestampMs: number;
	tempoCalc: TempoCalc;
	renderingEventId: { [id:string]: number };
	renderingTrackIdLast: number;
	adjustScroll: boolean;
	initialScroll: number;

	positionMapL: AVLTree<number, INodeInfo>;
	positionMapR: AVLTree<number, INodeInfo>;
	lastClipL: number;
	lastClipR: number;

	static _history: string[] = [];

	static load(mml: string, tracks:any[][], totalTimeMs: number, mutedTracks?: number[], adjustScroll: boolean=false, initialScroll?: number): PianoRollStatic {
		if (!PianoRoll) {
			PianoRoll = window['PianoRoll'] = new PianoRollStatic(mml, tracks, totalTimeMs, mutedTracks, adjustScroll, initialScroll);
		}
		else {
			if (PianoRoll.source.match(/\S/)) {
				while (0 < PianoRollStatic._history.length) {
					var h = PianoRollStatic._history[0];
					if (h != PianoRoll.source) break;
					PianoRollStatic._history.shift();
				}
				PianoRollStatic._history.unshift(PianoRoll.source);
				while (HISTORY_MAX < PianoRollStatic._history.length) {
					PianoRollStatic._history.pop();
				}
			}
			PianoRoll.init(mml, tracks, totalTimeMs, mutedTracks, adjustScroll, initialScroll);
		}
		return PianoRoll;
	}

	static block(msg: string) {
		$('#region-pianoroll-main')
			.dimmer('show')
			.find('.ui.dimmer')
				.empty()
				.append($('<div class="ui large text loader"></ui>').text(msg));
	}

	static unblock() {
		$('#region-pianoroll-main').dimmer('hide');
	}

	get history(): string[] {
		return PianoRollStatic._history;
	}

	set history(h: string[]) {
		PianoRollStatic._history = h;
	}

	constructor(mml: string, tracks:any[][], totalTimeMs: number, mutedTracks?: number[], adjustScroll: boolean=false, initialScroll?: number) {
		this.init(mml, tracks, totalTimeMs, mutedTracks, adjustScroll, initialScroll);
	}

	init(mml: string, tracks:any[][], totalTimeMs: number, mutedTracks?: number[], adjustScroll: boolean=false, initialScroll?: number) {
		console.log('Creating PianoRoll %s tracks', tracks.length);
		
		this.source = mml;
		this.tracks = tracks;
		this.totalTimeMs = totalTimeMs;
		this.adjustScroll = adjustScroll;
		this.initialScroll = initialScroll;
		console.log('totalTimeMs = ' + this.totalTimeMs.toString(10));
		this.startTimestampMs = (new Date()).getTime();
		this.tempoCalc = new TempoCalc();
		this.eventById = {};

		this.hruler = <HTMLDivElement>$('.pianoroll-hruler')[0];
		this.vruler = <HTMLDivElement>$('.pianoroll-vruler')[0];

		// PianoRollStatic.block('Rendering');

		this.container = <HTMLDivElement>document.querySelector('#region-pianoroll-main > .pianoroll');
		if (this.container) {
			$(this.container).off('scroll');
		}
		else {
			this.container = document.createElement('div');
			this.container.className = 'pianoroll';
			$('#region-pianoroll-main').append(this.container);
		}

		this.grid = <HTMLDivElement>document.querySelector('#region-pianoroll-main > .pianoroll > .pianoroll-grid');
		if (!this.grid) {
			this.grid = document.createElement('div');
			this.grid.className = 'pianoroll-grid';
			this.grid.style.width = '1px';
			this.grid.style.minWidth = '100%';
			this.grid.style.height = (this.opts.notePitch * 128).toString(10) + 'px';
			this.grid.style.backgroundImage = `url(${this.createGridTexture()})`;
			this.grid.style.backgroundRepeat = 'repeat';
			this.grid.style.backgroundPosition = 'left bottom';
			this.container.appendChild(this.grid);
			this.scrollTo(null, (this.grid.offsetHeight - this.container.offsetHeight) / 2);
		}

		this.locator = <HTMLDivElement>document.querySelector('#region-pianoroll-main > .pianoroll-locator');
		if (!this.locator) {
			this.locator = document.createElement('div');
			this.locator.className = 'pianoroll-locator';
			this.locator.style.top = '0';
			$('#region-pianoroll-main').append(this.locator);
			$('#region-pianoroll').on('splitter:resize', ()=>this.updateLocatorHeight());
			$(window).on('resize', ()=>setTimeout(()=>this.updateLocatorHeight(),200));
		}
		this.updateLocatorHeight();

		this.rightMost = 0;
		this.trackState = [];
		this.noteState = [];
		this.lastNote = [];
		this.unfixedWaveformNode = [];

		TrackTab.render(this.tracks.length);

		this.positionMapL = new AVLTree<number, INodeInfo>({
			// compareKeys: function(a, b) {
			// 	return a.tick - b.tick;
			// }
		});
		this.positionMapR = new AVLTree<number, INodeInfo>({
			// compareKeys: function(a, b) {
			// 	return a.tick - b.tick;
			// }
		});

		this.lastClipL = Infinity;
		this.lastClipR = Infinity;
		$(this.container).on('scroll', () => {
			this.adjustRuler();
			this.updateNodeVisibility();
		});

		this.renderingEventId = {};
		this.renderingTrackIdLast = 0;
		for (var i = 0; i < this.tracks.length; i++) {
			this.noteState[i] = {};
			this.lastNote[i] = null;
			this.trackState[i] = {
				visible: (mutedTracks||[]).indexOf(i) < 0,
				volume: 100,
				expression: 127,
				form: 0,
				formParam: 0
			};
			this.renderingEventId[i.toString(10)] = 0;
			this.unfixedWaveformNode[i] = [];
		}
		
		this.removeAllEventElements();
		setTimeout(()=>this.renderEvent(), 1);
	}

	removeAllEventElements() {
		$('.pianoroll-note, .pianoroll-event-waveform', this.container).remove();
		$('.pianoroll-event-tempo', this.hruler).remove();
	}

	createGridTexture(): string {
		if (this.gridTextureURL) return this.gridTextureURL;
		var canvas = document.createElement('canvas');
		var w = canvas.width = this.opts.barWidth;
		var h = canvas.height = this.opts.notePitch * 12;
		var ctx = canvas.getContext('2d');
		ctx.fillStyle = '#272822';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#171812';
		ctx.fillRect(w*.25, 0, 1, h);
		ctx.fillRect(w*.50, 0, 1, h);
		ctx.fillRect(w*.75, 0, 1, h);
		ctx.fillStyle = '#0F100A';
		ctx.fillRect(0, 0, 1, h);
		ctx.fillRect(w-1, 0, 1, h);
		ctx.fillRect(0, h-1, w, 1);
		return this.gridTextureURL = canvas.toDataURL();
	}

	adjustRuler() {
		this.vruler.scrollTop = this.container.scrollTop;
		this.hruler.scrollLeft = this.container.scrollLeft;
	}

	showTrackAll() {
		for (var i = 0; i < this.tracks.length; i++) {
			this.trackState[i].visible = true;
		}
		this.updateNodeVisibility(true);
	}

	showTrackOnly(iTrack: number) {
		for (var i = 0; i < this.tracks.length; i++) {
			this.trackState[i].visible = i == iTrack;
		}
		this.updateNodeVisibility(true);
	}

	showTrack(iTrack: number) {
		this.trackState[iTrack].visible = true;
		this.updateNodeVisibility(true);
	}

	hideTrack(iTrack: number) {
		this.trackState[iTrack].visible = false;
		this.updateNodeVisibility(true);
	}

	scrollTo(x:number, y:number=null) {
		if (x != null) {
			x = Math.max(0, x);
			this.container.scrollLeft = x;
			this.hruler.scrollLeft = x;
			// this.updateNodeVisibility();
		}
		if (y != null) {
			y = Math.max(0, y);
			this.container.scrollTop = y;
			this.vruler.scrollTop = y;
		}
	}

	updateLocatorHeight() {
		$(this.locator).height(this.container.clientHeight);
	}

	updateRightMost() {
		this.rightMost = Math.max(this.rightMost, this.opts.barWidth * this.tempoCalc.msecToBar(this.totalTimeMs))
		this.grid.style.width = this.rightMost.toString(10) + 'px';
	}

	/**
	 *   before: l0-----------------l1
	 *   after :  |       x0--------+--------x1
	 *            |  hide<-|        |->show  |
	 *               [NOTE]                 [NOTE]
	 *                    ^A               B^
	 *
	 *   before:          l0-----------------l1
	 *   after : x0--------+--------x1       |
	 *            |  show<-|        |->hide  |
	 *        [NOTE]                 [NOTE]
	 *             ^C               D^
	 */
	updateNodeVisibility(force: boolean=false) {
		var cw = this.container.clientWidth;
		var l0 = this.lastClipL;
		var l1 = this.lastClipR;
		var x0 = this.container.scrollLeft;
		var x1 = x0 + cw;
		x0 -= this.VIEWPORT_MARGIN * cw;
		x1 += this.VIEWPORT_MARGIN * cw;

		var show: INodeInfo[];
		var hide: INodeInfo[];
		if (force || l1 <= x0 || x1 <= l0) { // no intersection
			this.removeAllEventElements();
			hide = [];
			show = _.difference(
				this.positionMapL.betweenBounds({ $lt : x1 }),
				this.positionMapR.betweenBounds({ $lte: x0 })
			);
		}
		else {
			if (l0 < x0) { // hide A
				hide = this.positionMapR.betweenBounds({ $gt: l0, $lte: x0 });
			}
			else {
				hide = [];
			}
			if (x1 < l1) { // hide D
				hide = hide.concat(
				       this.positionMapL.betweenBounds({ $gte: x1, $lt: l1 }));
			}
			if (l1 < x1) { // show B
				show = this.positionMapL.betweenBounds({ $gte: l1, $lt: x1 });
			}
			else {
				show = [];
			}
			if (x0 < l0) { // show C
				show = show.concat(
				       this.positionMapR.betweenBounds({ $gt: x0, $lte: l0 }));
			}
			
			for (var n of hide) {
				if (n.dom && n.dom.parentNode) n.dom.parentNode.removeChild(n.dom);
			}
		}
		
		for (var n of show) {
			if (!this.trackState[n.track].visible) continue;
			if (!n.dom) n.domCreator.call(this, n);
			if (!n.dom.parentNode) n.parent.appendChild(n.dom);
		}

		this.lastClipL = x0;
		this.lastClipR = x1;
	}

	addTempoNode(iTrack: number, e): void {
		if (iTrack != 1) return;
		var x = this.opts.barWidth * e.tick / this.DURBASE;
		var node: INodeInfo = {
			domCreator: this.realizeTempoNode,
			parent: this.hruler,
			track: iTrack,
			e0: e,
			x0: x
		};
		this.rightMost = Math.max(this.rightMost, x);
		this.positionMapL.insert(x, node);
		this.positionMapR.insert(x, node);
	}

	realizeTempoNode(node: INodeInfo): void {
		var e = node.e0;
		var id = e.id;
		var tempo = e.data0;
		var elm = document.createElement('div');
		this.hruler.appendChild(elm);
		elm.id = 'mml-id-' + id.toString(10);
		elm.classList.add('pianoroll-event-tempo');
		elm.classList.add('track-' + node.track.toString(10));
		elm.style.left = node.x0.toString(10) + 'px';
		elm.textContent = (tempo / 100.0).toString(10);
		node.dom = elm;
	}

	unfixedWaveformNode: INodeInfo[][] = [];
	
	addWaveformNode(iTrack: number, e): void {
		var x = this.opts.barWidth * e.tick / this.DURBASE;
		var node: INodeInfo = {
			domCreator: this.realizeWaveformNode,
			parent: this.container,
			track: iTrack,
			e0: e,
			x0: x
		};
		this.rightMost = Math.max(this.rightMost, x);
		this.positionMapL.insert(x, node);
		this.positionMapR.insert(x, node);
		this.unfixedWaveformNode[iTrack].push(node);
	}

	updateWaveformNodePos(node: INodeInfo): void {
		if (!(node.dom && node.e1)) return;
		node.dom.style.top = this.notePosY(node.e1.data0).toString(10) + 'px';
	}

	realizeWaveformNode(node: INodeInfo): void {
		var e = node.e0;
		var id = e.id;
		var elm = document.createElement('div');
		this.container.appendChild(elm);
		elm.id = 'mml-id-' + id.toString(10);
		elm.classList.add('pianoroll-event-waveform');
		elm.classList.add('track-colored');
		elm.classList.add('track-' + node.track.toString(10));
		elm.style.left = node.x0.toString(10) + 'px';
		elm.textContent = this.waveformName(e);
		node.dom = elm;
		this.updateWaveformNodePos(node);
	}

	addNoteNode(iTrack: number, e0, e1): void {
		var x0 = this.opts.barWidth * e0.tick / this.DURBASE;
		var x1 = this.opts.barWidth * e1.tick / this.DURBASE;
		var node: INodeInfo = {
			domCreator: this.realizeNoteNode,
			parent: this.container,
			track: iTrack,
			e0: e0,
			e1: e1,
			x0: x0,
			x1: x1
		};
		this.rightMost = Math.max(this.rightMost, x1);
		this.positionMapL.insert(x0, node);
		this.positionMapR.insert(x1, node);
		var waveform;
		while (waveform = this.unfixedWaveformNode[iTrack].shift()) {
			waveform.e1 = e0;
			this.updateWaveformNodePos(waveform);
		}
	}

	notePosY(n: number): number {
		return this.opts.notePitch * (127 - n) + this.opts.noteOffsetY;
	}

	realizeNoteNode(node: INodeInfo): void {
		var e0 = node.e0;
		var e1 = node.e1;
		e0.duration = e1.tick - e0.tick;
		var id = e0.id;
		var velocity = e0.data1;
		var h = this.opts.noteHeight;
		var y = this.notePosY(e0.data0);
		this.topMost    = this.topMost   ==null ? y   : Math.min(this.topMost   , y  );
		this.bottomMost = this.bottomMost==null ? y+h : Math.max(this.bottomMost, y+h);
		var elm = document.createElement('div');
		elm.id = 'mml-id-' + id.toString(10);
		var vol = (velocity / 127.0) * (e0.expression / 127.0) * (e0.volume / 127.0);
		elm.classList.add('pianoroll-note');
		elm.classList.add('track-' + node.track.toString(10));
		var hSlur = 0;
		if (e0.slurFrom != null) {
			hSlur = y - this.notePosY(e0.slurFrom);
			if (0 < hSlur) {
				elm.style.borderTopWidth = hSlur.toString(10) + 'px';
				y -= hSlur;
				h += hSlur;
			}
			else if (hSlur < 0) {
				elm.style.borderBottomWidth = hSlur.toString(10) + 'px';
				h += hSlur;
			}
			else {
				elm.classList.add('pianoroll-note-tied');
			}
		}
		elm.style.left = node.x0.toString(10) + 'px';
		elm.style.width = (node.x1 - node.x0).toString(10) + 'px';
		elm.style.top = y.toString(10) + 'px';
		elm.style.height = h.toString(10) + 'px';
		elm.style.opacity = (vol + (1.0 - this.opts.opacityByVelocity) * (1.0 - vol) ).toString(10);
		elm.addEventListener('click', (evt:MouseEvent)=>{
			console.log(evt);
			this.showEventProperty(<HTMLElement>evt.target, true);
			if (evt[this.NOTE_MOUSEOVER_MOD_KEY]) this.traceJumpHandler(evt);
		});
		elm.addEventListener('mouseover', (evt:MouseEvent)=>{
			if (evt[this.NOTE_MOUSEOVER_MOD_KEY]) {
				this.showEventProperty(<HTMLElement>evt.target, true);
			}
		});
		node.dom = elm;
	}

	static _waveFormTitle = {
		'0-0' : 'Sine Wave',
		'0-1' : 'Sine Wave (Half Rectified)',
		'0-2' : 'Sine Wave (Full Rectified)',
		'1-0' : 'Sawtoooth Wave (Starts at Max)',
		'1-1' : 'Sawtoooth Wave (Starts at Zero)',
		'2-0' : 'Triangle Wave (Starts at Max)',
		'2-1' : 'Triangle Wave (Starts at Zero)',
		'3'   : 'Pulse Wave',
		'4'   : 'White Noise',
		'5'   : 'NES Pulse',
		'6-0' : 'NES Triangle (Starts at Max)',
		'6-1' : 'NES Triangle (Starts at Zero)',
		'7'   : 'NES Noise',
		'8'   : 'NES Short Noise',
		'9-*' : 'NES DPCM',
		'10-*': 'GB Wave Table',
		'11'  : 'GB Noise',
		'12'  : 'GB Short Noise',
		'13-*': 'Wave Table',
		'14-*': 'FM Synth'
	};

	waveformName(event: IMMLEvent, withTitle: boolean=false) {
		var titles = PianoRollStatic._waveFormTitle;
		var id = event.form.toString(10);
		var p = event.formParam.toString(10);
		var title = titles[id]; // X
		if (!title) {
			title = titles[id+'-*']; // X-*
			id += '-' + p;
			if (withTitle) {
				if (title) {
					title += ' #' + p;
				}
				else {
					title = titles[id]; // X-Y
					if (!title) title = 'Unknown';
				}
			}
		}
		return withTitle ? `@${id} ${title}` : `@${id}`;
	}

	noteLabel(n: number): string {
		return Consts.note[n % 12] + Math.floor(n / 12).toString(10);
	}

	showEventProperty(e: HTMLElement, focus: boolean=false) {
		var $e = $(e);
		var track = null;
		for (var c of Array.prototype.slice.call(e.classList)) {
			let m = c.match(/^track-(\d+)$/);
			if (m) track = m[1];
		}
		var id = parseInt(e.id.split('-').pop());
		var event: IMMLEvent = this.eventById[id.toString()];
		var note = event.data0;
		var velocity = event.data1;
		$('#region-pianoroll-note')
			.empty()
			.append(Utils.createTable('Note Property', [
				['Track', track],
				['Note', this.noteLabel(note)],
				['Position', this.formatPosition(event.tick)],
				['Duration', this.formatPosition(event.duration)],
				['Velocity', velocity.toString(10)],
				['Expression', event.expression.toString(10)],
				['Volume', event.volume.toString(10)],
				['Waveform', this.waveformName(event, true)]
			]))
			.find('table:first-child > thead > tr > th')
				.addClass('track-bgcolored')
				.addClass(`track-${track}`);
		$('.focused', this.container).removeClass('focused');
		$e.addClass('focused');
		PlayerWorker.postMessage({ type: Consts.message.COM_TRACE, eventId: id });
		if (focus) NoteTab.show();
	}

	showTrace(data:any) {
		$('#region-pianoroll-note')
			.append(this.formatTraceHTML('Trace', data.trace, data.eventId));
	}

	formatPosition(tick: number): string {
		var f = new Fraction(tick, this.DURBASE);
		var b = f.toFraction(true).replace(/ +/, ' + ');
		return `${b} bar\n(${tick} tick)`;

		// var n = this.DURBASE;
		// var bar = Math.floor(tick / n);
		// tick -= bar * this.DURBASE;
		// var s = [];
		// if (bar || !tick) s.push(`${bar}`);
		// if (tick) s.push(`${tick}/${n}`);
		// return s.join(' + ') + ' bar';
	}

	renderWarnings(warnings: any[], focus: boolean=false) {
		console.log(warnings);
		var hasError = 0 < warnings.length;
		var $e = $('#region-pianoroll-error');
		$e.empty();
		for (var warning of warnings) {
			$e.append(this.formatTraceHTML(warning.message, warning.trace));
		}
		var $icon = $('a.item[data-tab="region-pianoroll-error"] i.icon');
		if (hasError) $icon.show(); else $icon.hide();
		if (focus) {
			if (hasError) ErrorTab.show(); else TrackTab.show();
		}
	}
	
	renderEvent() {
		var startTime = (new Date()).getTime();
		while ((new Date()).getTime() - startTime < this.opts.renderAtOnceMsec) {
			var trackIds = Object.keys(this.renderingEventId).map((s)=>parseInt(s));
			if (trackIds.length == 0) {
				this.renderComplete();
				return;
			}
			trackIds.sort((a, b)=>{
				if (a <= this.renderingTrackIdLast) a += this.tracks.length;
				if (b <= this.renderingTrackIdLast) b += this.tracks.length;
				return a - b;
			});
			for (var iTrack of trackIds) {
				var trackIdStr = iTrack.toString(10);
				var iEvent: number = this.renderingEventId[trackIdStr];
				if (this.tracks[iTrack].length <= iEvent) {
					delete this.renderingEventId[trackIdStr];
					continue;
				}
				this.renderingTrackIdLast = iTrack;
				var state: ITrackState = this.trackState[iTrack];
				var noteState = this.noteState[iTrack];
				var event = this.tracks[iTrack][iEvent];
				var e: IMMLEvent = {
					id:     event[0],
					tick:   event[1],
					duration: null,
					status: event[2],
					data0:  event[3],
					data1:  event[4],
					slurFrom: null,
					volume: state.volume,
					expression: state.expression,
					form: state.form,
					formParam: state.formParam
				};
				this.eventById[e.id] = e;
				switch (e.status) {

					// setEOT(): void { this.set(/*Consts.mstatusRev.EOT*/0, 0, 0); }

					case /*Consts.mstatusRev.NOTE_ON*/2:
						// console.log('NOTE_ON', this.noteLabel(e.data0), e.data1);
						var e0 = noteState[e.data0];
						if (e0) {
							this.addNoteNode(iTrack, e0, e);
							noteState[e.data0] = null;
							e.slurFrom = e0.data0;
						}
						this.lastNote[iTrack] = null;
						if (0 < e.data1) {
							noteState[e.data0] = e;
							this.lastNote[iTrack] = e.data0;
						}
						break;

					case /*Consts.mstatusRev.NOTE_OFF*/3:
						// console.log('NOTE_OFF', this.noteLabel(e.data0), e.data1);
						var e0 = noteState[e.data0];
						if (e0) this.addNoteNode(iTrack, e0, e);
						noteState[e.data0] = null;
						this.lastNote[iTrack] = null;
						break;

					case /*Consts.mstatusRev.NOTE*/6:
						// console.log('NOTE', this.noteLabel(e.data0), e.data1);
						if (this.lastNote[iTrack] != null) {
							var ln = this.lastNote[iTrack];
							var e0 = noteState[ln];
							if (e0) this.addNoteNode(iTrack, e0, e);
							noteState[ln] = null;
							e.slurFrom = e0.data0;
							e.data1 = e0.data1;
						}
						noteState[e.data0] = e;
						this.lastNote[iTrack] = e.data0;
						break;

					case /*Consts.mstatusRev.TEMPO*/4:
						this.addTempoNode(iTrack, e);
						this.tempoCalc.add(e.tick / this.DURBASE, e.data0 / 100/*TEMPO_SCALE*/);
						break;

					case /*Consts.mstatusRev.VOLUME*/5:
						state.volume = e.data0;
						break;

					case /*Consts.mstatusRev.FORM*/7:
						this.addWaveformNode(iTrack, e);
						state.form = e.data0;
						state.formParam = e.data1;
						break;
					
					// setEnvelope1Atk(a: number): void { this.set(/*Consts.mstatusRev.ENVELOPE1_ATK*/8, a, 0); }
					// setEnvelope1Point(t: number, l: number): void { this.set(/*Consts.mstatusRev.ENVELOPE1_ADD*/9, t, l); }
					// setEnvelope1Rel(r: number): void { this.set(/*Consts.mstatusRev.ENVELOPE1_REL*/10, r, 0); }
					// setEnvelope2Atk(a: number): void { this.set(/*Consts.mstatusRev.ENVELOPE2_ATK*/24, a, 0); }
					// setEnvelope2Point(t: number, l: number): void { this.set(/*Consts.mstatusRev.ENVELOPE2_ADD*/25, t, l); }
					// setEnvelope2Rel(r: number): void { this.set(/*Consts.mstatusRev.ENVELOPE2_REL*/26, r, 0); }
					// setNoiseFreq(f: number): void { this.set(/*Consts.mstatusRev.NOISE_FREQ*/11, f, 0); }
					// setPWM(w: number): void { this.set(/*Consts.mstatusRev.PWM*/12, w, 0); }
					// setPan(p: number): void { this.set(/*Consts.mstatusRev.PAN*/13, p, 0); }
					// setFormant(vowel: number): void { this.set(/*Consts.mstatusRev.FORMANT*/14, vowel, 0); }
					// setDetune(d: number): void { this.set(/*Consts.mstatusRev.DETUNE*/15, d, 0); }
					// setLFOFMSF(fm: number, sf: number): void { this.set(/*Consts.mstatusRev.LFO_FMSF*/16, fm, sf); }
					// setLFODPWD(dp: number, wd: number): void { this.set(/*Consts.mstatusRev.LFO_DPWD*/17, dp, wd); }
					// setLFODLTM(dl: number, tm: number): void { this.set(/*Consts.mstatusRev.LFO_DLTM*/18, dl, tm); }
					// setLFOTarget(target: number): void { this.set(Consts.mstatusRev.LFO_TARGET19, target, 0); }
					// setLPFSWTAMT(swt: number, amt: number): void { this.set(/*Consts.mstatusRev.LPF_SWTAMT*/20, swt, amt); }
					// setLPFFRQRES(frq: number, res: number): void { this.set(/*Consts.mstatusRev.LPF_FRQRES*/21, frq, res); }
					// setClose(): void { this.set(/*Consts.mstatusRev.CLOSE*/22, 0, 0); }
					// setVolMode(m: number): void { this.set(/*Consts.mstatusRev.VOL_MODE*/23, m, 0); }
					// setInput(sens: number, pipe: number): void { this.set(/*Consts.mstatusRev.INPUT*/27, sens, pipe); }
					// setOutput(mode: number, pipe: number): void { this.set(/*Consts.mstatusRev.OUTPUT*/28, mode, pipe); }
					
					case /*Consts.mstatusRev.EXPRESSION*/29:
						state.expression = e.data0;
						break;

					// setRing(sens: number, pipe: number): void { this.set(/*Consts.mstatusRev.RINGMODULATE*/30, sens, pipe); }
					// setSync(mode: number, pipe: number): void { this.set(/*Consts.mstatusRev.SYNC*/31, mode, pipe); }
					// setPortamento(depth: number, len: number): void { this.set(/*Consts.mstatusRev.PORTAMENTO*/32, depth, len); }
					// setMidiPort(mode: number): void { this.set(/*Consts.mstatusRev.MIDIPORT*/33, mode, 0); };
					// setMidiPortRate(rate: number): void { this.set(/*Consts.mstatusRev.MIDIPORTRATE*/34, rate, 0); };
					// setPortBase(base: number): void { this.set(/*Consts.mstatusRev.BASENOTE*/35, base, 0); };
					// setPoly(voiceCount: number): void { this.set(/*Consts.mstatusRev.POLY*/36, voiceCount, 0); };
					
					case /*Consts.mstatusRev.RESET_ALL*/38:
					case /*Consts.mstatusRev.SOUND_OFF*/37:
						for (var n in noteState) {
							if (!noteState.hasOwnProperty(n)) continue;
							var e0 = noteState[n];
							if (e0) this.addNoteNode(iTrack, e0, e);
						}
						noteState = {};
						// @todo reset other params when RESET_ALL
						break;

					// setHwLfo(w: number, f: number, pmd: number, amd: number, pms: number, ams: number, s: number): void {
					//     this.set(/*Consts.mstatusRev.HW_LFO*/39, ((w & 3) << 27) | ((f & 0xff) << 19) | ((pmd & 0x7f) << 12) | ((amd & 0x7f) << 5) | ((pms & 7) << 2) | (ams & 3), 0);
					// }

					default:
						// console.log(Consts.mstatus[e.status] || e.status, e.tick, e.data0, e.data1);
				}
				this.renderingEventId[trackIdStr]++;
			}
		}
		this.updateRightMost();
		this.updateNodeVisibility(true);
		setTimeout(() => this.renderEvent(), this.opts.renderWaitMsec);
	}
	
	renderComplete() {
		this.updateRightMost();
		if (this.adjustScroll) {
			var scrollOffset = (this.grid.offsetHeight - this.container.offsetHeight) / 2;
			if (this.topMost != null) scrollOffset += (this.topMost + this.bottomMost - this.grid.offsetHeight) / 2.0;
			this.scrollTo(null, scrollOffset);
		}
		if (this.initialScroll != null) {
			console.log(this.initialScroll);
			this.scrollTo(this.initialScroll);
		}
		this.updateNodeVisibility(true);
		
		var ms = (new Date()).getTime() - this.startTimestampMs;
		console.log('rendering completed in %s ms(in real)', ms);
		
		// PianoRollStatic.unblock();

		// this.positionMapL.prettyPrint();

		// $(this.container).on('wheel', function(evt) {
		// 	this.scrollLeft += evt.deltaY;
		// 	this.scrollTop  += evt.deltaX;
		// 	evt.preventDefault();
		// });
	}

	syncLocator(timeMsec: number, preventRollback: boolean=false) {
		var x = Infinity;
		if (timeMsec != null) {
			var bars = this.tempoCalc.msecToBar(timeMsec); //(info.nowMSec - delayMs);
			x = this.opts.barWidth * bars;
		}
		if (0 <= x && x < this.rightMost) {
			var cw = this.container.clientWidth;
			var x0before = preventRollback ? this.container.scrollLeft : 0;
			var x0max = this.container.scrollWidth - cw;
			var x0 = Math.max(x0before, Math.min(x - cw * this.opts.locatorPosition, x0max));
			this.locator.style.left = (x - x0).toString(10) + 'px';
			this.locator.style.display = 'block';
			this.scrollTo(x0);
		}
		else {
			this.locator.style.display = 'none';
		}

		// var level = (info.sequencerStatus.levelL + info.sequencerStatus.levelR) / 2.0;
		// var hr = 20 * Math.log(level) / Math.log(10);
		// var maxWidth = 50;
		// var hrDisp = Math.round((90 + Math.max(-90, hr)) * maxWidth / 90);
		// // console.log(new Array(hrDisp).join('|')); // Visualize audio level
	}

	_traceJumpHandler: (evt: Event) => boolean;
	traceJumpHandler(evt: Event): boolean {
		if (this.source != MMLEditor.mml) {
			toastr.warning(L('Trace positions may be now incorrect since your MML has been edited.'));
			// return false;
		}
		var e: HTMLElement = <HTMLElement>evt.target;
		var row = parseInt(e.dataset['mmlRow']) - 1;
		var col = parseInt(e.dataset['mmlCol']) - 1;
		var text = e.dataset['mmlText'];
		if (text == null)
			MMLEditor.moveTo(row, col);
		else
			MMLEditor.selectRange(row, col, text.length);
		return false;
	}

	formatTraceHTML(title: string, trace: any[], eventId?: number) : HTMLTableElement {
		if (!this._traceJumpHandler) {
			this._traceJumpHandler = this.traceJumpHandler.bind(this);
		}
		var cells = [];
		var event: IMMLEvent = this.eventById[eventId];
		for (var i = 0; i < trace.length; i++) {
			var t = trace[i];
			var div = document.createElement('div');
			if (t instanceof Array) {
				if (t[0] != null) {
					var s1 = document.createElement('span');
					s1.textContent = 'in ';
					div.appendChild(s1);
					var s2 = document.createElement('span');
					s2.classList.add('pianoroll-macro');
					s2.textContent = t[0];
					div.appendChild(s2);
				}
				if (2 <= t.length) {
					var s3 = document.createElement('span');
					s3.textContent = ' at ';
					div.appendChild(s3);
					var s4 = document.createElement('a');
					s4.textContent = 'L.' + t[1] + (3 <= t.length ? ':' + t[2] : '');
					s4.dataset['mmlRow'] = t[1];
					s4.dataset['mmlCol'] = 3 <= t.length ? t[2] : '1';
					s4.dataset['mmlText'] = t[0] == null ? '' : t[0];
					div.appendChild(s4);
					//
					s4.addEventListener('click', this._traceJumpHandler);
					if (eventId) {
						var e = document.getElementById('mml-id-' + eventId);
						e.dataset['mmlRow']  = s4.dataset['mmlRow'];
						e.dataset['mmlCol']  = s4.dataset['mmlCol'];
						e.dataset['mmlText'] = s4.dataset['mmlText'];
						eventId = null;
					}
				}
			}
			else {
				var s5 = document.createElement('span');
				s5.textContent = 'in ';
				div.appendChild(s5);
				var s6 = document.createElement('span');
				s6.classList.add('pianoroll-track');
				s6.textContent = 'Track #' + t;
				div.appendChild(s6);
			}
			cells.push([div]);
		}
		return Utils.createTable(title, cells);
	}

	formatTraceText(trace: any[]): string[] {
		var n = trace.length;
		var lines = [];
		for (var i = 0; i < n; i++) {
			var t = trace[i];
			if (t instanceof Array) {
				var s = [];
				if (t[0] != null) {
					s.push('in');
					s.push(t[0]);
				}
				if (2 <= t.length) {
					s.push('at');
					s.push('L.' + t[1] + (3 <= t.length ? ':' + t[2] : ''));
				}
				lines.push(s.join(' '));
			}
			else {
				lines.push('in Track #' + t);
			}
		}
		return lines;
	}

}

export var PianoRoll: PianoRollStatic;

$(() => PianoRollStatic.load('', [], 0));
