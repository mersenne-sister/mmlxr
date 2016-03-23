/// <reference path="../../typings/browser.d.ts" />

class SteppingString {
	
	/*
	
	     0         1         2         3
	     0123456789012345678901234567890123456789
	     [0,40                                  ] : current
	     [                                      ] : original
	
	               ↓ Remove 6,14
	
	     0         1         2         3
	     0123456789012345678901234567890123456789
	     [0,40                                  ]
	     [0,6 ][6,34                            ]
	     [0,6 ][6,14        ][20,20             ]
	     [0,6 ][20,20             ]
	     [    ]XXXXXXXXXXXXXX[                  ]
	
	               ↓ Remove 17,3
	
	     0         1         2         3
	     0123456789012345678901234567890123456789
	     [0,6 ][20,20             ]
	     [0,6 ][20,11    ][31,9   ]
	     [0,6 ][20,11    ][ ][34,6]
	     [0,6 ][20,11    ][34,6]
	     [    ]XXXXXXXXXXXXXX[         ]XXX[    ]
	
	               ↓ Remove 12,9
	
	     0         1         2         3
	     0123456789012345678901234567890123456789
	     [0,6 ][20,11    ][34,6]
	     [0,6 ][20,6][   ][  ][]
	                 26,5 34,4 38,2
	     [0,6 ][20,6][]
	     [    ]XXXXXXXXXXXXXX[    ]XXXXXXXXXXXX[]
	
	*/
	
	str: string;
	ranges: number[][];
	
	constructor(str) {
		this.str = str;
		this.ranges = [[0, str.length]];
	}
	
	/**
	 * @param begin Current location at start to remove
	 * @param length Current length to remove
	 * @return The original location of removed string in range [ begin, end ]
	 */
	remove(begin: number, length: number): number[] {
		if (length==0) return null;
		this.divide(begin);
		this.divide(begin + length);
		var i;
		var j = 0;
		var n = this.ranges.length;
		for (i=0; i < n; i++) {
			var r0 = this.ranges[i];
			if (j != begin) {
				j += r0[1];
				continue;
			}
			var i0 = i;
			var l = 0;
			while (i < n) {
				var r = this.ranges[i++];
				l += r[1];
				if (l==length) {
					this.ranges.splice(i0, i-i0);
					return [ r0[0], r[0]+r[1] ];
				}
			}
			return null;
		}
		return null;
	}
	
	divide(pos: number): number {
		var r, i;
		var n = this.ranges.length;
		if (n==0) return null;
		for (i=0; i < n; i++) {
			r = this.ranges[i];
			if (pos < r[1]) break;
			pos -= r[1];
		}
		if (n<=i) return null;
		if (pos==0) return null;
		var s = [
			r[0] + pos,
			r[1] - pos
		];
		r[1] = pos;
		this.ranges.splice(i+1, 0, s);
		return i;
	}
	
	removeByRegexp(regexp: RegExp): {content:string; location:number[];}[] {
		var removed = [];
		var str = this.toString();
		var m;
		var ranges = [];
		while ((m = regexp.exec(str)) != null) {
			var end = regexp.lastIndex;
			var len = m[0].length;
			ranges.unshift([ end-len, len ]);
		}
		for (var r of ranges) {
			removed.push({
				content: str.substr(r[0], r[1]),
				location: this.remove(r[0], r[1])
			});
		}
		return removed;
	}
	
	trace(pos: number): number {
		var r, i;
		var n = this.ranges.length;
		if (n==0) return null;
		for (i=0; i < n; i++) {
			r = this.ranges[i];
			if (pos < r[1]) return r[0] + pos;
			pos -= r[1];
		}
		return null;
	}
	
	toString(): string {
		var s = '';
		var n = this.ranges.length;
		for (var i=0; i < n; i++) {
			var r = this.ranges[i];
			s += this.str.substr(r[0], r[1]);
		}
		return s;
	}
	
	static test1(): boolean {
		var s = new SteppingString('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd');
		s.remove(6, 14);
		if (s.toString() != '012345KLMNOPQRSTUVWXYZabcd') return false;
		if (s.trace(0) != 0) return false;
		if (s.trace(5) != 5) return false;
		if (s.trace(6) != 20) return false;
		if (s.trace(25) != 39) return false;
		s.remove(17, 3);
		if (s.toString() != '012345KLMNOPQRSTUYZabcd') return false;
		s.remove(12, 9);
		if (s.toString() != '012345KLMNOPcd') return false;
		if (s.trace(11) != 25) return false;
		if (s.trace(12) != 38) return false;
		s.remove(0, 14);
		if (s.toString() != '') return false;
		return true;
	}
	
}

export = SteppingString;
