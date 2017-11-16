importScripts('../components/libmp3lame-js/libmp3lame.js');

var lame;

self.onmessage = function(e) {
	switch (e.data.type) {
		case 'init':
			if (!e.data.config) e.data.config = {};
			lame = Lame.init();
			Lame.set_mode(lame, e.data.config.mono ? Lame.MONO : Lame.JOINT_STEREO);
			Lame.set_num_channels(lame, e.data.config.mono ? 1 : 2);
			Lame.set_num_samples(lame, -1);
			Lame.set_in_samplerate(lame, e.data.config.sampleRate || 44100);
			Lame.set_out_samplerate(lame, e.data.config.sampleRate || 44100);
			Lame.set_bitrate(lame, e.data.config.bitRate || 128);
			Lame.init_params(lame);
			console.log({
				version:       Lame.get_version(),
				mode:          Lame.get_mode(lame),
				samples:       Lame.get_num_samples(lame),
				channels:      Lame.get_num_channels(lame),
				inSampleRate:  Lame.get_in_samplerate(lame),
				outSampleRate: Lame.get_out_samplerate(lame),
				bitRate:       Lame.get_bitrate(lame),
				VBR:           Lame.get_VBR(lame)
			});
			break;

		case 'encode':
			var mp3data = Lame.encode_buffer_ieee_float(lame, e.data.buf[0], e.data.buf[1]);
			self.postMessage({ type: 'data', buf: mp3data.data });
			break;
			
		case 'finish':
			var mp3data = Lame.encode_flush(lame);
			self.postMessage({ type: 'end' });
			Lame.close(lame);
			lame = null;
			self.close();
			break;
	}
};
