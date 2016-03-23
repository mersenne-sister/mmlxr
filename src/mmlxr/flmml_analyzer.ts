/// <reference path="../peg/flmml-parser.d.ts" />

import SteppingString = require('./stepping_string');
import flmml = require('flmml-parser');
import sanitize = require('sanitize-filename');

interface IMmlLine {
	type: string;
	location: number[];
	name?: string;
	params?: string[];
	body?: string;
	value?: any;
}

export class FlmmlAnalyzer {
	
	lines: IMmlLine[];
	comments: {content:string; location:number[];}[];
	codes: {content:string; location:number[];}[];
	info: { [name:string]: string[] } = {};
	macros: { [name:string]: IMmlLine } = {};
	tracks: IMmlLine[] = [];
	wav9: IMmlLine[] = [];
	wav13: IMmlLine[] = [];
	
	get author(): string {
		if (this.info['code'] && 0 < this.info['code'].length) return this.info['code'].join(', ');
		return null;
	}
	
	get artist(): string {
		if (this.info['artist'] && 0 < this.info['artist'].length) return this.info['artist'].join(', ');
		return null;
	}
	
	get title(): string {
		if (this.info['title'] && 0 < this.info['title'].length) return this.info['title'].join(', ');
		return null;
	}
	
	get fsTitle(): string {
		var title = this.title;
		if (title == null) title = '';
		title = sanitize(title);
		return 0 < title.length ? title : 'Untitled';
	}
	
	constructor(src: string) {
		src = src.replace(/\r?\n|\r/g, "\n");
		if (!src.match(/\n$/)) src += "\n";
		
		var mml = new SteppingString(src);
		this.comments = mml.removeByRegexp(new RegExp(<any>/\/\*.*?\*\//g));
		this.codes = mml.removeByRegexp(new RegExp(<any>/`[^\`]*`/g));
		
		this.lines = flmml.parse(mml.toString());
		for (var line of this.lines) {
			if (!line.location) continue;
			var l = line.location;
			l[0] = mml.trace(l[0]);
			l[1] = mml.trace(l[1] - 1) + 1;
			switch (line.type) {
				case 'macrodef':
					this.macros[line.name] = line;
					break;
				case 'trackdef':
					this.tracks.push(line);
					break;
				case 'meta':
					this.extractMetaInfo(line);
					break;
			}
			//
			// var bodyStr = (line.name || line.body || "").replace(/\s+/g, " ");
			// var srcStr = src.substr(l[0],10).replace(/\s+/g, " ");
			// console.log(`${(line.type+"          ").substr(0,10)}: ${(bodyStr+"          ").substr(0,10)} | ${srcStr}`);
		}
		
		// console.log(this);
	}
	
	private extractMetaInfo(line: IMmlLine) {
		switch (line.name) {
			case 'info':
				let h = line.value.header;
				if (!this.info[h]) this.info[h] = [];
				this.info[h].push(line.value.data);
				break;
			case 'WAV9':
				this.wav9[line.value.id] = line;
				break;
			case 'WAV13':
				this.wav13[line.value.id] = line;
				break;
		}
	}
	
}
