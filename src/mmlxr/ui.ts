/// <reference path="../vendor/jquery-plugins.d.ts" />
/// <reference path="../vendor/semantic-ui.d.ts" />
/// <reference path="lazy_singleton.d.ts" />

import {MMLEditor} from './mml_editor';
import * as Utils from './utils';

export class UIStatic implements LazySingleton {

	RESIZE_DELAY: number = 100;

	ready: boolean;

	constructor() {
		this.blockLevel = 0;
		$(()=>this.init());
	}

	private init() {
		$('.tabular.menu .item, .pointing.secondary.menu .item').tab();
		$('.ui.accordion').accordion({
			// selector: { trigger: '.title .icon' }
		});
		$('[data-content]').popup();

		var onResize = ()=>{ MMLEditor.ace.resize(); };
		$('.uix.splitter').splitter({
			onresize: ($splitter, prevRatio)=>{
				Utils.delayOnce(this.RESIZE_DELAY, onResize);
			}
		});
		
		var onChangeRange = function(){
			var $e = $(this);
			var v = parseFloat(<string>$e.val());
			var v0 = $e.data('prev-val');
			if (v === v0) return;
			$e.data('prev-val', v);
			var min = parseFloat($e.attr('min'));
			var max = parseFloat($e.attr('max'));
			var r = (v-min) / (max-min);
			var c0 = $e.css('color');
			var c1 = $e.data('range-bgcolor');
			var p = (r*100).toString() + '%';
			$e.css('background', [
				'linear-gradient(to right,',
				c0, '0%,', c0, p, ',',
				c1, p, ',', c1, '100%)'
			].join(' '))
		};
		var onFocusBlurRange = function(){
			$(this).data('prev-val', null);
			onChangeRange.apply(this, []);
		};
		$('input[type=range]').each((i, e)=>{
			var $e = $(e);
			$e.data('range-bgcolor', $e.css('background-color'));
			onChangeRange.apply(e, []);
			$e.on('input', onChangeRange);
			$e.on('focus', onFocusBlurRange);
			$e.on('blur', onFocusBlurRange);
		});
		
		toastr.options.positionClass = 'toast-top-left';
		toastr.options.preventDuplicates = true;

		// $('.filter-os').hide();
		// if ($.browser.mac) {
		// 	$('[data-title-os-mac]').each((i, e)=>{
		// 		$(e).attr('title', $(e).attr('data-title-os-mac'));
		// 	});
		// 	$('.filter-os.mac').show();
		// }
		// else {
		// 	$('[data-title-os-win]').each((i, e)=>{
		// 		$(e).attr('title', $(e).attr('data-title-os-win'));
		// 	});
		// 	$('.filter-os.win').show();
		// }

		// $(()=>{
		// 	$('a.ui, button.ui, .ui.item, .ui.dropdown')
		// 		.removeAttr('tab-index')
		// 		.attr('tab-index', -1);
		// });

		this.ready = true;
	}

	private blockLevel: number;
	block(text: string) {
		if (0 < this.blockLevel++) return;
		$('#modal-block .ui.text.loader').text(text);
		$('#modal-block')
			.modal({ closable: false, duration: 0 })
			.modal('show');
	}
	unblock(force: boolean=false) {
		this.blockLevel--;
		if (this.blockLevel < 0 || force) this.blockLevel = 0;
		if (0 < this.blockLevel) return;
		$('#modal-block').modal('hide');
	}

	private cloneTemplate($template: JQuery): JQuery {
		var id = $template.attr('id');
		return $template.clone()
			.removeAttr('id')
			.removeClass('template')
			.addClass(id)
			.show();
	}

	alert(messageOrTemplate: string|JQuery, buttonTitle: string='OK') {
		return new Promise((resolve, reject)=>{
			var $e = $('#modal-alert');
			var $content = $e.find('.content').empty();
			if (messageOrTemplate['hasClass'] && (<JQuery>messageOrTemplate).hasClass('template')) {
				var $entity = this.cloneTemplate(<JQuery>messageOrTemplate);
				$content.append($entity);
			}
			else {
				$content.append(messageOrTemplate);
			}
			$e.find('.button').empty().text(buttonTitle);
			$e.modal({
				closable: true,
				onHide: ()=>resolve()
			}).modal('show');
		});
	}

