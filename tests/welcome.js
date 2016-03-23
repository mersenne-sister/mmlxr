'use strict'

var webdriver = require('selenium-webdriver');
var t = require('selenium-webdriver/testing');
var expect = require('expect.js');
var assert = require('power-assert');
var By = webdriver.By;
var TimeUnit = webdriver.TimeUnit;
var driver;
 
t.describe('Welcome Modal', function(){
	
	t.before(function(){
		this.timeout(30000);
		driver = new webdriver.Builder()
			.usingServer('http://localhost:9515/')
			.withCapabilities(webdriver.Capabilities.chrome())
			.build();
	});
 
	t.after(function(){
		driver.quit();
	});
 
	t.it('should be shown', function(){
		driver.get('http://localhost:8000/')
			.then(function(){
				return driver.wait(function(){
					return driver.isElementPresent(By.css('#modal-alert.active .ui.button'));
				});
			})
			.then(function(){
				return driver.findElement(By.css('#modal-alert.active .ui.button')).getText();
			})
			.then(function(text){
				expect(text).to.be('OK');
			});
	});

});
