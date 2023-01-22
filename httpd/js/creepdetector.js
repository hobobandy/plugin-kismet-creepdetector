"use strict";

var local_uri_prefix = "";
if (typeof(KISMET_URI_PREFIX) !== 'undefined')
    local_uri_prefix = KISMET_URI_PREFIX;

// Timeframe of devices to fetch on initial load (1 = all since start of session, -60 = last 60 seconds)
const INITIAL_TIMEFRAME = 1; 

// Interval between distance checks (in miliseconds, 1s = 1000ms)
const REFRESH_INTERVAL = 10000; 

// Haversine configuration - Ref: https://github.com/njj/haversine
// @todo Add controls on the Kismet web UI
const DISTANCE_UNIT = 'mile';
const DISTANCE_THRESHOLD = 0.2;

kismet_ui_tabpane.AddTab({
    id: 'creepdetector',
    tabTitle: 'CreepDetector',
    priority: -100,
    createCallback: function (div) {
        $(document).ready(function () {
            $(div).append('<script src="plugin/creepdetector/js/haversine.js"></script>');
            $(div).append(`
                <table id="creepdetecter-table" style="width:100%">
                    <thead>
                        <tr>
                            <th>SSID</th>
                            <th>Type</th>
                            <th>MAC Addr</th>
                            <th>Manuf</th>
                            <th>Last RSSI</th>
                            <th>Lat</th>
                            <th>Lon</th>
                            <th>Haversine</th>
                        </tr>
                    </thead>
                    <tfoot>
                        <tr>
                            <th>SSID</th>
                            <th>Type</th>
                            <th>MAC Addr</th>
                            <th>Manuf</th>
                            <th>Last RSSI</th>
                            <th>Lat</th>
                            <th>Lon</th>
                            <th>Haversine</th>
                        </tr>
                    </tfoot>
                </table>
            `);
            
            var dt = $('#creepdetecter-table').DataTable({
              "lengthMenu": [ [5, 10, 25, 50, -1], [5, 10, 25, 50, "All"] ],
              "order": [[ 7, "desc" ]]
            });

            // Persistant object to prevent duplicate markers
            var devices = {};
            
            // Get new devices, then plot all devices
            function updateDevices() {
                // Get devices active in last X seconds
                getDevices();
            }

            // Gets devices since timestamp (absolute, or relative to now - using negatives)
            function getDevices() {
                const dataJSON = {
                    fields: [
                        'kismet.device.base.name',
                        'kismet.device.base.type',
                        'kismet.device.base.macaddr',
                        'kismet.device.base.manuf',
                        'kismet.device.base.signal/kismet.common.signal.last_signal',
                        ['kismet.device.base.location/kismet.common.location.min_loc', 'min_loc'],
                        ['kismet.device.base.location/kismet.common.location.max_loc', 'max_loc'],
                        ['kismet.device.base.location/kismet.common.location.last', 'last_loc']
                    ],
                }
                const postData = "json=" + JSON.stringify(dataJSON);
                
                //console.log(postData);

                $.post(local_uri_prefix + "/devices/views/all/devices.json", postData, "json")
                .done(function (data) {
                    data = kismet.sanitizeObject(data);
                    
                    dt.clear();
                    
                    for (const d of data) {
                        //console.log(d['min_loc']);
                        
                        // Skip devices with no location
                        if ((d['min_loc'] == 0) || (d['max_loc'] == 0) || (d['last_loc'] == 0))
                            continue;
                        
                        const d_haversine = haversine(d['min_loc']['kismet.common.location.geopoint'], 
                                                      d['max_loc']['kismet.common.location.geopoint'], 
                                                      {format: "[lon,lat]", unit: DISTANCE_UNIT});
                        
                        // Skip devices not creeping
                        //if (d_haversine < DISTANCE_THRESHOLD)
                        //    continue
                        
                        const d_row = [
                            d['kismet.device.base.name'],
                            d['kismet.device.base.type'],
                            d['kismet.device.base.macaddr'],
                            d['kismet.device.base.manuf'],
                            d['kismet.common.signal.last_signal'],
                            d['last_loc']['kismet.common.location.geopoint'][1],
                            d['last_loc']['kismet.common.location.geopoint'][0],
                            d_haversine,
                        ];
                        
                        dt.row.add(d_row).draw(false);
                        
                        //devices[d['kismet.device.base.macaddr']] = device;
                        
                    }
                    
                    //console.log(devices);
                })
            }; // end of getDevices

            // Get devices from beginning of session
            getDevices(INITIAL_TIMEFRAME);

            // Get new devices every second
            setInterval(updateDevices, REFRESH_INTERVAL);
        }); // end of document.ready
    }, // end of createCallback
}); // end of AddTab