	confirm(
		headerTitle: string,
		message: JQueryizable,
		approveTitle: string,
		denyTitle: string,
		useNegativeColor: boolean=false
	): Promise<boolean> {
		return new Promise((resolve, reject)=>{
			var $e = $('#modal-confirm');
			$e.find('.header').empty().text(headerTitle);
			$e.find('.content').empty().append(message);
			$e.find('.right.button span.text').empty().text(approveTitle);
			$e.find('.deny.button span.text').empty().text(denyTitle);
			$e.find('.right.button')
				.removeClass(useNegativeColor ? 'positive' : 'negative')
				.addClass(useNegativeColor ? 'negative' : 'positive');
			var fn = ($btn)=>{
				if ($btn.hasClass('deny')) reject('cancel'); else resolve(true);
			};
			$e.modal({
				closable: false,
				onApprove: fn,
				onDeny: fn
			}).modal('show');
		});
	}

	prompt(
		headerTitle: string,
		message: JQueryizable,
		approveTitle: string,
		denyTitle: string,
		validator?: (s:string)=>boolean,
		placeholder?: string,
		defaultInput?: string
	): Promise<string> {
		return new Promise((resolve, reject)=>{
			var $e = $('#modal-prompt');
			var $inputDiv = $e.find('.ui.input');
			var $input = $inputDiv.find('input');
			var $icon = $inputDiv.find('.icon');
			var $approveButton = $e.find('.positive.button');
			var $denyButton = $e.find('.deny.button');
			// var $error = $e.find('.error');
			$e.find('.header').empty().text(headerTitle);
			if (message['hasClass'] && (<JQuery>message).hasClass('template')) {
				var id = (<JQuery>message).attr('id');
				message = (<JQuery>message).clone()
					.removeAttr('id')
					.removeClass('template')
					.addClass(id)
					.show();
			}
			$e.find('.message').empty().append(message);
			var validate = ()=>{
				if (validator && !validator(<string>$input.val())) {
					// $error.text('Invalid text');
					$inputDiv.addClass('error');
					$approveButton.addClass('disabled');
					$icon
						.addClass('warning')
						.addClass('sign')
						.attr('title', 'Invalid format');
				}
				else {
					// $error.empty();
					$inputDiv.removeClass('error');
					$approveButton.removeClass('disabled');
					$icon
						.removeClass('warning')
						.removeClass('sign')
						.removeAttr('title');
				}
			};
			$input
				.off('input').on('input', (evt) => validate())
				.off('keyup').on('keyup', (evt) => {
					if (evt.keyCode == 13) $approveButton.trigger('click');
				})
				.val(defaultInput == null ? '' : defaultInput)
				.attr('placeholder', placeholder);
			// $error.empty();
			$inputDiv.removeClass('error');
			$approveButton.find('span.text').empty().text(approveTitle);
			$denyButton.find('span.text').empty().text(denyTitle);
			$e.modal({
				closable: false,
				onApprove: () => resolve(<string>$input.val()),
				onDeny: () => reject('cancel')
			}).modal('show');
			$(() => validate());
		});
	}

	formModal(
		headerTitle: string,
		$template: JQuery,
		approveTitle: string,
		denyTitle: string,
		modalOpts?: any
	): Promise<any> {
		return new Promise((resolve, reject)=>{
			var $modal = $('#modal-form');
			var $approveButton = $modal.find('.positive.button');
			var $denyButton = $modal.find('.deny.button');
			$modal.find('.header').empty().text(headerTitle);
			var $form = this.cloneTemplate($template);
			$form.find('.ui.dropdown').dropdown();
			$form.find('.ui.toggle.checkbox').checkbox();
			$modal.find('.content').empty().append($form);
			$approveButton.find('span.text').empty().text(approveTitle);
			$denyButton.find('span.text').empty().text(denyTitle);
			var modalOpts_ = $.extend({closable:false}, modalOpts);
			$modal
				.modal($.extend(modalOpts_, {
					onApprove: ()=>{
						modalOpts.onApprove && modalOpts.onApprove.apply(this, []);
						resolve($form.form('get values'));
					},
					onDeny: ()=>{
						modalOpts.onDeny && modalOpts.onDeny.apply(this, []);
						resolve(null);
					}
				}))
				.modal('show');
		});
	}

	openProgressModal(text: string) {
		$('#modal-progress .ui.progress')
			.removeClass('active')
			.progress({
				percent: .0,
				autoSuccess: false,
				showActivity: false
			})
			.find('.label').text(text);
		$('#modal-progress').modal({ closable: false }).modal('show');
	}

	updateProgress(p: number, text?: string) {
		var $e = $('#modal-progress .ui.progress');
		if (p != null) {
			$e.progress('set.percent', 100.0 * p);
			if (.0 < p) $e.addClass('active'); else $e.removeClass('active');
		}
		if (text != null) $e.find('.label').text(text);
	}

	closeProgressModal() {
		$('#modal-progress').modal('hide');
	}

}

export var UI = window['UI'] = new UIStatic();
