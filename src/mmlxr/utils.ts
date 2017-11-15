import PubSub = require('pubsub-js');

export function createTable(title: string, cells: (HTMLElement|string)[][]): HTMLTableElement {
	var table = document.createElement('table');
	table.classList.add('pianoroll-table');
	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var th = document.createElement('th');
	var cols = cells[0].length;
	th.colSpan = cols;
	th.textContent = title;
	tr.appendChild(th);
	thead.appendChild(tr);
	table.appendChild(thead);
	var tbody = document.createElement('tbody');
	for (var row of cells) {
		var tr = document.createElement('tr');
		for (var i = 0; i < row.length; i++) {
			var td = 2 <= cols && i == 0 ?
				document.createElement('th') :
				document.createElement('td');
			if (row[i] instanceof HTMLElement) {
				td.appendChild(<HTMLElement>row[i]);
			}
			else {
				td.textContent = <string>row[i];
			}
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);
	return table;
}

export function resetFileInput(id: string) {
	var $e0 = $(`#${id}`);
	var $p = $e0.parent();
	var $e = $e0.clone(true);
	$e0.remove();
	$p.append($e);
}

var zeros = [
	'', '0', '00', '000', '0000', '00000', '000000', '0000000', '00000000',
	'000000000', '0000000000', '00000000000', '000000000000', '0000000000000',
	'00000000000000', '000000000000000', '0000000000000000', '00000000000000000',
	'000000000000000000', '0000000000000000000', '00000000000000000000'
];

export function trimNumber(n: number, d: number): string {
	var s = n.toString(10);
	if (d <= s.length) return s;
	s = zeros[d] + s;
	return s.substr(s.length - d);
}

export function sign(n: number): number {
	return n<0 ? -1 : 0<n ? 1 : 0;
}

export function doDownload(url: string, name: string): void {
	var a = document.createElement('a');
	a.href = url;
	a.setAttribute('download', name);
	a.dispatchEvent(new CustomEvent('click'));
	// URL.revokeObjectURL(url);
}

export function registerSubscribers(cmdDefs): void {
	Object.keys(cmdDefs).forEach((key)=>{
		PubSub.subscribe(key, cmdDefs[key]);
	});
}

export function delayOnce(ms: number, fn: ()=>void): NodeJS.Timer {
	if (fn['__timeout']) clearTimeout(fn['__timeout']);
	return fn['__timeout'] = setTimeout(()=>{
		fn['__timeout'] = null;
		fn();
	}, ms);
}

export function randomHex(digits: number): string {
	var n = Math.ceil(digits / 8);
	var s = '';
	for (var i=0; i<n; i++) {
		var t = '0000000' + Math.floor(Math.random() * 4294967295.999999).toString(16);
		s += t.substr(t.length - 8);
	}
	return s.substr(0, digits);
}

export function numberFormat(n: number): string {
	// if (n.toLocaleString) return n.toLocaleString();
	return String(n).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
}

export function watchVar(target: any, key: string): Promise<any> {
	return new Promise((resolve, reject)=>{
		var fn = ()=>{
			if (target && target[key])
				resolve(target);
			else
				setTimeout(fn, 10);
		};
		fn();
	});
}

/**
 * parseParams - parse query string paramaters into an object.
 * Based on https://gist.github.com/kares/956897
 */
export function parseParams(query) {
	var params = {}, e;
	var decode = function (str) {return decodeURIComponent( str.replace(/\+/g, " ") );};
	var re = new RegExp(<any>/([^&=]+)=?([^&]*)/g);
	while ( e = re.exec(query) ) {
		var k = decode( e[1] ), v = decode( e[2] );
		if (k.substring(k.length - 2) === '[]') {
			k = k.substring(0, k.length - 2);
			(params[k] || (params[k] = [])).push(v);
		}
		else params[k] = v;
	}
	return params;
}



$.fn.forceIntegerInput = function(min: number|Function, max: number|Function) {
	return this
		.on('input', function(){
			var $e = $(this);
			$e.val((<string>$e.val()).replace(/\D+/g, ''));
		})
		.on('change', function(){
			var $e = $(this);
			var min_ = $.isFunction(min) ? (<()=>number>min)() : <number>min;
			var max_ = $.isFunction(max) ? (<()=>number>max)() : <number>max;
			var v = parseInt((<string>$e.val()).replace(/\D+/g, ''));
			v = Math.max(min_, Math.min(v, max_));
			$e.val(v);
		});
}
