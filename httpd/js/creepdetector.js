"use strict";

var local_uri_prefix = "";
if (typeof KISMET_URI_PREFIX !== "undefined")
  local_uri_prefix = KISMET_URI_PREFIX;

// Timeframe of devices to fetch on initial load (1 = all since start of session, -60 = last 60 seconds)
const INITIAL_TIMEFRAME = 1;

// Interval between distance checks (in miliseconds, 1s = 1000ms)
const REFRESH_INTERVAL = 10000;

// Haversine configuration - Ref: https://github.com/njj/haversine
const DISTANCE_UNIT = "mile";
const DISTANCE_THRESHOLD = 0.2;

let creep_thresh_dist = kismet.getStorage(
  "kismet.creepdetector.thresh_dist",
  DISTANCE_THRESHOLD
);
let creep_thresh_unit = kismet.getStorage(
  "kismet.creepdetector.thresh_unit",
  DISTANCE_UNIT
);
let creep_show_only_creeps = kismet.getStorage(
  "kismet.creepdetector.show_only_creeps",
  false
);
let creep_initial_timeframe = kismet.getStorage(
  "kismet.creepdetector.initial_timeframe",
  INITIAL_TIMEFRAME
);
let creep_refresh_interval = kismet.getStorage(
  "kismet.creepdetector.refresh_interval",
  REFRESH_INTERVAL
);

kismet_ui_tabpane.AddTab({
  id: "creepdetector",
  tabTitle: "CreepDetector",
  priority: -100,
  createCallback: function (div) {
    $(document).ready(function () {
      $(div).append(
        '<script src="plugin/creepdetector/js/haversine.js"></script>'
      );
      $(div).append('<div id="creepdetecter-table" style="width:100%"></div>');

      let table = new Tabulator("#creepdetecter-table", {
        persistence: true,
        layout: "fitColumns",
        pagination: true,
        paginationSize: 10,
        columns: [
          { title: "SSID", field: "ssid", widthGrow: 3 },
          { title: "Type", field: "type", widthGrow: 1 },
          { title: "MAC Addr", field: "macaddr", widthGrow: 2 },
          { title: "Manuf", field: "manuf", widthGrow: 3 },
          { title: "Last RSSI", field: "rssi", widthGrow: 1, sorter: "number" },
          { title: "Lat", field: "lat", widthGrow: 2, sorter: "number" },
          { title: "Lon", field: "lon", widthGrow: 2, sorter: "number" },
          {
            title: "Haversine (" + creep_thresh_unit + ")",
            field: "haversine",
            widthGrow: 2,
            sorter: "number",
          },
        ],
        initialSort: [
          { column: "rssi", dir: "desc" },
          { column: "haversine", dir: "desc" },
        ],
      });

      // Handle row clicks
      table.on("rowClick", (e, row) => {
        kismet_ui.DeviceDetailWindow(row.getData()["id"]);
      });

      // Fetch initial devices based on timeframe set
      let last_heard = creep_initial_timeframe;

      // Gets devices since timestamp (absolute, or relative to now - using negatives)
      function getDevices() {
        const dataJSON = {
          fields: [
            "kismet.device.base.key",
            "kismet.device.base.last_time",
            "kismet.device.base.name",
            "kismet.device.base.type",
            "kismet.device.base.macaddr",
            "kismet.device.base.manuf",
            "kismet.device.base.signal/kismet.common.signal.last_signal",
            [
              "kismet.device.base.location/kismet.common.location.min_loc/kismet.common.location.geopoint",
              "min_loc",
            ],
            [
              "kismet.device.base.location/kismet.common.location.max_loc/kismet.common.location.geopoint",
              "max_loc",
            ],
            [
              "kismet.device.base.location/kismet.common.location.last/kismet.common.location.geopoint",
              "last_loc",
            ],
          ],
        };
        const postData = "json=" + JSON.stringify(dataJSON);

        $.post(
          local_uri_prefix +
            "/devices/views/all/last-time/" +
            last_heard +
            "/devices.json",
          postData,
          "json"
        ).done(function (data) {
          data = kismet.sanitizeObject(data);

          // Array of device rows to update or add to the table
          let rows = [];

          for (const d of data) {
            // Update last device heard timestamp for next call
            if (d["kismet.device.base.last_time"] > last_heard) {
              last_heard = d["kismet.device.base.last_time"];
            }

            // Skip devices with no location
            if (d["min_loc"] == 0 || d["max_loc"] == 0 || d["last_loc"] == 0) {
              continue;
            }

            const d_haversine = haversine(d["min_loc"], d["max_loc"], {
              format: "[lon,lat]",
              unit: creep_thresh_unit,
            });

            // Skip devices not creeping
            if (creep_show_only_creeps && d_haversine < creep_thresh_dist) {
              continue;
            }

            const d_row = {
              id: d["kismet.device.base.key"],
              ssid: d["kismet.device.base.name"],
              type: d["kismet.device.base.type"],
              macaddr: d["kismet.device.base.macaddr"],
              manuf: d["kismet.device.base.manuf"],
              rssi: d["kismet.common.signal.last_signal"],
              lat: d["last_loc"][1],
              lon: d["last_loc"][0],
              haversine: d_haversine,
            };

            rows.push(d_row);
          }

          // Update current rows based on id or add as a new row
          table.updateOrAddData(rows);
        });
      } // end of getDevices

      table.on("tableBuilt", function () {
        // Get initial devices
        getDevices();

        // Refresh devices at interval
        setInterval(getDevices, creep_refresh_interval);
      });
    }); // end of document.ready
  }, // end of createCallback
}); // end of AddTab

