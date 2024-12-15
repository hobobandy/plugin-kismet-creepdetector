# plugin-kismet-creepdetector

Simple plugin to calculate the overall distance a device was heard at (max-min). This could be used to identify MAC address following you.

For now, the plugin adds a tab in the bottom panel of Kismet with the results of the calculation.

## Tweaking the thresholds

I recommend you install the plugin using ```make userinstall``` and editing the ```~/.kismet/plugins/creepdetector/httpd/js/creepdetector.js``` file to tweak the thresholds, refresh rate, etc.

## Features wishlist

- Integrate with Kismet ~~settings panel~~ and devices table
- Highlight devices that meet the thresholds
- Mapping the creeps/devices

## Credits

Based on the work of [skickar](https://github.com/skickar) and [Alex Lynd](https://github.com/AlexLynd), check out the original [CreepDetector](https://github.com/skickar/CreepDetector)!
