export class TempoCalc {

	points: any[];

	constructor() {
		this.points = [
			{
				barAt: 0.0,
				tempo: 120,
				msecAt: 0.0,
				msPerBar: 4 * 60000.0 / 120
			}
		];
	}

	add(barAt: number, tempo: number) {
		var msecAt = this.barToMsec(barAt);
		console.log('at:%s[bar] %s[ms] TEMPO=%s', barAt, msecAt, tempo);
		// for (var p of this.points) {
		// 	if (p.barAt == barAt) {
		// 		p.tempo = tempo;
		// 		return;
		// 	}
		// }
		this.points.push({
			barAt: barAt,
			tempo: tempo,
			msecAt: msecAt,
			msPerBar: 4 * 60000.0 / tempo
		});
	}

	barToMsec(bars: number): number {
		var ms = 0;
		var p0 = this.points[0];
		var p1;
		for (var i = 1; i < this.points.length; i++) {
			p1 = this.points[i];
			var b = Math.min(bars, p1.barAt - p0.barAt);
			ms += p0.msPerBar * b;
			bars -= b;
			if (bars <= 0) return ms;
			p0 = p1;
		}
		return ms + p0.msPerBar * bars;
	}

	msecToBar(msec: number): number {
		var p0 = this.points[0];
		for (var i = 1; i < this.points.length; i++) {
			var p = this.points[i];
			if (msec <= p.msecAt) break;
			p0 = p;
		}
		return p0.barAt + (msec - p0.msecAt) / p0.msPerBar;
	}

}
