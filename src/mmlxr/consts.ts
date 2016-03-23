export const message = {
	COM_BOOT: 1, // Main->Worker
	COM_PLAY: 2, // Main->Worker
	COM_STOP: 3, // Main->Worker
	COM_PAUSE: 4, // Main->Worker
	COM_BUFFER: 5, // Main->Worker->Main
	COM_COMPCOMP: 6, // Worker->Main
	COM_BUFRING: 7, // Worker->Main
	COM_COMPLETE: 8, // Worker->Main
	COM_SYNCINFO: 9, // Main->Worker->Main
	COM_PLAYSOUND: 10, // Worker->Main
	COM_STOPSOUND: 11, // Worker->Main->Worker
	COM_DEBUG: 12, // Worker->Main
	COM_TRACE: 13, // Main->Worker->Main
	COM_MUTE: 14,  // Main->Worker
	COM_GENWAV: 15, // Main->Worker->Main
	COM_TERMINATE: 16, // Main->Worker
	COM_LOG: 17, // Worker->Main
    COM_COMPSTART: 18 // Worker->Main
};

export const mstatus = [
	'EOT', 'NOP', 'NOTE_ON', 'NOTE_OFF', 'TEMPO', 'VOLUME', 'NOTE', 'FORM',
	'ENVELOPE1_ATK', 'ENVELOPE1_ADD', 'ENVELOPE1_REL',
	'NOISE_FREQ', 'PWM', 'PAN', 'FORMANT', 'DETUNE',
	'LFO_FMSF', 'LFO_DPWD', 'LFO_DLTM', 'LFO_TARGET',
	'LPF_SWTAMT', 'LPF_FRQRES', 'CLOSE', 'VOL_MODE',
	'ENVELOPE2_ATK', 'ENVELOPE2_ADD', 'ENVELOPE2_REL',
	'INPUT', 'OUTPUT', 'EXPRESSION', 'RINGMODULATE',
	'SYNC', 'PORTAMENTO', 'MIDIPORT', 'MIDIPORTRATE', 'BASENOTE',
	'POLY', 'SOUND_OFF', 'RESET_ALL', 'HW_LFO'
];

export const mstatusRev = {
	'EOT'           :  0,
	'NOP'           :  1,
	'NOTE_ON'       :  2,
	'NOTE_OFF'      :  3,
	'TEMPO'         :  4,
	'VOLUME'        :  5,
	'NOTE'          :  6,
	'FORM'          :  7,
	'ENVELOPE1_ATK' :  8,
	'ENVELOPE1_ADD' :  9,
	'ENVELOPE1_REL' : 10,
	'NOISE_FREQ'    : 11,
	'PWM'           : 12,
	'PAN'           : 13,
	'FORMANT'       : 14,
	'DETUNE'        : 15,
	'LFO_FMSF'      : 16,
	'LFO_DPWD'      : 17,
	'LFO_DLTM'      : 18,
	'LFO_TARGET'    : 19,
	'LPF_SWTAMT'    : 20,
	'LPF_FRQRES'    : 21,
	'CLOSE'         : 22,
	'VOL_MODE'      : 23,
	'ENVELOPE2_ATK' : 24,
	'ENVELOPE2_ADD' : 25,
	'ENVELOPE2_REL' : 26,
	'INPUT'         : 27,
	'OUTPUT'        : 28,
	'EXPRESSION'    : 29,
	'RINGMODULATE'  : 30,
	'SYNC'          : 31,
	'PORTAMENTO'    : 32,
	'MIDIPORT'      : 33,
	'MIDIPORTRATE'  : 34,
	'BASENOTE'      : 35,
	'POLY'          : 36,
	'SOUND_OFF'     : 37,
	'RESET_ALL'     : 38,
	'HW_LFO'        : 39
};

export const note = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
