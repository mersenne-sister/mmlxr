// Based on http://codepen.io/pprice/details/splkc/
(function($) {
	
	function getGeom($splitter) {
		var isVertical = $splitter.hasClass('vertical');
		var $prev = $splitter.prev();
		var $next = $splitter.next();
		return {
			isVertical: isVertical,
			
			splitterSize: isVertical ?
				$splitter.outerHeight() :
				$splitter.outerWidth(),
		
			totalSize: isVertical ?
				$prev.outerHeight() + $next.outerHeight() :
				$prev.outerWidth()  + $next.outerWidth(),
			
			prevHead: isVertical ?
				$prev.offset().top :
				$prev.offset().left,
			
			splitterHead: isVertical ?
				$splitter.offset().top :
				$splitter.offset().left
		};
	}
	
	/**
	 * onPan($splitter); // Enable $e.splitter('get')
	 * onPan($splitter, 100); // Set splitter position by pixels
	 * onPan($splitter, 0.3, true); // Set splitter position by ratio
	 */
	function onPan($splitter, t, forceByRatio) {
		if (!(forceByRatio || t == null || $splitter.hasClass('draggable'))) return;

		var opts = $splitter.data('splitter-opts');
		var geom = getGeom($splitter);

		if (t == null) {
			t = geom.splitterHead + geom.splitterSize / 2;
			forceByRatio = false;
		}
		else {
			if (typeof t == 'object') t = t[geom.isVertical ? 'y' : 'x'];
			t = parseFloat(t);
			if (isNaN(t)) return;
		}
		
		var prevRatio = t;
		if (!forceByRatio) {
			prevRatio = (t - geom.prevHead - geom.splitterSize / 2) / geom.totalSize;
		}
		prevRatio = Math.max(opts.min, prevRatio);
		prevRatio = Math.min(prevRatio, 1.0 - opts.min);
		$splitter.attr('data-splitter-pos', prevRatio);
		
		$splitter.prev().css('flex', prevRatio.toString()).trigger('splitter:resize');
		$splitter.next().css('flex', (1.0 - prevRatio).toString()).trigger('splitter:resize');
		opts.onresize && opts.onresize($splitter, prevRatio);
	};

	$.fn.splitter = function(a1, a2) {
		var cmd, opts;
		if (typeof a1 == 'string') {
			cmd = a1;
			opts = a2 || {};
		}
		else {
			cmd = 'init';
			opts = a1 || {};
		}
		
		switch (cmd) {
			
			case 'get':
				return parseFloat(this.attr('data-splitter-pos'));
			
			case 'init':
				opts = $.extend({
					min: .15,
					zIndex: 10
				}, opts);
				
				this.each(function(i, splitter){
					var $splitter = $(splitter);

					var isVertical = $splitter.hasClass('vertical');
					var cursor = isVertical ? 'ns-resize' : 'ew-resize';

					$splitter
						.data('splitter-opts', opts)
						.css('cursor', cursor)
						.hammer()
						.on('panstart', function(e) {
							$splitter
								.addClass('draggable')
								.data('splitter-z-index', $splitter.css('z-index'))
								.data('splitter-cursor', $('body').css('cursor'))
								.css('z-index', opts.zIndex);
							$('body').css('cursor', cursor);
							e.preventDefault();
						})
						.data('hammer')
							.get('pan')
							.set({
								threshold: 1,
								direction: isVertical ? Hammer.DIRECTION_VERTICAL : Hammer.DIRECTION_HORIZONTAL
							});

					$splitter.parents()
						.hammer().on('pan', function(e){
							onPan($splitter, e.gesture.center);
						});

					$(document)
						.hammer().on('panend', function() {
							$('body')
								.css('cursor', $splitter.data('splitter-cursor'));
							$splitter
								.removeClass('draggable')
								.css('z-index', $splitter.data('splitter-z-index'));
						});
					
					onPan($splitter);
				});
				break;

			case 'set':
				this.each(function(i, splitter){
					onPan($(splitter), opts, true);
				});
				break;

		}
		
		return this;
	}

})(jQuery);