kismet_ui_settings.AddSettingsPane({
  id: "plugin_creepdetector",
  listTitle: "CreepDetector",
  create: function (elem) {
    elem.append(
      $("<form>", {
        id: "form",
      })
        .append(
          $("<fieldset>", {
            id: "creep_general",
          })
            .append($("<legend>", {}).html("General"))
            .append(
              $("<label>", {
                for: "creep_initial_timeframe",
              }).html(
                "Timeframe of devices to fetch on initial load (1 = all since start of session, -60 = last 60 seconds): "
              )
            )
            .append(
              $("<input>", {
                type: "text",
                name: "creep_initial_timeframe",
                id: "creep_initial_timeframe",
              })
            )
            .append($("<br>", {}))
            .append(
              $("<label>", {
                for: "creep_refresh_interval",
              }).html(
                "Interval between distance checks (in miliseconds, 1s = 1000ms): "
              )
            )
            .append(
              $("<input>", {
                type: "text",
                name: "creep_refresh_interval",
                id: "creep_refresh_interval",
              })
            )
            .append($("<br>", {}))
            .append($("<br>", {}))
            .append(
              $("<input>", {
                type: "checkbox",
                id: "creep_gen_show",
                name: "creep_gen_show",
                value: "checked",
              })
            )
            .append(
              $("<label>", {
                for: "creep_gen_show",
              }).html("Show only creeps that break the threshold distance.")
            )
        )
        .append($("<br>", {}))
        .append(
          $("<fieldset>", {
            id: "creep_thresh_dist",
          })
            .append($("<legend>", {}).html("Threshold Distance"))
            .append(
              $("<label>", {
                for: "creep_thresh_dist_val",
              }).html("Treat devices with distance over this value as creeps: ")
            )
            .append(
              $("<input>", {
                type: "text",
                name: "creep_thresh_dist_val",
                id: "creep_thresh_dist_val",
              })
            )
        )
        .append($("<br>", {}))
        .append(
          $("<fieldset>", {
            id: "creep_thresh_unit",
          })
            .append($("<legend>", {}).html("Threshold Unit"))
            .append(
              $("<input>", {
                type: "radio",
                id: "creep_thresh_unit_km",
                name: "creep_thresh_unit_val",
                value: "km",
              })
            )
            .append(
              $("<label>", {
                for: "creep_thresh_unit_km",
              }).html("Kilometers (km)")
            )
            .append(
              $("<input>", {
                type: "radio",
                id: "creep_thresh_unit_mile",
                name: "creep_thresh_unit_val",
                value: "mile",
              })
            )
            .append(
              $("<label>", {
                for: "creep_thresh_unit_mile",
              }).html("Miles (mi)")
            )
            .append(
              $("<input>", {
                type: "radio",
                id: "creep_thresh_unit_m",
                name: "creep_thresh_unit_val",
                value: "meter",
              })
            )
            .append(
              $("<label>", {
                for: "creep_thresh_unit_m",
              }).html("Meters (m)")
            )
            .append(
              $("<input>", {
                type: "radio",
                id: "creep_thresh_unit_nmi",
                name: "creep_thresh_unit_val",
                value: "nmi",
              })
            )
            .append(
              $("<label>", {
                for: "creep_thresh_unit_nmi",
              }).html("Nautical Miles (nmi)")
            )
        )
        .append($("<br>", {}))
        .append(
          $("<p>").html(
            "Note: Refresh the Kismet Web UI for changes to take effect."
          )
        )
    );

    $("#form", elem).on("change", function () {
      kismet_ui_settings.SettingsModified();
    });

    $("#creep_initial_timeframe").val(
      kismet.getStorage(
        "kismet.creepdetector.initial_timeframe",
        INITIAL_TIMEFRAME
      )
    );

    $("#creep_refresh_interval").val(
      kismet.getStorage(
        "kismet.creepdetector.refresh_interval",
        REFRESH_INTERVAL
      )
    );

    $("#creep_thresh_dist_val").val(
      kismet.getStorage("kismet.creepdetector.thresh_dist", DISTANCE_THRESHOLD)
    );

    let thresh_unit = kismet.getStorage(
      "kismet.creepdetector.thresh_unit",
      DISTANCE_UNIT
    );
    if (thresh_unit === "km") {
      $("#creep_thresh_unit_km", elem).attr("checked", "checked");
    } else if (thresh_unit === "mile") {
      $("#creep_thresh_unit_mi", elem).attr("checked", "checked");
    } else if (thresh_unit === "meter") {
      $("#creep_thresh_unit_m", elem).attr("checked", "checked");
    } else if (thresh_unit === "nmi") {
      $("#creep_thresh_unit_nmi", elem).attr("checked", "checked");
    } else {
      $("#creep_thresh_unit_mi", elem).attr("checked", "checked");
    }

    if (
      kismet.getStorage("kismet.creepdetector.show_only_creeps") === "checked"
    ) {
      $("#creep_gen_show", elem).attr("checked", "checked");
    } else {
      $("#creep_gen_show", elem).removeAttr("checked");
    }

    $("#creep_thresh_dist", elem).controlgroup();
    $("#creep_thresh_unit", elem).controlgroup();
    $("#creep_general", elem).controlgroup();
  },
  save: function (elem) {
    let initial_timeframe = $(
      "input[name='creep_initial_timeframe']",
      elem
    ).val();
    kismet.putStorage(
      "kismet.creepdetector.initial_timeframe",
      initial_timeframe
    );

    let refresh_interval = $(
      "input[name='creep_refresh_interval']",
      elem
    ).val();
    kismet.putStorage(
      "kismet.creepdetector.refresh_interval",
      refresh_interval
    );

    let thresh_dist = $("input[name='creep_thresh_dist_val']", elem).val();
    kismet.putStorage("kismet.creepdetector.thresh_dist", thresh_dist);

    let thresh_unit = $(
      "input[name='creep_thresh_unit_val']:checked",
      elem
    ).val();
    kismet.putStorage("kismet.creepdetector.thresh_unit", thresh_unit);

    let show_only_creeps = "";
    if ($("#creep_gen_show").is(":checked")) {
      show_only_creeps = "checked";
    }
    kismet.putStorage(
      "kismet.creepdetector.show_only_creeps",
      show_only_creeps
    );

    return true;
  },
}); // end AddSettingsPane
