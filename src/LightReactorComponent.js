import { BaseComponent } from "vatom-spaces-plugins";

/**
 * Reacts to lighting events.
 */
export class LightReactorComponent extends BaseComponent {

    /** Register the component */
    static register(plugin) {

        // Register this component
        plugin.objects.registerComponent(this, {
            id: 'light-reactor',
            name: 'Light Reactor',
            description: 'Reacts to lighting events from the Lightmap Source.',
            settings: [
                { id: 'type', name: 'Reactor type', type: 'select', help: 'What kind of events to react to.', 
                    values: ['Disabled', 'Center Light', 'Left Laser', 'Right Laser']
                },
                { id: 'intensity-multiplier', name: 'Intensity multiplier', type: 'number', help: 'How much to multiply the intensity by.', default: 1 }
            ]
        })

    }

    /** Called on a lighting event */
    onLightingEvent(event) {

        // Stop if not our type
        if (event.reactor != this.getField('type'))
            return

        // Check action
        if (event.action == 'light:off')                this.animateLight(null, null, 0, 100)
        else if (event.action == 'light:blue:on')       this.animateLight('#55ccff', null, 1, 100)
        else if (event.action == 'light:blue:flash')    this.animateLight('#55ccff', 2, 1, 500)
        else if (event.action == 'light:blue:fade')     this.animateLight('#55ccff', 2, 0, 500)
        else if (event.action == 'light:red:on')        this.animateLight('#ff9e9e', null, 1, 100)
        else if (event.action == 'light:red:flash')     this.animateLight('#ff9e9e', 2, 1, 500)
        else if (event.action == 'light:red:fade')      this.animateLight('#ff9e9e', 2, 0, 500)
        else if (event.action == 'light:white:on')      this.animateLight('#ffffff', null, 1, 100)
        else if (event.action == 'light:white:flash')   this.animateLight('#ffffff', 2, 1, 500)
        else if (event.action == 'light:white:fade')    this.animateLight('#ffffff', 2, 0, 500)
        else {

            // Unknown event
            console.warn(`[Lightmap Reactor] Unknown event: ${event.action}`)

        }

    }

    /** Animate light */
    animateLight(color, intensityStart, intensityEnd, duration) {

        // Set color if specified and it's different
        if (color && this.fields.color != color) {
            this.plugin.objects.update(this.objectID, { color }, true)
            this.fields.color = color
        }

        // Get field name
        let fieldName = ''
        if (this.fields.type == 'point-light' || this.fields.type == 'spot-light') fieldName = 'intensity'
        else fieldName = 'opacity'

        // If start is null, get current value
        if (intensityStart === null) intensityStart = this.fields.intensity || 0

        // Animate property
        let intensityMultiplier = parseFloat(this.getField('intensity-multiplier')) || 1
        this.animateProperty(fieldName, intensityStart * intensityMultiplier, intensityEnd * intensityMultiplier, duration)

    }

    /** Animate a property change */
    animateProperty(name, startValue, endValue, duration) {

        // Set start value
        this.plugin.objects.update(this.objectID, { [name]: startValue }, true)

        // Cancel previous timers
        if (this.actionTimer)
            clearInterval(this.actionTimer)

        // Start timer
        let startedAt = Date.now()
        this.actionTimer = setInterval(() => {

            // Calculate time
            let timeSinceStart = Date.now() - startedAt

            // Calculate value
            let value = startValue + ((endValue - startValue) * (timeSinceStart / duration))

            // Update
            this.plugin.objects.update(this.objectID, { [name]: value }, true)
            this.fields[name] = endValue

            // Stop if done
            if (timeSinceStart >= duration) {
                
                // Remove timer
                clearInterval(this.actionTimer)
                this.actionTimer = null

                // Set final value
                this.plugin.objects.update(this.objectID, { [name]: endValue }, true)
                this.fields[name] = endValue

            }

        }, 1000/60)

    }

}