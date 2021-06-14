# MMLxr


# How to start development

```bash
git submodule init
git submodule update
vim config.yml
gulp rebuild
npm start
```


# Roadmap

## Current tasks

- Track Tab
    - Display current waveform on realtime
- File
    - Abort importing if the file seems to be in unexpected format or too large
- Editor
    - **Autocompletion works case sensitive**
    - Size limit alert
- Piano Roll
    - **Minimize grid image and implement suedo-scroll**s
    - Warn if event density too high
- Misc.
    - iOS player support
    - **Kill worker if it does not answer to COM_STOP**
    - Abort compiling
        - if too many events created
        - if too many warnings occured
        - by pressing stop button
    - Check browser compatibility
        - Alert about that appendChild works too slow

## In the next version

- MML Extension
    - \#PRAGMA LXR BARTICK
    - \#PRAGMA LXR TRACKCOLOR
    - \#PRAGMA LXR TRACKNAME
- Track Tab
    - Disable Solo/Mute buttons while playing (revert MULTIPLE const)
    - Display current envelope on realtime
    - Select source code at clicking track button
    - Shift vertical position
    - Hide button
    - Guess the FM/DPCM tone name by macro name and comments
- File
    - Waveform visual preview in tiny popup
    - Guess the song title by comments
    - Sync with Dropbox
    - Export WAV/MP3 to SoundCloud
    - Download all MMLs on the browser storage as a .zip file
    - Alert if localStorage quota exceeded (10MB/domain @ Chrome)
- Editor
    - Alert if MML too long
    - Jump to the macro definition
- Piano Roll
    - Remove duplicated tempo events
    - Move particular track's notes topmost
    - Zoom
    - Auto redraw
    - Scroll by ruler or grid dragging
    - Measure max poly voice count
    - Show macro position in horizontal ruler
- Native application
    - Open local file directly
    - Fast encoding by native addon (nw-gyp)
    - .wav encoder progress bar
- Misc.
    - New version's feature alert
- Document
    - Help
    - Logo design

## In the future

- Envelope editor
- FM tone editor
- Start play from the marker
- Cache generated wave
- Loop play
- Note preview by clicking the note on piano roll
- Note preview by selecting source text


# Issues

- Bad note rendering (note-off of slured notes) Pikokakiko #2681


# Memo

- Upload to SoundCloud
    - https://developers.soundcloud.com/docs#authentication
    - https://developers.soundcloud.com/docs/api/sdks#uploading

- Configure ACE menu options
    - [ignore functions](https://github.com/ajaxorg/ace/blob/36e6744a5f40df0da52ff22b3bc729657c056e09/lib/ace/ext/menu_tools/get_set_functions.js#L99-L109)
    - [mode list](https://github.com/ajaxorg/ace/blob/037ddb731091078b321972d229067102a0a6dd80/lib/ace/ext/modelist.js#L45-L178)
    - [other options](https://github.com/ajaxorg/ace/blob/36e6744a5f40df0da52ff22b3bc729657c056e09/lib/ace/ext/menu_tools/add_editor_menu_options.js#L62-L91)

- Drag Out
  
  ```pug
  a(href='#' id='dragout' draggable=true): |Drag me onto your desktop
  ```
  
  ```javascript
  document.getElementById('dragout').addEventListener('dragstart', function(evt){
    evt.dataTransfer.setData('DownloadURL', url);
  },false);
  ```


# Play Sequence

- Messenger#onstopsound is only used for MML#play2
- Messenger#onrequestbuffer is only used for MSequencer#onSampleData

```
[WORKER THREAD]
    Messenger receives COM_PLAY {mml}
        call MML#play(mml, paused)
            if offline
                call MML#play2(mml) directly . . . . . . . . . . . > [1]
            else
                Messenger#stopSound
                    send COM_STOPSOUND to MAIN THREAD . . .
                                                          :
[MAIN THREAD]                                             :
    App receives COM_STOPSOUND  < . . . . . . . . . . . . :
        call App#stopSound
            unbind onAudioProcess                                           *AUDIO STOP
            disconnect audio nodes                                          |
        sen
        d COM_STOPSOUND to WORKER THREAD . . . . . . . .
                                                          :
[WORKER THREAD]                                           :
    Messenger receives COM_STOPSOUND  < . . . . . . . . . :
        call MML#play2  < . . . . . . . . . . . . . . . . . . . . . . [1]
            initialize variables                                            *COMPILE
            call MML#processComment()                                       |
            call MML#processMacro()                                         |
            remove whitespaces                                              |
            call MML#processRepeat()                                        |
            call MML#processGroupNotes()                                    |
            call MML#process()                                              |
            call MTrack#conduct(tracks, endMarginMSec) #tempo track only    |
            for each track                                                  |
                call MTrack#recRestMSec()                                   |
                call MTrack#recClose()                                      |
                call MSequencer#connect(track)                              |
            Messenger#compileComplete()
                send COM_COMPCOMP {events} to MAIN THREAD                   *DISPLAY
            if not to be paused
                call MSequencer#play()
                    call Messenger#playSound
                        send COM_PLAYSOUND to MAIN THREAD .
                                                          :
[MAIN THREAD]                                             :
    App receives COM_PLAYSOUND  < . . . . . . . . . . . . :
        call App#playSound
            connect audio nodes                                             *AUDIO START
            AudioContext#createScriptProcessor                              |
            bind onAudioProcess . . . . . . . . . . . . . .                 |
                                                          :
    onAudioProcess is called by Web Audio < . . . . . . . :
        if bufferReady
            transfer rendered data to Web Audio buffer                      *AUDIO PLAY
            bufferReady = false
            send COM_BUFFER {retBuf} to WORKER THREAD . . .
        else                                              :
            write empty data to Web Audio buffer          :
            send COM_BUFFER to WORKER THREAD  . . . . . . :
                                                          :
[WORKER THREAD]                                           :
    Messenger receives COM_BUFFER < . . . . . . . . . . . :
        frequently call MSequencer#onSampleData
            render data
            call Messenger#sendBuffer
                send COM_BUFFER to MAIN THREAD  . . . . . .
                                                          :
[MAIN THREAD]                                             :
    App receives COM_BUFFER {buffer}  < . . . . . . . . . :
        store rendered data
        bufferReady = true

```
