import {vsprintf} from 'sprintf-js';

declare var language;
window['selectedLanguage'] = 'en';
var ready = false;

export function L(str: string, ...params): string {
	var s = (language[window['selectedLanguage']] || {})[str];
	if (s==null) s = str;
	if (0 < params.length) s = vsprintf(s, params);
	return s;
}

export function selectLanguage(lang?: string) {
	init();
	if (lang == null) {
		var m = location.search.match(/[\?\&]lang=(\w+)/);
		lang = m && m[1] || navigator.language || navigator['userLanguage'];
	}
	if (lang == null && navigator['languages']) {
		lang = 'en';
		for (var l_ of navigator['languages']) {
			var l = l_.split('-')[0];
			if (!language[l]) continue;
			lang = l;
			break;
		}
	}
	window['selectedLanguage'] = lang;
	$('.L').each((i, e) => {
		$(e).text(L($(e).attr('data-L')));
	});
	$('.L-select').each((i, e)=>{
		var $l = $(e).children(`.L-${window['selectedLanguage']}`);
		$(e).children('*').hide();
		if (0 < $l.length)
			$l.show();
		else
			$(e).children('.L-default').show();
	});
}
window['selectLanguage'] = selectLanguage;

function init() {
	$('.L:not([data-L])').each((i, e) => {
		$(e).attr('data-L', $(e).text());
	});
	ready = true;
}

$(()=>init());
