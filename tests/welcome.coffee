'use strict'

webdriver = require('selenium-webdriver')
t = require('selenium-webdriver/testing')
expect = require('expect.js')
assert = require('assert')
By = webdriver.By
TimeUnit = webdriver.TimeUnit
driver = null

$ = (selector) ->
	driver.findElement(By.css(selector))

$.wait = (selector) ->
	driver.wait ->
		driver.isElementPresent(By.css(selector))

t.describe 'Welcome Modal', ->
	
	t.before ->
		this.timeout(30000)
		driver = new webdriver.Builder()
			.usingServer('http://localhost:9515/')
			.withCapabilities(webdriver.Capabilities.chrome())
			.build()
 
	t.after ->
		driver.quit()
 
	t.it 'should be shown', ->
		driver.get('http://localhost:8000/')
			.then ->
				$.wait('#modal-alert.active .ui.button')
			.then ->
				$('#modal-alert.active .ui.button').getText()
			.then (text)->
				expect(text).to.be 'OK'
