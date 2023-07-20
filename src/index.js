import { BasePlugin, BaseComponent } from 'vatom-spaces-plugins'
import { LightmapSourceComponent } from './LightmapSourceComponent'
import { LightReactorComponent } from './LightReactorComponent'

/**
 * This is the main entry point for your plugin.
 *
 * All information regarding plugin development can be found at
 * https://developer.vatom.com/spaces/plugins-in-spaces/guide-create-plugin
 *
 * @license MIT
 * @author Vatom Inc.
 */
export default class MyPlugin extends BasePlugin {

    /** Plugin info */
    static id = "com.jjv360.lightshow"
    static name = "Lightshow"

    /** Called on load */
    onLoad() {

        // Register components
        LightmapSourceComponent.register(this)
        LightReactorComponent.register(this)

        // Button to select song
        this.menus.register({
            icon: this.paths.absolute('musical-note.png'),
            text: 'Change Song',
            action: () => this.onSelectSong()
        })

    }

    /** Called by LightmapSourceComponent when an event happens */
    onLightingEvent(event) {

        // Get all components
        let components = this.objects.getComponentInstances()
        for (let component of components) {

            // Send event if it can handle it
            if (component.onLightingEvent)
                component.onLightingEvent(event)

        }

    }

    /** Called when the suer rpesses the Select Song button */
    async onSelectSong() {

        this.menus.alert(`This is not implemented yet...`, 'Testing', 'error')

    }

}
