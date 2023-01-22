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

var creep_thresh_dist = kismet.getStorage('kismet.creepdetector.thresh_dist', DISTANCE_THRESHOLD);
var creep_thresh_unit = kismet.getStorage('kismet.creepdetector.thresh_unit', DISTANCE_UNIT);
var creep_show_only_creeps = kismet.getStorage('kismet.creepdetector.show_only_creeps');

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
                            <th>Haversine (`+creep_thresh_unit+`)</th>
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
                            <th>Haversine (`+creep_thresh_unit+`)</th>
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
                                                      {format: "[lon,lat]", unit: creep_thresh_unit});
                        
                        // Skip devices not creeping
                        if (creep_show_only_creeps) {
                          if (d_haversine < creep_thresh_dist) {
                            continue
                          }
                        }
                        
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

kismet_ui_settings.AddSettingsPane({
  id: 'plugin_creepdetector',
  listTitle: 'CreepDetector',
  create: function(elem) {
      elem.append(
          $('<form>', {
              id: 'form'
          })
          .append(
            $('<fieldset>', {
                id: 'creep_general'
            })
            .append(
                $('<legend>', { })
                .html("General")
            )
            .append(
                $('<input>', {
                    type: 'checkbox',
                    id: 'creep_gen_show',
                    name: 'creep_gen_show',
                    value: 'checked',
                })
            )
            .append(
                $('<label>', {
                    for: 'creep_gen_show',
                })
                .html('Show only creeps that break the threshold distance.')
            )
          )
          .append(
            $('<br>', { })
          )
          .append(
              $('<fieldset>', {
                  id: 'creep_thresh_dist',
              })
              .append(
                  $('<legend>', { })
                  .html("Threshold Distance")
              )
              .append(
                $('<label>', {
                    for: 'creep_thresh_dist_val',
                })
                .html('Treat devices with distance over this value as creeps:')
              )
              .append(
                $('<input>', {
                  type: 'text',
                  name: 'creep_thresh_dist_val',
                  id: 'creep_thresh_dist_val'
                })
              )
          )
          .append(
            $('<br>', { })
          )
          .append(
              $('<fieldset>', {
                  id: 'creep_thresh_unit'
              })
              .append(
                  $('<legend>', { })
                  .html("Threshold Unit")
              )
              .append(
                  $('<input>', {
                      type: 'radio',
                      id: 'creep_thresh_unit_km',
                      name: 'creep_thresh_unit_val',
                      value: 'km',
                  })
              )
              .append(
                  $('<label>', {
                      for: 'creep_thresh_unit_km',
                  })
                  .html('Kilometers (km)')
              )
              .append(
                  $('<input>', {
                      type: 'radio',
                      id: 'creep_thresh_unit_mile',
                      name: 'creep_thresh_unit_val',
                      value: 'mile',
                  })
              )
              .append(
                  $('<label>', {
                      for: 'creep_thresh_unit_mile',
                  })
                  .html('Miles (mi)')
              )
              .append(
                $('<input>', {
                    type: 'radio',
                    id: 'creep_thresh_unit_m',
                    name: 'creep_thresh_unit_val',
                    value: 'meter',
                })
              )
              .append(
                  $('<label>', {
                      for: 'creep_thresh_unit_m',
                  })
                  .html('Meters (m)')
              )
              .append(
                $('<input>', {
                    type: 'radio',
                    id: 'creep_thresh_unit_nmi',
                    name: 'creep_thresh_unit_val',
                    value: 'nmi',
                })
              )
              .append(
                  $('<label>', {
                      for: 'creep_thresh_unit_nmi',
                  })
                  .html('Nautical Miles (nmi)')
              )
          )
          .append(
            $('<br>', { })
          )
          .append(
            $('<p>')
            .html('Note: Refresh the Kismet Web UI for changes to take effect.')
          )
      );

      $('#form', elem).on('change', function() {
          kismet_ui_settings.SettingsModified();
      });

      $('#creep_thresh_dist_val').val(kismet.getStorage('kismet.creepdetector.thresh_dist', DISTANCE_THRESHOLD));

      var thresh_unit = kismet.getStorage('kismet.creepdetector.thresh_unit', DISTANCE_UNIT);
      if (thresh_unit === 'km') {
        $('#creep_thresh_unit_km', elem).attr('checked', 'checked');
      } else if (thresh_unit === 'mile') {
        $('#creep_thresh_unit_mi', elem).attr('checked', 'checked');
      } else if (thresh_unit === 'meter') {
        $('#creep_thresh_unit_m', elem).attr('checked', 'checked');
      } else if (thresh_unit === 'nmi') {
        $('#creep_thresh_unit_nmi', elem).attr('checked', 'checked');
      } else {
        $('#creep_thresh_unit_mi', elem).attr('checked', 'checked');
      }

      if (kismet.getStorage('kismet.creepdetector.show_only_creeps') === 'checked') {
          $('#creep_gen_show', elem).attr('checked', 'checked');
      } else {
          $('#creep_gen_show', elem).removeAttr('checked');
      }

      $('#creep_thresh_dist', elem).controlgroup();
      $('#creep_thresh_unit', elem).controlgroup();
      $('#creep_general', elem).controlgroup();

  },
  save: function(elem) {
      var thresh_dist = $("input[name='creep_thresh_dist_val']", elem).val();
      kismet.putStorage('kismet.creepdetector.thresh_dist', thresh_dist);

      var thresh_unit = $("input[name='creep_thresh_unit_val']:checked", elem).val();
      kismet.putStorage('kismet.creepdetector.thresh_unit', thresh_unit);

      if ($("#creep_gen_show").is(':checked')) {
        var show_only_creeps = 'checked';
      } else {
        var show_only_creeps = '';
      }
      kismet.putStorage('kismet.creepdetector.show_only_creeps', show_only_creeps);

      return true;
  },
}); // end AddSettingsPane