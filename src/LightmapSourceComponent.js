import JSZip from "jszip"
import { BaseComponent } from "vatom-spaces-plugins"

/**
 * Attaches lightmap data to an audio source
 */
export class LightmapSourceComponent extends BaseComponent {

    /** Lightmap data */
    info = null
    events = []

    /** Audio information */
    audioIsPlaying = false
    lastAudioUpdate = 0
    lastAudioPosition = 0
    lastEventIdx = -1

    /** Get current song time, accounting for delays between updates */
    getCurrentSongTime() {
            
        // Calculate time since last update
        let timeSinceUpdate = Date.now() - this.lastAudioUpdate
        let timeSinceUpdateSec = timeSinceUpdate

        // Calculate current time
        let currentTime = this.lastAudioPosition + timeSinceUpdateSec

        // Done
        return currentTime

    }

    /** Register the component */
    static register(plugin) {

        // Register this component
        plugin.objects.registerComponent(this, {
            id: 'lightmap-source',
            name: 'Lightmap Source',
            description: 'Attaches lightmap data to an audio source.',
            settings: [
                { id: 'lightmap-url', name: 'Lightmap URL', type: 'file', help: 'The zip file containing the BeatSaber lightmap data. You can get these from bsaber.com.' }
            ]
        })

    }

    /** Called on load */
    onLoad() {
    
        // Load immediately
        this.onObjectUpdated()

        // Start update timer
        this.timer = setInterval(() => this.onTick(), 1000/60)

        // Listen for song position
        this.plugin.hooks.addHandler('plugins.media-playback.updated', this.onMediaUpdate)
    
    }

    /** Called on unload */
    onUnload() {

        // Stop update timer
        clearInterval(this.timer)

        // Stop listening for song position
        this.plugin.hooks.removeHandler('plugins.media-playback.updated', this.onMediaUpdate)

    }

    /** Called on object updated */
    async onObjectUpdated() {

        // Check if URL changed
        let url = this.getField('lightmap-url')
        if (url == this.lastUrl || !url) return

        // Unload existing data
        this.info = null
        this.events = []
        this.lastEventTime = -1

        // Load new data
        try {
            await this.loadData(url)
        } catch (e) {
            console.error('[Lightmap] Unable to load:', e)
        }

    }

    /** Start loading data */
    async loadData(url) {

        // Load as blob
        console.debug('[Lightmap] Loading data from: ', url)
        let blob = await fetch(url).then(r => r.blob())

        // Process zip
        let zip = new JSZip()
        await zip.loadAsync(blob)

        // Load info data
        let infoFile = zip.file('Info.dat')
        let infoTxt = await infoFile.async('text')
        this.info = JSON.parse(infoTxt)
        console.debug(`[Lightmap] Loaded song: ${this.info._songName} by ${this.info._songAuthorName} (mapped by ${this.info._levelAuthorName})`)

        // Find info on first difficulty
        let difficulty = this.info._difficultyBeatmapSets[0]._difficultyBeatmaps[0]
        let beatmapFilename = difficulty._beatmapFilename
        
        // Load beatmap file
        console.debug(`[Lightmap] Loading beatmap file: ${beatmapFilename}`)
        let beatmapFile = zip.file(beatmapFilename)
        let beatmapTxt = await beatmapFile.async('text')
        let beatmap = JSON.parse(beatmapTxt)
        console.debug(`[Lightmap] Loading beatmap v${beatmap.version}: `, beatmap)

        // Map all lighting events to real time offsets
        this.events = []
        let bpm = beatmap.bpmEvents[0]?.m || 100                // <-- TODO: Handle flexible BPM
        for (let event of beatmap.basicBeatmapEvents) {

            // https://bsmg.wiki/mapping/difficulty-format-v2.html#time-2
            // b -> _time
            // et -> _type
            // i -> _value
            // f -> _floatValue

            // Calculate absolute time of this event from the start of the song
            let ev = {
                time: event.b / bpm * 60 * 1000
            }

            // Check type
            if (event.et == 2 || event.et == 3 || event.et == 4) {

                // Lighting event for the center light
                if (event.et == 2) ev.reactor = 'Left Laser'
                else if (event.et == 3) ev.reactor = 'Right Laser'
                else if (event.et == 4) ev.reactor = 'Center Light'

                // Check action ... https://bsmg.wiki/mapping/difficulty-format-v2.html#controlling-lights
                if (event.i == 0) ev.action = 'light:off'
                else if (event.i == 1) ev.action = 'light:blue:on'
                else if (event.i == 2) ev.action = 'light:blue:flash'
                else if (event.i == 3) ev.action = 'light:blue:fade'
                else if (event.i == 5) ev.action = 'light:red:on'
                else if (event.i == 6) ev.action = 'light:red:flash'
                else if (event.i == 7) ev.action = 'light:red:fade'
                else if (event.i == 9) ev.action = 'light:white:on'
                else if (event.i == 10) ev.action = 'light:white:flash'
                else if (event.i == 11) ev.action = 'light:white:fade'
                else continue

            } else {

                // Unknown event, skip
                continue

            }

            // Done, add it
            this.events.push(ev)

        }

        // Sort events by time
        this.events.sort((a, b) => a.time - b.time)

        // Loaded!
        console.debug(`[Lightmap] Loaded ${this.events.length} events!`)

    }

    /** Called when we receive position data from the media plugin */
    onMediaUpdate = e => {

        // Check if song restarted
        let didRestart = false
        if (!this.audioIsPlaying && !e.paused) didRestart = true
        if (e.currentTime * 1000 < this.lastAudioPosition) didRestart = true

        // Store info
        this.audioIsPlaying = !e.paused
        this.lastAudioPosition = e.currentTime * 1000
        this.lastAudioUpdate = Date.now()

        // If song restarted, reset event index
        if (didRestart) {
            console.debug(`[Lightmap] Song restarted!`)
            let currentSongTime = this.getCurrentSongTime()
            this.lastEventIdx = this.events.findIndex(e => e.time >= currentSongTime)
        }

    }

    /** Called every "frame" */
    onTick() {

        // Stop if not ready
        if (!this.events?.length) 
            return

        // Stop if audio is not playing
        if (!this.audioIsPlaying)
            return

        // Stop if no event index
        if (this.lastEventIdx == -1)
            return

        // Send events
        let currentSongTime = this.getCurrentSongTime()
        for (let i = this.lastEventIdx ; i < this.events.length ; i++) {

            // Stop if the next event is in the future
            if (this.events[i].time > currentSongTime)
                break

            // Send this event
            this.lastEventIdx = i+1
            this.plugin.onLightingEvent(this.events[i])

        }

    }

}