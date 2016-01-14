"use strict";

var tcpp = require('tcp-ping');

var Cats = require('./services/cats.js');
var Props = require('./services/device-properties.js');

var cfg = require('./configuration.js');

var common = {};

/*

when we detect a device/bridge, call monitor on it
provide a callback which will remove the bridge/device
will then set shorter discovery interval
call discovery

after a successful discovery set longer interval

Do a full discovery for local devices every 2 minutes

only applies to devices that need to be actively discovered

monitor('google.com', 80, function() {
    console.log('down');
});

*/

common.monitor = function(host, port, cb) {

    tcpp.probe(host, port, function (err, available) {

        if (err || !available) {
            return cb();
        }

        console.log('.');

        setTimeout(common.monitor, 20 * 1000, host, port, cb);
    });
};

common.addDeviceProperties = function (devicelist) {

    var blacklist = cfg.get('blacklist_devices', []);
    var activations = cfg.get('device_activations', {});
    var usecount = cfg.get('device_usecount', {});
    var lastused = cfg.get('device_lastused', {});

    var id = '', deviceProperties = {}, userProperties = {};

    for (var d = 0; d < devicelist.length; d++) {
        id = devicelist[d].id;
        devicelist[d].categories = Cats.getCats(id); // Deprecated
        devicelist[d].category = Cats.getCat(id);
        devicelist[d].blacklisted = blacklist.indexOf(id) !== -1;

        deviceProperties = Props.getDeviceProperties(id);

        for (var p in deviceProperties) {
            devicelist[d][p] = deviceProperties[p];
        }

        if (this.hasOwnProperty('user_id')) {

            userProperties = Props.getUserProperties(id, this.user_id);

            for (p in userProperties) {
                devicelist[d][p] = userProperties[p];
            }

            if (lastused[id] && lastused[id][this.user_id]) {
                devicelist[d].lastused = lastused[id][this.user_id];
            }
        }

        if (activations[id]) {
            devicelist[d].last_activated = activations[id];
        } else {
            devicelist[d].last_activated = null;
        }

        if (usecount[id]) {
            devicelist[d].usecount = usecount[id];
        } else {
            devicelist[d].usecount = 0;
        }
    }
};

module.exports = common;

